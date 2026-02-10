// test/catalog.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';
import { ServiceCategory, ServiceCategoryDocument } from '../src/modules/catalog/services/schemas/service-category.schema';
import { Service, ServiceDocument } from '../src/modules/catalog/services/schemas/service.schema';
import { City, CityDocument } from '../src/modules/catalog/cities/schemas/city.schema';

jest.setTimeout(30000);

describe('catalog (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let categoryModel: Model<ServiceCategoryDocument>;
  let serviceModel: Model<ServiceDocument>;
  let cityModel: Model<CityDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    categoryModel = app.get(getModelToken(ServiceCategory.name));
    serviceModel = app.get(getModelToken(Service.name));
    cityModel = app.get(getModelToken(City.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([categoryModel.deleteMany({}), serviceModel.deleteMany({}), cityModel.deleteMany({})]);
  });

  it('GET /catalog/service-categories returns active categories', async () => {
    await categoryModel.create([
      { key: 'cleaning', name: 'Cleaning', isActive: true, sortOrder: 1 },
      { key: 'moving', name: 'Moving', isActive: false, sortOrder: 2 },
    ]);

    const res = await request(app.getHttpServer()).get('/catalog/service-categories').expect(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toMatchObject({ key: 'cleaning', isActive: true });
  });

  it('GET /catalog/services returns active services with optional category filter', async () => {
    await serviceModel.create([
      { key: 'home_cleaning', name: 'Home Cleaning', categoryKey: 'cleaning', isActive: true, sortOrder: 1 },
      { key: 'window_cleaning', name: 'Window Cleaning', categoryKey: 'cleaning', isActive: true, sortOrder: 2 },
      { key: 'moving_help', name: 'Moving Help', categoryKey: 'moving', isActive: true, sortOrder: 1 },
      { key: 'inactive', name: 'Inactive', categoryKey: 'cleaning', isActive: false, sortOrder: 3 },
    ]);

    const resAll = await request(app.getHttpServer()).get('/catalog/services').expect(200);
    expect(resAll.body.length).toBe(3);

    const resFiltered = await request(app.getHttpServer())
      .get('/catalog/services')
      .query({ category: 'cleaning' })
      .expect(200);

    expect(resFiltered.body.length).toBe(2);
    expect(resFiltered.body[0]).toMatchObject({ categoryKey: 'cleaning' });
  });

  it('GET /catalog/cities returns active cities by country', async () => {
    await cityModel.create([
      { key: 'city_berlin', name: 'Berlin', countryCode: 'DE', isActive: true, sortOrder: 1 },
      { key: 'city_hamburg', name: 'Hamburg', countryCode: 'DE', isActive: false, sortOrder: 2 },
      { key: 'city_paris', name: 'Paris', countryCode: 'FR', isActive: true, sortOrder: 1 },
    ]);

    const res = await request(app.getHttpServer())
      .get('/catalog/cities')
      .query({ countryCode: 'DE' })
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0]).toMatchObject({ key: 'city_berlin', countryCode: 'DE', isActive: true });
  });
});
