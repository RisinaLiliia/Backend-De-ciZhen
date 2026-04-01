import { createReadStream } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import * as readline from 'node:readline';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { City, type CityDocument } from '../modules/catalog/cities/schemas/city.schema';

type GeoNamesRow = {
  geonameId: string;
  name: string;
  asciiName: string;
  alternateNames: string[];
  lat: number;
  lng: number;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  admin1Code: string;
  admin2Code: string;
  population: number | null;
};

type ImportedCity = {
  key: string;
  source: 'geonames';
  sourceId: string;
  name: string;
  normalizedName: string;
  aliases: string[];
  normalizedAliases: string[];
  i18n: Record<string, string>;
  countryCode: string;
  stateCode: string | null;
  stateName: string | null;
  districtName: string | null;
  postalCodes: string[];
  population: number | null;
  lat: number;
  lng: number;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  isActive: boolean;
  sortOrder: number;
};

type ImportAccumulator = ImportedCity & {
  featureCode: string;
};

type CityUpsertPayload = Omit<ImportedCity, 'source' | 'sourceId'> & {
  source: string;
  sourceId: string | null;
};

type KeyReservation = {
  docId: string | null;
  source: string | null;
  sourceId: string | null;
  name: string | null;
};

type KeyReservationSource = {
  _id?: { toString?: () => string } | string | null;
  source?: string | null;
  sourceId?: string | null;
  name?: string | null;
};

type RetryOptions = {
  attempts: number;
  baseDelayMs: number;
};

const POPULATED_FEATURE_CODES = new Set([
  'PPL',
  'PPLA',
  'PPLA2',
  'PPLA3',
  'PPLA4',
  'PPLC',
  'PPLF',
  'PPLG',
  'PPLL',
  'PPLR',
  'PPLS',
  'STLMT',
]);

export const GEO_NAMES_DE_STATE_LABELS: Record<string, string> = {
  '01': 'Baden-Württemberg',
  '02': 'Bayern',
  '03': 'Bremen',
  '04': 'Hamburg',
  '05': 'Hessen',
  '06': 'Niedersachsen',
  '07': 'Nordrhein-Westfalen',
  '08': 'Rheinland-Pfalz',
  '09': 'Saarland',
  '10': 'Schleswig-Holstein',
  '11': 'Brandenburg',
  '12': 'Mecklenburg-Vorpommern',
  '13': 'Sachsen',
  '14': 'Sachsen-Anhalt',
  '15': 'Thüringen',
  '16': 'Berlin',
};

const SCAN_PROGRESS_EVERY = 10000;
const WRITE_PROGRESS_EVERY = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableMongoError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const queue: unknown[] = [error];
  const retryableNames = new Set([
    'MongoServerSelectionError',
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
    'MongoTimeoutError',
    'MongooseServerSelectionError',
  ]);
  const retryableLabels = new Set([
    'ResetPool',
    'InterruptInUseConnections',
    'RetryableWriteError',
    'TransientTransactionError',
  ]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    const candidate = current as {
      name?: string;
      message?: string;
      cause?: unknown;
      reason?: unknown;
      errorLabelSet?: Set<string>;
    };

    if (retryableNames.has(String(candidate.name ?? ''))) return true;

    const message = String(candidate.message ?? '').toLowerCase();
    if (
      message.includes('server selection')
      || message.includes('timed out')
      || message.includes('econnreset')
      || message.includes('connection')
    ) {
      return true;
    }

    const labels = candidate.errorLabelSet;
    if (labels && Array.from(labels).some((label) => retryableLabels.has(label))) {
      return true;
    }

    if (candidate.cause) queue.push(candidate.cause);
    if (candidate.reason) queue.push(candidate.reason);
  }

  return false;
}

export async function withMongoRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let attempt = 1;

  for (;;) {
    try {
      return await fn();
    } catch (error) {
      const canRetry = attempt < options.attempts && isRetryableMongoError(error);
      if (!canRetry) throw error;

      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `… ${operationName} retry ${attempt}/${options.attempts - 1} after ${delayMs}ms (${error instanceof Error ? error.name : 'UnknownError'})`,
      );
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

export function normalizeSearchName(value: string): string {
  return value
    .replace(/ß/g, 'ss')
    .replace(/ä/gi, (match) => (match === 'Ä' ? 'Ae' : 'ae'))
    .replace(/ö/gi, (match) => (match === 'Ö' ? 'Oe' : 'oe'))
    .replace(/ü/gi, (match) => (match === 'Ü' ? 'Ue' : 'ue'))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function toKey(value: string): string {
  return normalizeSearchName(value).replace(/\s+/g, '_').slice(0, 80);
}

export function parseGeoNamesLine(line: string): GeoNamesRow | null {
  const parts = line.split('\t');
  if (parts.length < 15) return null;

  const lat = Number(parts[4]);
  const lng = Number(parts[5]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    geonameId: parts[0] ?? '',
    name: (parts[1] ?? '').trim(),
    asciiName: (parts[2] ?? '').trim(),
    alternateNames: String(parts[3] ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    lat,
    lng,
    featureClass: (parts[6] ?? '').trim(),
    featureCode: (parts[7] ?? '').trim(),
    countryCode: (parts[8] ?? '').trim().toUpperCase(),
    admin1Code: (parts[10] ?? '').trim(),
    admin2Code: (parts[11] ?? '').trim(),
    population: Number.isFinite(Number(parts[14])) ? Number(parts[14]) : null,
  };
}

export function shouldInclude(row: GeoNamesRow): boolean {
  return row.countryCode === 'DE' && row.featureClass === 'P' && POPULATED_FEATURE_CODES.has(row.featureCode);
}

export function toImportedCity(row: GeoNamesRow): ImportAccumulator | null {
  const name = row.name || row.asciiName;
  if (!name) return null;

  const aliases = Array.from(
    new Set([name, row.asciiName, ...row.alternateNames].filter((item) => item.trim().length > 0)),
  ).slice(0, 50);
  const normalizedAliases = Array.from(new Set(aliases.map(normalizeSearchName).filter((item) => item.length > 0)));
  const normalizedName = normalizeSearchName(name);
  if (!normalizedName) return null;

  return {
    key: toKey(name),
    source: 'geonames',
    sourceId: row.geonameId,
    name,
    normalizedName,
    aliases,
    normalizedAliases,
    i18n: { de: name, en: row.asciiName || name },
    countryCode: row.countryCode,
    stateCode: row.admin1Code || null,
    stateName: GEO_NAMES_DE_STATE_LABELS[row.admin1Code] ?? null,
    districtName: row.admin2Code || null,
    postalCodes: [],
    population: row.population,
    lat: row.lat,
    lng: row.lng,
    location: {
      type: 'Point',
      coordinates: [row.lng, row.lat],
    },
    isActive: true,
    sortOrder: 999,
    featureCode: row.featureCode,
  };
}

export function cityIdentityKey(city: Pick<ImportedCity, 'countryCode' | 'name'>): string {
  return `${city.countryCode}:${city.name}`.toLowerCase();
}

function featureRank(featureCode: string): number {
  switch (featureCode) {
    case 'PPLC':
      return 110;
    case 'PPLA':
      return 100;
    case 'PPLA2':
      return 90;
    case 'PPLA3':
      return 80;
    case 'PPLA4':
      return 70;
    case 'PPL':
      return 60;
    case 'PPLG':
      return 50;
    case 'PPLF':
      return 40;
    case 'PPLL':
      return 30;
    case 'PPLR':
      return 20;
    case 'PPLS':
      return 10;
    default:
      return 0;
  }
}

export function mergeCities(current: ImportAccumulator, candidate: ImportAccumulator): ImportAccumulator {
  const currentPopulation = current.population ?? -1;
  const candidatePopulation = candidate.population ?? -1;
  const winner =
    candidatePopulation > currentPopulation
      ? candidate
      : candidatePopulation < currentPopulation
        ? current
        : featureRank(candidate.featureCode) > featureRank(current.featureCode)
          ? candidate
          : featureRank(candidate.featureCode) < featureRank(current.featureCode)
            ? current
            : candidate.sourceId < current.sourceId
              ? candidate
              : current;
  const loser = winner === current ? candidate : current;

  const aliases = Array.from(new Set([...winner.aliases, ...loser.aliases])).slice(0, 50);
  const normalizedAliases = Array.from(
    new Set([...winner.normalizedAliases, ...loser.normalizedAliases].filter((item) => item.length > 0)),
  );

  return {
    ...winner,
    aliases,
    normalizedAliases,
  };
}

function toUpdatePayload(existing: CityDocument | null, city: ImportAccumulator): CityUpsertPayload {
  const buildBasePayload = (params: {
    key: string;
    source: string;
    sourceId: string | null;
    sortOrder: number;
    aliases: string[];
    normalizedAliases: string[];
  }): CityUpsertPayload => ({
    key: params.key,
    source: params.source,
    sourceId: params.sourceId,
    name: city.name,
    normalizedName: city.normalizedName,
    aliases: params.aliases,
    normalizedAliases: params.normalizedAliases,
    i18n: city.i18n,
    countryCode: city.countryCode,
    stateCode: city.stateCode,
    stateName: city.stateName,
    districtName: city.districtName,
    postalCodes: city.postalCodes,
    population: city.population,
    lat: city.lat,
    lng: city.lng,
    location: city.location,
    isActive: city.isActive,
    sortOrder: params.sortOrder,
  });

  if (!existing || existing.source === city.source) {
    return buildBasePayload({
      key: city.key,
      source: city.source,
      sourceId: city.sourceId,
      sortOrder: city.sortOrder,
      aliases: city.aliases,
      normalizedAliases: city.normalizedAliases,
    });
  }

  const aliases = Array.from(new Set([...(existing.aliases ?? []), ...city.aliases])).slice(0, 50);
  const normalizedAliases = Array.from(
    new Set([...(existing.normalizedAliases ?? []), ...city.normalizedAliases].filter((item) => item.length > 0)),
  );

  return buildBasePayload({
    key: existing.key,
    source: existing.source,
    sourceId: existing.sourceId ?? null,
    sortOrder: existing.sortOrder ?? city.sortOrder,
    aliases,
    normalizedAliases,
  });
}

function toKeyReservation(doc: KeyReservationSource | null | undefined): KeyReservation | null {
  if (!doc) return null;

  return {
    docId: doc._id?.toString?.() ?? null,
    source: typeof doc.source === 'string' ? doc.source : null,
    sourceId: typeof doc.sourceId === 'string' ? doc.sourceId : null,
    name: typeof doc.name === 'string' ? doc.name : null,
  };
}

function reservationsMatch(
  reservation: KeyReservation | null | undefined,
  params: { docId?: string | null; source: string; sourceId: string; name: string },
): boolean {
  if (!reservation) return false;
  if (reservation.docId && params.docId && reservation.docId === params.docId) return true;
  if (reservation.source === params.source && reservation.sourceId === params.sourceId) return true;
  return String(reservation.name ?? '').trim().toLowerCase() === params.name.trim().toLowerCase();
}

export async function resolveUniqueImportKey(params: {
  cityModel: Model<CityDocument>;
  existing: CityDocument | null;
  city: ImportAccumulator;
  reservedKeys: Map<string, KeyReservation>;
  findExistingByKey?: (key: string) => Promise<KeyReservationSource | null>;
}): Promise<string> {
  const { cityModel, existing, city, reservedKeys, findExistingByKey } = params;

  if (existing?.key && existing.key.trim().length > 0) {
    const existingReservation = toKeyReservation(existing);
    if (existingReservation) {
      reservedKeys.set(existing.key, existingReservation);
    }
    return existing.key;
  }

  const baseKey = city.key;
  let candidateKey = baseKey;
  let suffix = 1;
  const identity = {
    docId: existing?._id?.toString?.() ?? null,
    source: city.source,
    sourceId: city.sourceId,
    name: city.name,
  };

  for (;;) {
    const reserved = reservedKeys.get(candidateKey);
    if (reservationsMatch(reserved, identity)) {
      return candidateKey;
    }

    if (!reserved) {
      const conflicting = findExistingByKey
        ? await findExistingByKey(candidateKey)
        : await cityModel
            .findOne({ key: candidateKey })
            .select('_id key source sourceId name')
            .lean()
            .exec();
      const dbReservation = toKeyReservation(conflicting as KeyReservationSource | null);
      if (!dbReservation) {
        reservedKeys.set(candidateKey, {
          docId: identity.docId,
          source: identity.source,
          sourceId: identity.sourceId,
          name: identity.name,
        });
        return candidateKey;
      }

      reservedKeys.set(candidateKey, dbReservation);
      if (reservationsMatch(dbReservation, identity)) {
        return candidateKey;
      }
    }

    suffix += 1;
    if (suffix > 200) {
      throw new Error(`Unable to resolve unique city key for "${city.name}"`);
    }
    candidateKey = `${baseKey}_${suffix}`;
  }
}

export async function bootstrap() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: npm run import:cities:geonames -- /absolute/or/relative/path/to/DE.txt');
  }

  const { AppModule } = await import('../app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));
  const config = app.get(ConfigService);
  const retryOptions: RetryOptions = {
    attempts: Number(config.get<number>('app.geoNamesImportRetryAttempts') ?? 5),
    baseDelayMs: Number(config.get<number>('app.geoNamesImportRetryBaseDelayMs') ?? 1000),
  };

  const filePath = resolvePath(process.cwd(), inputPath);
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let scanned = 0;
  let imported = 0;
  let updated = 0;
  let deduplicated = 0;
  let scanSkipped = 0;
  let writeSkipped = 0;

  console.log(`🌱 Importing GeoNames cities from ${filePath}`);

  const uniqueCities = new Map<string, ImportAccumulator>();

  for await (const line of rl) {
    scanned += 1;
    const row = parseGeoNamesLine(line);
    if (!row || !shouldInclude(row)) {
      scanSkipped += 1;
    } else {
      const city = toImportedCity(row);
      if (!city) {
        scanSkipped += 1;
      } else {
        const identityKey = cityIdentityKey(city);
        const existingCandidate = uniqueCities.get(identityKey);
        if (existingCandidate) {
          uniqueCities.set(identityKey, mergeCities(existingCandidate, city));
          deduplicated += 1;
        } else {
          uniqueCities.set(identityKey, city);
        }
      }
    }

    if (scanned % SCAN_PROGRESS_EVERY === 0) {
      console.log(
        `… scan progress scanned=${scanned} unique=${uniqueCities.size} deduplicated=${deduplicated} scanSkipped=${scanSkipped}`,
      );
    }
  }

  console.log(
    `🧮 Deduplicated import set ready. unique=${uniqueCities.size} deduplicated=${deduplicated} scanSkipped=${scanSkipped}`,
  );

  let processed = 0;
  const reservedKeys = new Map<string, KeyReservation>();

  try {
    for (const city of uniqueCities.values()) {
      processed += 1;
      const existing = await withMongoRetry(
        `lookup existing city ${city.name}`,
        () =>
          cityModel
            .findOne({
              $or: [
                { source: city.source, sourceId: city.sourceId },
                { countryCode: city.countryCode, name: city.name },
              ],
            })
            .exec(),
        retryOptions,
      );

      const filter = existing
        ? { _id: existing._id }
        : { source: city.source, sourceId: city.sourceId };
      const payload = toUpdatePayload(existing, city);
      payload.key = await resolveUniqueImportKey({
        cityModel,
        existing,
        city,
        reservedKeys,
        findExistingByKey: (key) =>
          withMongoRetry(
            `check key collision ${key}`,
            () =>
              cityModel
                .findOne({ key })
                .select('_id key source sourceId name')
                .lean()
                .exec(),
            retryOptions,
          ),
      });

      const result = await withMongoRetry(
        `upsert city ${city.name}`,
        () =>
          cityModel
            .updateOne(
              filter,
              {
                $set: payload,
                $setOnInsert: {
                  createdAt: new Date(),
                },
              },
              { upsert: true },
            )
            .exec(),
        retryOptions,
      );

      if (result.upsertedCount > 0) {
        imported += 1;
      } else if (result.modifiedCount > 0 || result.matchedCount > 0) {
        updated += 1;
      } else {
        writeSkipped += 1;
      }

      if (processed % WRITE_PROGRESS_EVERY === 0) {
        console.log(
          `… write progress processed=${processed}/${uniqueCities.size} inserted=${imported} updated=${updated} writeSkipped=${writeSkipped}`,
        );
      }
    }
  } finally {
    await app.close();
  }
  console.log(
    `✅ GeoNames import completed. scanned=${scanned} unique=${uniqueCities.size} inserted=${imported} updated=${updated} deduplicated=${deduplicated} scanSkipped=${scanSkipped} writeSkipped=${writeSkipped}`,
  );
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('❌ GeoNames import failed', error);
    process.exit(1);
  });
}
