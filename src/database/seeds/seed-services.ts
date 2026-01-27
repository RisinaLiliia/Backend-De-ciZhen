// src/database/seeds/seed-services.ts
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import {
  Service,
  ServiceDocument,
} from '../../modules/catalog/services/schemas/service.schema';
import {
  ServiceCategory,
  ServiceCategoryDocument,
} from '../../modules/catalog/services/schemas/service-category.schema';

const CATEGORIES = [
  { key: 'beauty', name: 'Beauty', sortOrder: 10 },
  { key: 'cleaning', name: 'Cleaning', sortOrder: 20 },
  { key: 'repair', name: 'Repair', sortOrder: 30 },
];

const SERVICES = [
  { key: 'haircut_men', name: 'Men haircut', categoryKey: 'beauty', sortOrder: 10 },
  { key: 'haircut_women', name: 'Women haircut', categoryKey: 'beauty', sortOrder: 20 },
  { key: 'home_cleaning', name: 'Home cleaning', categoryKey: 'cleaning', sortOrder: 10 },
  { key: 'handyman', name: 'Handyman', categoryKey: 'repair', sortOrder: 10 },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const categoryModel = app.get<Model<ServiceCategoryDocument>>(
    getModelToken(ServiceCategory.name),
  );
  const serviceModel = app.get<Model<ServiceDocument>>(
    getModelToken(Service.name),
  );

  console.log('🌱 Seeding service categories...');
  for (const c of CATEGORIES) {
    const exists = await categoryModel.findOne({ key: c.key }).exec();
    if (!exists) {
      await categoryModel.create({ ...c, isActive: true });
      console.log(`✓ ${c.key} inserted`);
    } else {
      console.log(`↺ ${c.key} already exists — skipped`);
    }
  }

  console.log('🌱 Seeding services...');
  for (const s of SERVICES) {
    const exists = await serviceModel.findOne({ key: s.key }).exec();
    if (!exists) {
      await serviceModel.create({ ...s, isActive: true });
      console.log(`✓ ${s.key} inserted`);
    } else {
      console.log(`↺ ${s.key} already exists — skipped`);
    }
  }

  await app.close();
  console.log('✅ Services seed completed');
}

seed().catch((e) => {
  console.error('❌ Services seed failed', e);
  process.exit(1);
});

