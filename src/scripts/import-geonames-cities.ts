import { createReadStream } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import * as readline from 'node:readline';

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppModule } from '../app.module';
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

const STATE_LABELS: Record<string, string> = {
  '01': 'Baden-Württemberg',
  '02': 'Bayern',
  '03': 'Berlin',
  '04': 'Brandenburg',
  '05': 'Bremen',
  '06': 'Hamburg',
  '07': 'Hessen',
  '08': 'Mecklenburg-Vorpommern',
  '09': 'Niedersachsen',
  '10': 'Nordrhein-Westfalen',
  '11': 'Rheinland-Pfalz',
  '12': 'Saarland',
  '13': 'Sachsen',
  '14': 'Sachsen-Anhalt',
  '15': 'Schleswig-Holstein',
  '16': 'Thüringen',
};

function normalizeSearchName(value: string): string {
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

function parseGeoNamesLine(line: string): GeoNamesRow | null {
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

function shouldInclude(row: GeoNamesRow): boolean {
  return row.countryCode === 'DE' && row.featureClass === 'P' && POPULATED_FEATURE_CODES.has(row.featureCode);
}

function toImportedCity(row: GeoNamesRow): ImportedCity | null {
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
    stateName: STATE_LABELS[row.admin1Code] ?? null,
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
  };
}

async function bootstrap() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: npm run import:cities:geonames -- /absolute/or/relative/path/to/DE.txt');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));

  const filePath = resolvePath(process.cwd(), inputPath);
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let scanned = 0;
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`🌱 Importing GeoNames cities from ${filePath}`);

  for await (const line of rl) {
    scanned += 1;
    const row = parseGeoNamesLine(line);
    if (!row || !shouldInclude(row)) {
      skipped += 1;
      continue;
    }

    const city = toImportedCity(row);
    if (!city) {
      skipped += 1;
      continue;
    }

    const result = await cityModel.updateOne(
      { source: city.source, sourceId: city.sourceId },
      {
        $set: city,
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    ).exec();

    if (result.upsertedCount > 0) {
      imported += 1;
    } else if (result.modifiedCount > 0 || result.matchedCount > 0) {
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  await app.close();
  console.log(`✅ GeoNames import completed. scanned=${scanned} inserted=${imported} updated=${updated} skipped=${skipped}`);
}

bootstrap().catch((error) => {
  console.error('❌ GeoNames import failed', error);
  process.exit(1);
});
