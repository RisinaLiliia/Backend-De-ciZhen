import { INestApplication } from '@nestjs/common';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { Request, type RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { Offer, type OfferDocument } from '../src/modules/offers/schemas/offer.schema';
import { Contract, type ContractDocument } from '../src/modules/contracts/schemas/contract.schema';
import { ProviderProfile, type ProviderProfileDocument } from '../src/modules/providers/schemas/provider-profile.schema';
import { Favorite, type FavoriteDocument } from '../src/modules/favorites/schemas/favorite.schema';
import { Review, type ReviewDocument } from '../src/modules/reviews/schemas/review.schema';

jest.setTimeout(120000);

describe('workspace (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let requestModel: Model<RequestDocument>;
  let offerModel: Model<OfferDocument>;
  let contractModel: Model<ContractDocument>;
  let providerProfileModel: Model<ProviderProfileDocument>;
  let favoriteModel: Model<FavoriteDocument>;
  let reviewModel: Model<ReviewDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    requestModel = app.get(getModelToken(Request.name));
    offerModel = app.get(getModelToken(Offer.name));
    contractModel = app.get(getModelToken(Contract.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
    favoriteModel = app.get(getModelToken(Favorite.name));
    reviewModel = app.get(getModelToken(Review.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      requestModel.deleteMany({}),
      offerModel.deleteMany({}),
      contractModel.deleteMany({}),
      providerProfileModel.deleteMany({}),
      favoriteModel.deleteMany({}),
      reviewModel.deleteMany({}),
    ]);
  });

  it('GET /workspace/public returns aggregated public overview', async () => {
    await requestModel.create([
      {
        title: 'Apartment cleaning',
        serviceKey: 'home_cleaning',
        cityId: 'berlin-city',
        cityName: 'Berlin',
        propertyType: 'apartment',
        area: 55,
        preferredDate: new Date(),
        isRecurring: false,
        status: 'published',
        categoryKey: 'cleaning',
      },
      {
        title: 'House move',
        serviceKey: 'moving',
        cityId: 'hamburg-city',
        cityName: 'Hamburg',
        propertyType: 'house',
        area: 120,
        preferredDate: new Date(),
        isRecurring: false,
        status: 'published',
        categoryKey: 'moving',
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/workspace/public')
      .query({ limit: 10, cityActivityLimit: 10, activityRange: '30d' })
      .expect(200);

    expect(res.body.summary).toMatchObject({
      totalPublishedRequests: expect.any(Number),
      totalActiveProviders: expect.any(Number),
    });

    expect(Array.isArray(res.body.requests.items)).toBe(true);
    expect(Array.isArray(res.body.cityActivity.items)).toBe(true);
    expect(Array.isArray(res.body.activity.data)).toBe(true);
  });

  it('GET /workspace/private requires auth', async () => {
    await request(app.getHttpServer()).get('/workspace/private').expect(401);
  });

  it('GET /workspace/private returns aggregated private overview', async () => {
    const account = await registerAndGetToken(
      app,
      'provider',
      'workspace-private@test.local',
      'Workspace User',
    );

    const userId = String(account.userId);

    await requestModel.create({
      title: 'Client request',
      clientId: userId,
      serviceKey: 'home_cleaning',
      cityId: 'berlin-city',
      cityName: 'Berlin',
      propertyType: 'apartment',
      area: 50,
      preferredDate: new Date(),
      isRecurring: false,
      status: 'published',
      categoryKey: 'cleaning',
    });

    const res = await request(app.getHttpServer())
      .get('/workspace/private')
      .set('Authorization', `Bearer ${account.accessToken}`)
      .expect(200);

    expect(res.body.user).toMatchObject({ userId });
    expect(res.body.requestsByStatus.total).toBeGreaterThanOrEqual(0);
    expect(res.body.favorites).toHaveProperty('requests');
    expect(res.body.reviews).toHaveProperty('asProvider');
  });

  it('GET /workspace/statistics returns platform mode for guest', async () => {
    await requestModel.create({
      title: 'Stats request',
      serviceKey: 'home_cleaning',
      cityId: 'berlin-city',
      cityName: 'Berlin',
      propertyType: 'apartment',
      area: 42,
      preferredDate: new Date(),
      isRecurring: false,
      status: 'published',
      categoryKey: 'cleaning',
    });

    const res = await request(app.getHttpServer())
      .get('/workspace/statistics')
      .query({ range: '30d' })
      .expect(200);

    expect(res.body.mode).toBe('platform');
    expect(res.body.range).toBe('30d');

    expect(res.body.summary).toEqual(
      expect.objectContaining({
        totalPublishedRequests: expect.any(Number),
        totalActiveProviders: expect.any(Number),
      }),
    );

    expect(Array.isArray(res.body.opportunityRadar)).toBe(true);

    const price = res.body.priceIntelligence;

    expect(price).toEqual(
      expect.objectContaining({
        analyzedRequestsCount: expect.any(Number),
        confidenceLevel: expect.stringMatching(/^(low|medium|high)$/),
        profitPotentialScore: expect.any(Number),
        profitPotentialStatus: expect.stringMatching(/^(low|medium|high)$/),
      }),
    );

    expect(price).toHaveProperty('recommendedMin');
    expect(price).toHaveProperty('recommendedMax');

    if (price.recommendedMin !== null) {
      expect(price.recommendedMin).toEqual(expect.any(Number));
    }

    if (price.recommendedMax !== null) {
      expect(price.recommendedMax).toEqual(expect.any(Number));
    }

    expect(Array.isArray(res.body.growthCards)).toBe(true);
  });

  it('GET /workspace/statistics returns personalized mode for authenticated user', async () => {
    const account = await registerAndGetToken(
      app,
      'provider',
      'workspace-statistics@test.local',
      'Stats User',
    );

    const userId = String(account.userId);

    await requestModel.create({
      title: 'Client request for stats',
      clientId: userId,
      serviceKey: 'home_cleaning',
      cityId: 'berlin-city',
      cityName: 'Berlin',
      propertyType: 'apartment',
      area: 50,
      preferredDate: new Date(),
      isRecurring: false,
      status: 'published',
      categoryKey: 'cleaning',
    });

    const res = await request(app.getHttpServer())
      .get('/workspace/statistics')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${account.accessToken}`)
      .expect(200);

    expect(res.body.mode).toBe('personalized');

    expect(res.body.kpis).toEqual(
      expect.objectContaining({
        requestsTotal: expect.any(Number),
        offersTotal: expect.any(Number),
        profileCompleteness: expect.any(Number),
      }),
    );

    expect(Array.isArray(res.body.opportunityRadar)).toBe(true);

    const price = res.body.priceIntelligence;

    expect(price).toEqual(
      expect.objectContaining({
        analyzedRequestsCount: expect.any(Number),
        confidenceLevel: expect.stringMatching(/^(low|medium|high)$/),
        profitPotentialScore: expect.any(Number),
        profitPotentialStatus: expect.stringMatching(/^(low|medium|high)$/),
      }),
    );

    expect(price).toHaveProperty('recommendedMin');
    expect(price).toHaveProperty('recommendedMax');

    if (price.recommendedMin !== null) {
      expect(price.recommendedMin).toEqual(expect.any(Number));
    }

    if (price.recommendedMax !== null) {
      expect(price.recommendedMax).toEqual(expect.any(Number));
    }

    expect(Array.isArray(res.body.insights)).toBe(true);
  });
});