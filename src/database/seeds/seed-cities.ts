// src/database/seeds/seed-cities.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { City, CityDocument } from '../../modules/catalog/cities/schemas/city.schema';

type SeedCity = {
  key: string;
  name: string;
  countryCode: string;
  sortOrder: number;
  i18n: Record<string, string>;
  source: string;
  sourceId: string | null;
  aliases: string[];
  stateCode: string | null;
  stateName: string | null;
  population: number | null;
  lat: number;
  lng: number;
};

const CITIES: SeedCity[] = [
  {
    key: 'berlin',
    name: 'Berlin',
    countryCode: 'DE',
    sortOrder: 1,
    i18n: { de: 'Berlin', en: 'Berlin' },
    source: 'manual_seed',
    sourceId: null,
    aliases: ['Berlin'],
    stateCode: 'BE',
    stateName: 'Berlin',
    population: 3669491,
    lat: 52.52,
    lng: 13.405,
  },
  {
    key: 'hamburg',
    name: 'Hamburg',
    countryCode: 'DE',
    sortOrder: 2,
    i18n: { de: 'Hamburg', en: 'Hamburg' },
    source: 'manual_seed',
    sourceId: null,
    aliases: ['Hamburg'],
    stateCode: 'HH',
    stateName: 'Hamburg',
    population: 1841179,
    lat: 53.5511,
    lng: 9.9937,
  },
  {
    key: 'munich',
    name: 'Munich',
    countryCode: 'DE',
    sortOrder: 3,
    i18n: { de: 'Muenchen', en: 'Munich' },
    source: 'manual_seed',
    sourceId: null,
    aliases: ['München', 'Munich', 'Muenchen'],
    stateCode: 'BY',
    stateName: 'Bayern',
    population: 1488202,
    lat: 48.1351,
    lng: 11.582,
  },
  {
    key: 'karlsruhe',
    name: 'Karlsruhe',
    countryCode: 'DE',
    sortOrder: 4,
    i18n: { de: 'Karlsruhe', en: 'Karlsruhe' },
    source: 'manual_seed',
    sourceId: null,
    aliases: ['Karlsruhe'],
    stateCode: 'BW',
    stateName: 'Baden-Württemberg',
    population: 308436,
    lat: 49.0069,
    lng: 8.4037,
  },
  {
    key: 'baden-baden',
    name: 'Baden-Baden',
    countryCode: 'DE',
    sortOrder: 5,
    i18n: { de: 'Baden-Baden', en: 'Baden-Baden' },
    source: 'manual_seed',
    sourceId: null,
    aliases: ['Baden-Baden'],
    stateCode: 'BW',
    stateName: 'Baden-Württemberg',
    population: 55527,
    lat: 48.7606,
    lng: 8.2398,
  },
];

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

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));

  console.log('🌱 Seeding cities...');

  for (const city of CITIES) {
    const normalizedKey = city.key.trim().toLowerCase();

    const existing = await cityModel
      .findOne({
        countryCode: city.countryCode,
        $or: [{ key: normalizedKey }, { name: city.name }],
      })
      .exec();

    if (existing) {
      const hasChanges =
        existing.key !== normalizedKey ||
      existing.name !== city.name ||
      existing.sortOrder !== city.sortOrder ||
      existing.isActive !== true ||
      existing.source !== city.source ||
      existing.sourceId !== city.sourceId ||
      existing.normalizedName !== normalizeSearchName(city.name) ||
      JSON.stringify(existing.aliases ?? []) !== JSON.stringify(city.aliases) ||
      JSON.stringify(existing.normalizedAliases ?? []) !== JSON.stringify(city.aliases.map(normalizeSearchName)) ||
      existing.stateCode !== city.stateCode ||
      existing.stateName !== city.stateName ||
      existing.population !== city.population ||
      existing.lat !== city.lat ||
      existing.lng !== city.lng ||
      !existing.i18n ||
      existing.i18n.de !== city.i18n.de ||
      existing.i18n.en !== city.i18n.en;

      if (!hasChanges) {
        console.log(`↺ ${city.name} already exists — skipped`);
        continue;
      }

      existing.key = normalizedKey;
      existing.source = city.source;
      existing.sourceId = city.sourceId;
      existing.name = city.name;
      existing.normalizedName = normalizeSearchName(city.name);
      existing.aliases = city.aliases;
      existing.normalizedAliases = city.aliases.map(normalizeSearchName);
      existing.stateCode = city.stateCode;
      existing.stateName = city.stateName;
      existing.population = city.population;
      existing.sortOrder = city.sortOrder;
      existing.countryCode = city.countryCode;
      existing.lat = city.lat;
      existing.lng = city.lng;
      existing.location = { type: 'Point', coordinates: [city.lng, city.lat] };
      existing.isActive = true;
      existing.i18n = city.i18n;
      await existing.save();

      console.log(`↺ ${city.name} updated`);
      continue;
    }

    await cityModel.create({
      key: normalizedKey,
      source: city.source,
      sourceId: city.sourceId,
      name: city.name,
      normalizedName: normalizeSearchName(city.name),
      aliases: city.aliases,
      normalizedAliases: city.aliases.map(normalizeSearchName),
      i18n: city.i18n,
      countryCode: city.countryCode,
      stateCode: city.stateCode,
      stateName: city.stateName,
      population: city.population,
      lat: city.lat,
      lng: city.lng,
      location: { type: 'Point', coordinates: [city.lng, city.lat] },
      sortOrder: city.sortOrder,
      isActive: true,
    });

    console.log(`✓ ${city.name} inserted`);
  }

  await app.close();
  console.log('✅ Cities seed completed');
}

bootstrap().catch((err) => {
  console.error('❌ Cities seed failed', err);
  process.exit(1);
});
