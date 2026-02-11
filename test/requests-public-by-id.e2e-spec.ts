// test/requests-public-by-id.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';
import { Request as RequestEntity, RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { City, CityDocument } from '../src/modules/catalog/cities/schemas/city.schema';
import { Service, ServiceDocument } from '../src/modules/catalog/services/schemas/service.schema';
import { ServiceCategory, ServiceCategoryDocument } from '../src/modules/catalog/services/schemas/service-category.schema';
import { User, UserDocument } from '../src/modules/users/schemas/user.schema';
import { ClientProfile, ClientProfileDocument } from '../src/modules/users/schemas/client-profile.schema';

jest.setTimeout(30000);

describe('requests public by id (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let requestModel: Model<RequestDocument>;
  let cityModel: Model<CityDocument>;
  let serviceModel: Model<ServiceDocument>;
  let categoryModel: Model<ServiceCategoryDocument>;
  let userModel: Model<UserDocument>;
  let clientProfileModel: Model<ClientProfileDocument>;

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
    userModel = app.get(getModelToken(User.name));
    clientProfileModel = app.get(getModelToken(ClientProfile.name));
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
      userModel.deleteMany({}),
      clientProfileModel.deleteMany({}),
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

  it('GET /requests/public/:id returns published request with client public info', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send({
        name: 'Client One',
        email: 'client-public-1@test.local',
        password: 'Passw0rd!123',
        role: 'client',
        acceptPrivacyPolicy: true,
        city: 'Berlin',
      })
      .expect(201);

    const token = registerRes.body?.accessToken;
    const userId = registerRes.body?.user?.id ?? registerRes.body?.user?._id;
    expect(token).toBeTruthy();
    expect(userId).toBeTruthy();

    const createRes = await request(app.getHttpServer())
      .post('/requests/my')
      .set('Authorization', `Bearer ${token}`)
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
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/requests/public/${requestId}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: requestId,
      clientId: userId,
      clientName: 'Client One',
      clientAvatarUrl: '/avatars/default.png',
      clientCity: 'Berlin',
      clientRatingAvg: 0,
      clientRatingCount: 0,
    });
    expect(typeof res.body.clientIsOnline).toBe('boolean');
    expect(res.body.clientLastSeenAt).toBeTruthy();
  });

  it('GET /requests/public/:id returns 404 for non-published request', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send({
        name: 'Client Two',
        email: 'client-public-2@test.local',
        password: 'Passw0rd!123',
        role: 'client',
        acceptPrivacyPolicy: true,
      })
      .expect(201);

    const token = registerRes.body?.accessToken;
    const createRes = await request(app.getHttpServer())
      .post('/requests/my')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Draft request',
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
      .get(`/requests/public/${requestId}`)
      .expect(404);
  });
});
