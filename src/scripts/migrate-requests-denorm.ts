// src/scripts/migrate-requests-denorm.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Request, RequestDocument } from '../modules/requests/schemas/request.schema';
import { City, CityDocument } from '../modules/catalog/cities/schemas/city.schema';
import { Service, ServiceDocument } from '../modules/catalog/services/schemas/service.schema';
import { ServiceCategory, ServiceCategoryDocument } from '../modules/catalog/services/schemas/service-category.schema';

type CitySnapshot = { id: string; name?: string; key?: string; i18n?: Record<string, string> };
type ServiceSnapshot = { key: string; name?: string; categoryKey?: string; i18n?: Record<string, string> };
type CategorySnapshot = { key: string; name?: string; i18n?: Record<string, string> };

function pickName(name?: string, i18n?: Record<string, string>, key?: string): string | null {
  return name ?? i18n?.en ?? key ?? null;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const requestModel = app.get<Model<RequestDocument>>(getModelToken(Request.name));
  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));
  const serviceModel = app.get<Model<ServiceDocument>>(getModelToken(Service.name));
  const categoryModel = app.get<Model<ServiceCategoryDocument>>(getModelToken(ServiceCategory.name));

  const cities = await cityModel.find({}).lean();
  const services = await serviceModel.find({}).lean();
  const categories = await categoryModel.find({}).lean();

  const cityById = new Map<string, CitySnapshot>();
  for (const c of cities) {
    cityById.set(String(c._id), { id: String(c._id), name: c.name, key: c.key, i18n: c.i18n as any });
  }

  const serviceByKey = new Map<string, ServiceSnapshot>();
  for (const s of services) {
    serviceByKey.set(String(s.key).toLowerCase(), {
      key: String(s.key).toLowerCase(),
      name: s.name,
      categoryKey: s.categoryKey,
      i18n: s.i18n as any,
    });
  }

  const categoryByKey = new Map<string, CategorySnapshot>();
  for (const c of categories) {
    categoryByKey.set(String(c.key).toLowerCase(), {
      key: String(c.key).toLowerCase(),
      name: c.name,
      i18n: c.i18n as any,
    });
  }

  let scanned = 0;
  let updated = 0;

  const cursor = requestModel.find({}).cursor();
  for await (const doc of cursor) {
    scanned += 1;

    const serviceKey = String(doc.serviceKey ?? '').toLowerCase();
    const service = serviceByKey.get(serviceKey);
    const categoryKey = (doc as any).categoryKey ?? service?.categoryKey ?? null;
    const category = categoryKey ? categoryByKey.get(String(categoryKey).toLowerCase()) : null;

    const city = cityById.get(String(doc.cityId));

    const title =
      typeof (doc as any).title === 'string' && (doc as any).title.trim().length > 0
        ? (doc as any).title.trim()
        : pickName(service?.name, service?.i18n, service?.key) ?? 'Service request';

    const cityName =
      typeof (doc as any).cityName === 'string' && (doc as any).cityName.trim().length > 0
        ? (doc as any).cityName.trim()
        : pickName(city?.name, city?.i18n, city?.key) ?? String(doc.cityId ?? '');

    const categoryName =
      typeof (doc as any).categoryName === 'string' && (doc as any).categoryName.trim().length > 0
        ? (doc as any).categoryName.trim()
        : pickName(category?.name, category?.i18n, category?.key);

    const subcategoryName =
      typeof (doc as any).subcategoryName === 'string' && (doc as any).subcategoryName.trim().length > 0
        ? (doc as any).subcategoryName.trim()
        : pickName(service?.name, service?.i18n, service?.key);

    const description =
      typeof (doc as any).description === 'string' && (doc as any).description.trim().length > 0
        ? (doc as any).description.trim()
        : null;

    const photos = Array.isArray((doc as any).photos) ? (doc as any).photos : [];
    const tags = Array.isArray((doc as any).tags) ? (doc as any).tags : [];

    const imageUrl =
      typeof (doc as any).imageUrl === 'string' && (doc as any).imageUrl.trim().length > 0
        ? (doc as any).imageUrl.trim()
        : photos[0] ?? null;

    const searchText =
      typeof (doc as any).searchText === 'string' && (doc as any).searchText.trim().length > 0
        ? (doc as any).searchText.trim()
        : [title, description, tags.join(' '), cityName, categoryName, subcategoryName]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

    const set: Record<string, any> = {};
    if ((doc as any).title !== title) set.title = title;
    if ((doc as any).cityName !== cityName) set.cityName = cityName;
    if ((doc as any).categoryKey !== categoryKey && categoryKey) set.categoryKey = categoryKey;
    if ((doc as any).categoryName !== categoryName) set.categoryName = categoryName;
    if ((doc as any).subcategoryName !== subcategoryName) set.subcategoryName = subcategoryName;
    if ((doc as any).description !== description) set.description = description;
    if (!Array.isArray((doc as any).photos)) set.photos = photos;
    if ((doc as any).imageUrl !== imageUrl) set.imageUrl = imageUrl;
    if (!Array.isArray((doc as any).tags)) set.tags = tags;
    if ((doc as any).searchText !== searchText) set.searchText = searchText;

    if (Object.keys(set).length > 0) {
      await requestModel.updateOne({ _id: doc._id }, { $set: set }).exec();
      updated += 1;
    }
  }

  console.log(`✅ Requests denorm migration done. Scanned=${scanned}, Updated=${updated}`);
  await app.close();
}

main().catch((e) => {
  console.error('❌ Requests denorm migration failed', e);
  process.exit(1);
});
