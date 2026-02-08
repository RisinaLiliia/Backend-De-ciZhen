// test/requests-my.e2e-spec.ts
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

describe('v6.2 requests /my publish flow (e2e)', () => {
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

  it('POST /requests/my creates draft, publish moves to published and appears in public list', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-req1@test.local', 'Client One');

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
        comment: 'hello',
        description: 'details',
        photos: ['https://cdn.example.com/req/1.jpg'],
        tags: ['IKEA', 'assembly'],
      })
      .expect(201);

    expect(createRes.body).toMatchObject({
      title: 'Test request',
      serviceKey,
      cityId,
      status: 'draft',
      description: 'details',
      photos: ['https://cdn.example.com/req/1.jpg'],
      imageUrl: 'https://cdn.example.com/req/1.jpg',
      tags: ['ikea', 'assembly'],
    });

    const requestId = createRes.body?.id;
    expect(requestId).toBeTruthy();

    const publicBefore = await request(app.getHttpServer())
      .get('/requests/public')
      .query({ cityId, serviceKey })
      .expect(200);

    expect(publicBefore.body.items.find((x: any) => x.id === requestId)).toBeFalsy();

    const publishRes = await request(app.getHttpServer())
      .post(`/requests/my/${requestId}/publish`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(publishRes.body).toMatchObject({
      id: requestId,
      status: 'published',
    });

    const publicAfter = await request(app.getHttpServer())
      .get('/requests/public')
      .query({ cityId, serviceKey })
      .expect(200);

    expect(publicAfter.body.items.find((x: any) => x.id === requestId)).toBeTruthy();

    const myPublished = await request(app.getHttpServer())
      .get('/requests/my')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .query({ status: 'published' })
      .expect(200);

    expect(myPublished.body.find((x: any) => x.id === requestId)).toBeTruthy();
  });

  it('POST /requests/my/:id/publish rejects non-client role', async () => {
    const provider = await registerAndGetToken(app, 'provider', 'provider-req1@test.local', 'Provider One');

    await request(app.getHttpServer())
      .post('/requests/my/r1/publish')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(403);
  });

  it('POST /requests/my/:id/publish returns 404 for чужой запрос', async () => {
    const client1 = await registerAndGetToken(app, 'client', 'client-req2@test.local', 'Client Two');
    const client2 = await registerAndGetToken(app, 'client', 'client-req3@test.local', 'Client Three');

    const created = await request(app.getHttpServer())
      .post('/requests/my')
      .set('Authorization', `Bearer ${client1.accessToken}`)
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

    const requestId = created.body?.id;
    expect(requestId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/requests/my/${requestId}/publish`)
      .set('Authorization', `Bearer ${client2.accessToken}`)
      .expect(404);
  });

  it('POST /requests/my/:id/publish returns 409 if already published', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-req4@test.local', 'Client Four');

    const created = await request(app.getHttpServer())
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

    const requestId = created.body?.id;
    expect(requestId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/requests/my/${requestId}/publish`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/requests/my/${requestId}/publish`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(409);
  });

  it('POST /requests/my requires auth (401)', async () => {
    await request(app.getHttpServer())
      .post('/requests/my')
      .send({
        title: 'Test request',
        serviceKey,
        cityId,
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-02-01T10:00:00.000Z',
        isRecurring: false,
      })
      .expect(401);
  });

  it('POST /requests/my/:id/publish requires auth (401)', async () => {
    await request(app.getHttpServer())
      .post('/requests/my/507f1f77bcf86cd799439011/publish')
      .expect(401);
  });

  it('POST /requests/my/:id/publish returns 400 for invalid id', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-req5@test.local', 'Client Five');

    await request(app.getHttpServer())
      .post('/requests/my/not-an-objectid/publish')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(400);
  });
});
