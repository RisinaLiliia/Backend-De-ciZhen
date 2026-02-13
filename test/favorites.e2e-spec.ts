// test/favorites.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { Request as Req, RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { ProviderProfile, ProviderProfileDocument } from '../src/modules/providers/schemas/provider-profile.schema';

jest.setTimeout(30000);

describe('favorites (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let requestModel: Model<RequestDocument>;
  let providerProfileModel: Model<ProviderProfileDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    requestModel = app.get(getModelToken(Req.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([requestModel.deleteMany({}), providerProfileModel.deleteMany({})]);
  });

  it('provider can favorite request and list favorites', async () => {
    const provider = await registerAndGetToken(app, 'provider', 'prov-fav@test.local', 'Provider Fav');

    await providerProfileModel.findOneAndUpdate(
      { userId: provider.userId },
      {
        userId: provider.userId,
        status: 'active',
        isBlocked: false,
        cityId: 'c1',
        serviceKeys: ['home_cleaning'],
      },
      { upsert: true, new: true },
    );

    const req = await requestModel.create({
      title: 'Need cleaning',
      clientId: 'c1',
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date('2026-03-05T09:00:00.000Z'),
      isRecurring: false,
      status: 'published',
    });

    await request(app.getHttpServer())
      .post('/favorites')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ type: 'request', targetId: req._id.toString() })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/favorites')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .query({ type: 'request' })
      .expect(200);

    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toMatchObject({ id: req._id.toString() });
  });
});
