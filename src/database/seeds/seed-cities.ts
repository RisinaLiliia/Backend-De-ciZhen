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
};

const CITIES: SeedCity[] = [
  {
    key: 'berlin',
    name: 'Berlin',
    countryCode: 'DE',
    sortOrder: 1,
    i18n: { de: 'Berlin', en: 'Berlin' },
  },
  {
    key: 'hamburg',
    name: 'Hamburg',
    countryCode: 'DE',
    sortOrder: 2,
    i18n: { de: 'Hamburg', en: 'Hamburg' },
  },
  {
    key: 'munich',
    name: 'Munich',
    countryCode: 'DE',
    sortOrder: 3,
    i18n: { de: 'Muenchen', en: 'Munich' },
  },
  {
    key: 'karlsruhe',
    name: 'Karlsruhe',
    countryCode: 'DE',
    sortOrder: 4,
    i18n: { de: 'Karlsruhe', en: 'Karlsruhe' },
  },
  {
    key: 'baden-baden',
    name: 'Baden-Baden',
    countryCode: 'DE',
    sortOrder: 5,
    i18n: { de: 'Baden-Baden', en: 'Baden-Baden' },
  },
];

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
        !existing.i18n ||
        existing.i18n.de !== city.i18n.de ||
        existing.i18n.en !== city.i18n.en;

      if (!hasChanges) {
        console.log(`↺ ${city.name} already exists — skipped`);
        continue;
      }

      existing.key = normalizedKey;
      existing.name = city.name;
      existing.sortOrder = city.sortOrder;
      existing.countryCode = city.countryCode;
      existing.isActive = true;
      existing.i18n = city.i18n;
      await existing.save();

      console.log(`↺ ${city.name} updated`);
      continue;
    }

    await cityModel.create({
      key: normalizedKey,
      name: city.name,
      i18n: city.i18n,
      countryCode: city.countryCode,
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
