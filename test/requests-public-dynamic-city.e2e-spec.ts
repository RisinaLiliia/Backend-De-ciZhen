// test/requests-public-dynamic-city.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';
import { City, CityDocument } from '../src/modules/catalog/cities/schemas/city.schema';
import { Service, ServiceDocument } from '../src/modules/catalog/services/schemas/service.schema';
import { ServiceCategory, ServiceCategoryDocument } from '../src/modules/catalog/services/schemas/service-category.schema';

jest.setTimeout(30000);

describe('requests public create with dynamic city (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let cityModel: Model<CityDocument>;
  let serviceModel: Model<ServiceDocument>;
  let categoryModel: Model<ServiceCategoryDocument>;

  const categoryKey = 'cleaning';
  const serviceKey = 'home_cleaning';

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    cityModel = app.get(getModelToken(City.name));
    serviceModel = app.get(getModelToken(Service.name));
    categoryModel = app.get(getModelToken(ServiceCategory.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      cityModel.deleteMany({}),
      serviceModel.deleteMany({}),
      categoryModel.deleteMany({}),
    ]);

    await categoryModel.create({ key: categoryKey, name: 'Cleaning', isActive: true });
    await serviceModel.create({
      key: serviceKey,
      categoryKey,
      name: 'Home cleaning',
      isActive: true,
    });
  });

  it('POST /requests creates city when cityId missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/requests')
      .send({
        title: 'Test request',
        serviceKey,
        cityName: 'Ulm',
        lat: 48.3984,
        lng: 9.9916,
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-02-01T10:00:00.000Z',
        isRecurring: false,
      })
      .expect(201);

    expect(res.body.cityId).toBeTruthy();
    expect(res.body.cityName).toBe('Ulm');
    expect(res.body.location).toEqual({
      type: 'Point',
      coordinates: [9.9916, 48.3984],
    });

    const city = await cityModel.findOne({ name: 'Ulm' }).exec();
    expect(city).toBeTruthy();
    expect(city?.isActive).toBe(false);
  });

  it('POST /requests creates city when cityId is unknown and cityName provided', async () => {
    const res = await request(app.getHttpServer())
      .post('/requests')
      .send({
        title: 'Test request',
        serviceKey,
        cityId: 'unknown-id',
        cityName: 'Augsburg',
        lat: 48.3705,
        lng: 10.8978,
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-02-01T10:00:00.000Z',
        isRecurring: false,
      })
      .expect(201);

    expect(res.body.cityId).toBeTruthy();
    expect(res.body.cityId).not.toBe('unknown-id');
    expect(res.body.cityName).toBe('Augsburg');

    const city = await cityModel.findOne({ name: 'Augsburg' }).exec();
    expect(city).toBeTruthy();
    expect(city?.isActive).toBe(false);
    expect(String(city?._id)).toBe(res.body.cityId);
  });
});
