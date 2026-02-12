// test/chats.e2e-spec.ts
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

describe('chats (e2e)', () => {
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

  it('provider can create chat, list my chats, and client can fetch by id', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-chat-1@test.local', 'Client Chat');
    const provider = await registerAndGetToken(app, 'provider', 'provider-chat-1@test.local', 'Provider Chat');

    const createReq = await request(app.getHttpServer())
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

    const requestId = createReq.body?.id;
    expect(requestId).toBeTruthy();

    const createChatRes = await request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        requestId,
        clientId: client.userId,
        providerUserId: provider.userId,
      })
      .expect(201);

    const chatId = createChatRes.body?.id;
    expect(chatId).toBeTruthy();

    const listRes = await request(app.getHttpServer())
      .get('/chats/my')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    expect(listRes.body.find((c: any) => c.id === chatId)).toBeTruthy();

    const getByIdRes = await request(app.getHttpServer())
      .get(`/chats/${chatId}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(getByIdRes.body).toMatchObject({
      id: chatId,
      requestId,
      clientId: client.userId,
      providerUserId: provider.userId,
    });
  });

  it('forbids access to chat for non-participant', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-chat-2@test.local', 'Client Chat 2');
    const provider = await registerAndGetToken(app, 'provider', 'provider-chat-2@test.local', 'Provider Chat 2');
    const other = await registerAndGetToken(app, 'provider', 'provider-chat-3@test.local', 'Provider Other');

    const createReq = await request(app.getHttpServer())
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

    const requestId = createReq.body?.id;

    const createChatRes = await request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        requestId,
        clientId: client.userId,
        providerUserId: provider.userId,
      })
      .expect(201);

    const chatId = createChatRes.body?.id;

    await request(app.getHttpServer())
      .get(`/chats/${chatId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(403);
  });

  it('client cannot create chat for another clientId (403)', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-chat-4@test.local', 'Client Chat 4');
    const provider = await registerAndGetToken(app, 'provider', 'provider-chat-4@test.local', 'Provider Chat 4');

    await request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        requestId: '507f1f77bcf86cd799439011',
        clientId: '507f1f77bcf86cd799439012',
        providerUserId: provider.userId,
      })
      .expect(403);
  });
});
