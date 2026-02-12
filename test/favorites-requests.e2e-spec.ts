// test/favorites-requests.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { Request as RequestEntity, RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { City, CityDocument } from '../src/modules/catalog/cities/schemas/city.schema';
import { Service, ServiceDocument } from '../src/modules/catalog/services/schemas/service.schema';
import { ServiceCategory, ServiceCategoryDocument } from '../src/modules/catalog/services/schemas/service-category.schema';

jest.setTimeout(30000);

describe('favorites requests (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let requestModel: Model<RequestDocument>;
  let cityModel: Model<CityDocument>;
  let serviceModel: Model<ServiceDocument>;
  let categoryModel: Model<ServiceCategoryDocument>;

  const categoryKey = 'cleaning';
  const serviceKey = 'home_cleaning';
  let cityId: string;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    requestModel = app.get(getModelToken(RequestEntity.name));
    cityModel = app.get(getModelToken(City.name));
    serviceModel = app.get(getModelToken(Service.name));
    categoryModel = app.get(getModelToken(ServiceCategory.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      requestModel.deleteMany({}),
      cityModel.deleteMany({}),
      serviceModel.deleteMany({}),
      categoryModel.deleteMany({}),
    ]);

    const city = await cityModel.create({ key: 'frankfurt', name: 'Frankfurt am Main', isActive: true });
    cityId = String(city._id);

    await categoryModel.create({ key: categoryKey, name: 'Cleaning', isActive: true });
    await serviceModel.create({
      key: serviceKey,
      categoryKey,
      name: 'Home cleaning',
      isActive: true,
    });
  });

  it('provider can add/list/remove favorite request', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-fav1@test.local', 'Client Fav');
    const provider = await registerAndGetToken(app, 'provider', 'provider-fav1@test.local', 'Provider Fav');

    const createRes = await request(app.getHttpServer())
      .post('/requests/my')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        title: 'Test request',
        serviceKey,
        cityId,
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-02-01T10:00:00.000Z',
        isRecurring: false,
      })
      .expect(201);

    const requestId = createRes.body?.id;
    expect(requestId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/requests/my/${requestId}/publish`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/favorites/requests/${requestId}`)
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/favorites/requests')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    expect(listRes.body.find((x: any) => x.id === requestId)).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/favorites/requests/${requestId}`)
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    const listAfter = await request(app.getHttpServer())
      .get('/favorites/requests')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    expect(listAfter.body.find((x: any) => x.id === requestId)).toBeFalsy();
  });

  it('client cannot add favorites (403)', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-fav2@test.local', 'Client Fav 2');
    await request(app.getHttpServer())
      .post('/favorites/requests/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(403);
  });
});
