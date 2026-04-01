import { createReadStream } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import * as readline from 'node:readline';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import type { FlattenMaps, Model } from 'mongoose';

import { AppModule } from '../app.module';
import { City, type CityDocument } from '../modules/catalog/cities/schemas/city.schema';
import { normalizeSearchName, withMongoRetry } from './import-geonames-cities';

type GeoNamesPostalRow = {
  countryCode: string;
  postalCode: string;
  placeName: string;
  normalizedPlaceName: string;
  adminName1: string;
  adminCode1: string;
  adminName2: string;
  adminCode2: string;
  adminName3: string;
  adminCode3: string;
  lat: number | null;
  lng: number | null;
  accuracy: string;
};

type PostalImportCity = FlattenMaps<
  Pick<
    CityDocument,
    '_id' | 'name' | 'normalizedName' | 'normalizedAliases' | 'countryCode' | 'stateCode' | 'stateName' | 'districtName' | 'postalCodes' | 'lat' | 'lng' | 'population'
  >
>;

type RetryOptions = {
  attempts: number;
  baseDelayMs: number;
};

const SCAN_PROGRESS_EVERY = 10000;
const WRITE_PROGRESS_EVERY = 500;

function normalizePostalCode(value: string): string {
  return String(value ?? '').replace(/\D+/g, '').trim();
}

function normalizeOptionalCode(value: string): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveRowDistrictCode(row: GeoNamesPostalRow): string | null {
  return normalizeOptionalCode(row.adminCode2) ?? normalizeOptionalCode(row.adminName2);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseGeoNamesPostalLine(line: string): GeoNamesPostalRow | null {
  const parts = line.split('\t');
  if (parts.length < 12) return null;

  const postalCode = normalizePostalCode(parts[1] ?? '');
  const placeName = String(parts[2] ?? '').trim();
  const normalizedPlaceName = normalizeSearchName(placeName);
  if (!postalCode || !placeName || !normalizedPlaceName) return null;

  const lat = Number(parts[9]);
  const lng = Number(parts[10]);

  return {
    countryCode: String(parts[0] ?? '').trim().toUpperCase(),
    postalCode,
    placeName,
    normalizedPlaceName,
    adminName1: String(parts[3] ?? '').trim(),
    adminCode1: String(parts[4] ?? '').trim(),
    adminName2: String(parts[5] ?? '').trim(),
    adminCode2: String(parts[6] ?? '').trim(),
    adminName3: String(parts[7] ?? '').trim(),
    adminCode3: String(parts[8] ?? '').trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    accuracy: String(parts[11] ?? '').trim(),
  };
}

export function shouldIncludePostalRow(row: GeoNamesPostalRow, countryCode = 'DE'): boolean {
  return row.countryCode === countryCode.toUpperCase() && row.postalCode.length > 0 && row.normalizedPlaceName.length > 0;
}

export function mergePostalCodes(existing: string[], incoming: string[]): string[] {
  return Array.from(
    new Set(
      [...existing, ...incoming]
        .map((value) => normalizePostalCode(value))
        .filter((value) => value.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function cityNameTokens(city: PostalImportCity): string[] {
  return Array.from(
    new Set(
      [
        normalizeSearchName(city.name ?? ''),
        normalizeSearchName(city.normalizedName ?? ''),
        ...(Array.isArray(city.normalizedAliases) ? city.normalizedAliases.map((value) => normalizeSearchName(value)) : []),
      ].filter((value) => value.length > 0),
    ),
  );
}

function cityDistanceKm(city: PostalImportCity, row: GeoNamesPostalRow): number | null {
  if (
    typeof city.lat !== 'number'
    || typeof city.lng !== 'number'
    || row.lat === null
    || row.lng === null
  ) {
    return null;
  }

  return haversineKm(city.lat, city.lng, row.lat, row.lng);
}

export function scorePostalCandidate(city: PostalImportCity, row: GeoNamesPostalRow): number {
  let score = 0;
  const nameTokens = cityNameTokens(city);
  const cityStateCode = normalizeOptionalCode(city.stateCode ?? '');
  const rowStateCode = normalizeOptionalCode(row.adminCode1 ?? '');
  const cityDistrictCode = normalizeOptionalCode(city.districtName ?? '');
  const rowDistrictCode = resolveRowDistrictCode(row);

  if (nameTokens.includes(row.normalizedPlaceName)) {
    score += city.normalizedName === row.normalizedPlaceName ? 140 : 110;
  }

  if (cityStateCode && cityStateCode === rowStateCode) {
    score += 60;
  } else if (
    city.stateName
    && row.adminName1
    && normalizeSearchName(city.stateName) === normalizeSearchName(row.adminName1)
  ) {
    score += 30;
  }

  if (
    cityDistrictCode
    && cityDistrictCode === rowDistrictCode
  ) {
    score += 25;
  }

  const distanceKm = cityDistanceKm(city, row);
  if (distanceKm !== null) {
    score += Math.max(0, 25 - Math.min(25, Math.round(distanceKm)));
  }

  const population = typeof city.population === 'number' ? city.population : 0;
  if (population > 0) {
    score += Math.min(30, Math.round(Math.log10(population + 1) * 5));
  }

  return score;
}

export function selectBestPostalCityCandidate(candidates: PostalImportCity[], row: GeoNamesPostalRow): PostalImportCity | null {
  if (candidates.length === 0) return null;
  const rowStateCode = normalizeOptionalCode(row.adminCode1 ?? '');
  const rowDistrictCode = resolveRowDistrictCode(row);

  const exactStateCandidates = candidates.filter(
    (city) => {
      const cityStateCode = normalizeOptionalCode(city.stateCode ?? '');
      return Boolean(cityStateCode && cityStateCode === rowStateCode);
    },
  );
  const stateScoped = exactStateCandidates.length > 0 ? exactStateCandidates : candidates;

  const exactDistrictCandidates = stateScoped.filter(
    (city) => {
      const cityDistrictCode = normalizeOptionalCode(city.districtName ?? '');
      return Boolean(cityDistrictCode && cityDistrictCode === rowDistrictCode);
    },
  );
  const districtScoped = exactDistrictCandidates.length > 0 ? exactDistrictCandidates : stateScoped;

  return [...districtScoped].sort((left, right) => {
    const scoreDelta = scorePostalCandidate(right, row) - scorePostalCandidate(left, row);
    if (scoreDelta !== 0) return scoreDelta;

    const leftDistance = cityDistanceKm(left, row);
    const rightDistance = cityDistanceKm(right, row);
    if (leftDistance !== null || rightDistance !== null) {
      if (leftDistance === null) return 1;
      if (rightDistance === null) return -1;
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    }

    const leftPopulation = typeof left.population === 'number' ? left.population : 0;
    const rightPopulation = typeof right.population === 'number' ? right.population : 0;
    if (leftPopulation !== rightPopulation) return rightPopulation - leftPopulation;

    return String(left._id).localeCompare(String(right._id));
  })[0] ?? null;
}

function addToIndex(index: Map<string, PostalImportCity[]>, token: string, city: PostalImportCity) {
  if (!token) return;
  const bucket = index.get(token);
  if (bucket) {
    bucket.push(city);
    return;
  }

  index.set(token, [city]);
}

function buildPostalCityIndexes(cities: PostalImportCity[]) {
  const byName = new Map<string, PostalImportCity[]>();
  const byAlias = new Map<string, PostalImportCity[]>();
  const byId = new Map<string, PostalImportCity>();

  for (const city of cities) {
    const cityId = String(city._id);
    byId.set(cityId, city);
    addToIndex(byName, normalizeSearchName(city.normalizedName ?? city.name ?? ''), city);

    for (const alias of Array.isArray(city.normalizedAliases) ? city.normalizedAliases : []) {
      addToIndex(byAlias, normalizeSearchName(alias), city);
    }
  }

  return { byId, byName, byAlias };
}

function findPostalCandidates(indexes: ReturnType<typeof buildPostalCityIndexes>, row: GeoNamesPostalRow): PostalImportCity[] {
  return Array.from(
    new Map(
      [...(indexes.byName.get(row.normalizedPlaceName) ?? []), ...(indexes.byAlias.get(row.normalizedPlaceName) ?? [])]
        .map((city) => [String(city._id), city]),
    ).values(),
  );
}

export async function bootstrap() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: npm run import:cities:postal:geonames -- /absolute/or/relative/path/to/DE.txt');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));
  const config = app.get(ConfigService);
  const retryOptions: RetryOptions = {
    attempts: Number(config.get<number>('app.geoNamesImportRetryAttempts') ?? 5),
    baseDelayMs: Number(config.get<number>('app.geoNamesImportRetryBaseDelayMs') ?? 1000),
  };

  const filePath = resolvePath(process.cwd(), inputPath);

  try {
    const existingCities = await withMongoRetry(
      'load cities for postal import',
      () =>
        cityModel
          .find({ isActive: true, countryCode: 'DE' })
          .select('_id name normalizedName normalizedAliases countryCode stateCode stateName districtName postalCodes lat lng population')
          .lean()
          .exec() as Promise<PostalImportCity[]>,
      retryOptions,
    );

    const indexes = buildPostalCityIndexes(existingCities);
    const postalCodesByCityId = new Map<string, Set<string>>();
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    let scanned = 0;
    let matchedRows = 0;
    let unmatchedRows = 0;
    let invalidRows = 0;

    console.log(`📮 Importing GeoNames postal codes from ${filePath}`);

    for await (const line of rl) {
      scanned += 1;
      const row = parseGeoNamesPostalLine(line);
      if (!row) {
        invalidRows += 1;
        continue;
      }
      if (!shouldIncludePostalRow(row, 'DE')) continue;

      const candidates = findPostalCandidates(indexes, row);
      const matchedCity = selectBestPostalCityCandidate(candidates, row);
      if (!matchedCity) {
        unmatchedRows += 1;
      } else {
        const cityId = String(matchedCity._id);
        const bucket = postalCodesByCityId.get(cityId) ?? new Set<string>();
        bucket.add(row.postalCode);
        postalCodesByCityId.set(cityId, bucket);
        matchedRows += 1;
      }

      if (scanned % SCAN_PROGRESS_EVERY === 0) {
        console.log(
          `… scan progress scanned=${scanned} matched=${matchedRows} unmatched=${unmatchedRows} invalid=${invalidRows} cities=${postalCodesByCityId.size}`,
        );
      }
    }

    let processed = 0;
    let updatedCities = 0;
    let writeSkipped = 0;

    for (const [cityId, postalCodes] of postalCodesByCityId.entries()) {
      processed += 1;
      const existing = indexes.byId.get(cityId);
      if (!existing) {
        writeSkipped += 1;
        continue;
      }

      const nextPostalCodes = mergePostalCodes(existing.postalCodes ?? [], Array.from(postalCodes));
      const currentPostalCodes = mergePostalCodes(existing.postalCodes ?? [], []);

      if (nextPostalCodes.length === currentPostalCodes.length && nextPostalCodes.every((value, index) => value === currentPostalCodes[index])) {
        writeSkipped += 1;
      } else {
        await withMongoRetry(
          `update postal codes for city ${cityId}`,
          () =>
            cityModel
              .updateOne(
                { _id: cityId },
                {
                  $set: {
                    postalCodes: nextPostalCodes,
                  },
                },
              )
              .exec(),
          retryOptions,
        );
        existing.postalCodes = nextPostalCodes;
        updatedCities += 1;
      }

      if (processed % WRITE_PROGRESS_EVERY === 0) {
        console.log(
          `… write progress processed=${processed}/${postalCodesByCityId.size} updated=${updatedCities} writeSkipped=${writeSkipped}`,
        );
      }
    }

    console.log(
      `✅ GeoNames postal import completed. scanned=${scanned} matched=${matchedRows} unmatched=${unmatchedRows} invalid=${invalidRows} cities=${postalCodesByCityId.size} updated=${updatedCities} writeSkipped=${writeSkipped}`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('❌ GeoNames postal import failed', error);
    process.exit(1);
  });
}
