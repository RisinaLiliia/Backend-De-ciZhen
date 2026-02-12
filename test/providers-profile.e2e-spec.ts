// test/providers-profile.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { ProviderProfile, ProviderProfileDocument } from '../src/modules/providers/schemas/provider-profile.schema';

jest.setTimeout(30000);

describe('providers profile (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let providerProfileModel: Model<ProviderProfileDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await providerProfileModel.deleteMany({});
  });

  it('provider can get and update own profile', async () => {
    const provider = await registerAndGetToken(app, 'provider', 'prov-prof@test.local', 'Provider Prof');

    const getRes = await request(app.getHttpServer())
      .get('/providers/me/profile')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    expect(getRes.body).toMatchObject({
      userId: provider.userId,
      status: 'draft',
    });

    const updateRes = await request(app.getHttpServer())
      .patch('/providers/me/profile')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        displayName: 'Best Provider',
        cityId: 'c1',
        serviceKeys: ['home_cleaning'],
        basePrice: 40,
      })
      .expect(200);

    expect(updateRes.body).toMatchObject({
      displayName: 'Best Provider',
      cityId: 'c1',
      basePrice: 40,
      status: 'active',
    });

    const saved = await providerProfileModel.findOne({ userId: provider.userId }).exec();
    expect(saved?.displayName).toBe('Best Provider');
    expect(saved?.serviceKeys).toEqual(['home_cleaning']);
    expect(saved?.status).toBe('active');
  });

  it('keeps draft when required fields are missing', async () => {
    const provider = await registerAndGetToken(app, 'provider', 'prov-prof-2@test.local', 'Provider Prof 2');

    await request(app.getHttpServer())
      .get('/providers/me/profile')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    const updateRes = await request(app.getHttpServer())
      .patch('/providers/me/profile')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        displayName: 'Provider',
        cityId: 'c1',
        serviceKeys: [],
      })
      .expect(200);

    expect(updateRes.body).toMatchObject({
      status: 'draft',
    });

    const saved = await providerProfileModel.findOne({ userId: provider.userId }).exec();
    expect(saved?.status).toBe('draft');
  });

  it('GET /providers returns public list', async () => {
    await providerProfileModel.create({
      userId: 'prov-public-1',
      status: 'active',
      isBlocked: false,
      cityId: 'c1',
      serviceKeys: ['home_cleaning'],
      basePrice: 35,
      ratingAvg: 4.5,
      ratingCount: 2,
    });

    const res = await request(app.getHttpServer()).get('/providers').query({ cityId: 'c1' }).expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0]).toMatchObject({ basePrice: 35 });
  });
});
