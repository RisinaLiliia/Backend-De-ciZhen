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

jest.setTimeout(30000);

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
        preferredDate: new Date('2026-03-06T10:00:00.000Z'),
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
        preferredDate: new Date('2026-03-07T10:00:00.000Z'),
        isRecurring: false,
        status: 'published',
        categoryKey: 'moving',
      },
      {
        title: 'Draft hidden',
        serviceKey: 'home_cleaning',
        cityId: 'berlin-city',
        cityName: 'Berlin',
        propertyType: 'apartment',
        area: 40,
        preferredDate: new Date('2026-03-08T10:00:00.000Z'),
        isRecurring: false,
        status: 'draft',
        categoryKey: 'cleaning',
      },
    ]);

    await providerProfileModel.create([
      { userId: new Types.ObjectId().toString(), status: 'active', isBlocked: false, serviceKeys: ['home_cleaning'] },
      { userId: new Types.ObjectId().toString(), status: 'draft', isBlocked: false, serviceKeys: ['moving'] },
    ]);

    await offerModel.create({
      requestId: new Types.ObjectId().toString(),
      providerUserId: new Types.ObjectId().toString(),
      clientUserId: new Types.ObjectId().toString(),
      status: 'sent',
      pricing: { amount: 120, type: 'fixed' },
    });

    const res = await request(app.getHttpServer())
      .get('/workspace/public')
      .query({ limit: 10, cityActivityLimit: 10, activityRange: '30d' })
      .expect(200);

    expect(res.body.summary).toMatchObject({
      totalPublishedRequests: 2,
      totalActiveProviders: 1,
    });
    expect(res.body.requests).toMatchObject({
      total: 2,
      page: 1,
      limit: 10,
    });
    expect(Array.isArray(res.body.requests.items)).toBe(true);
    expect(res.body.requests.items).toHaveLength(2);

    expect(res.body.cityActivity.totalActiveCities).toBeGreaterThanOrEqual(2);
    expect(res.body.cityActivity.totalActiveRequests).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.cityActivity.items)).toBe(true);

    expect(res.body.activity).toMatchObject({
      range: '30d',
      source: 'real',
    });
    expect(Array.isArray(res.body.activity.data)).toBe(true);
  });

  it('POST /workspace/public/requests-batch returns ordered details and missing ids', async () => {
    const first = await requestModel.create({
      title: 'First',
      serviceKey: 'home_cleaning',
      cityId: 'berlin-city',
      cityName: 'Berlin',
      propertyType: 'apartment',
      area: 50,
      preferredDate: new Date('2026-03-06T10:00:00.000Z'),
      isRecurring: false,
      status: 'published',
      categoryKey: 'cleaning',
    });

    const second = await requestModel.create({
      title: 'Second',
      serviceKey: 'moving',
      cityId: 'hamburg-city',
      cityName: 'Hamburg',
      propertyType: 'house',
      area: 100,
      preferredDate: new Date('2026-03-07T10:00:00.000Z'),
      isRecurring: false,
      status: 'published',
      categoryKey: 'moving',
    });

    const missingId = new Types.ObjectId().toString();

    const res = await request(app.getHttpServer())
      .post('/workspace/public/requests-batch')
      .send({
        ids: [second._id.toString(), missingId, first._id.toString(), 'bad-id'],
      })
      .expect(200);

    expect(res.body.items.map((item: any) => item.id)).toEqual([
      second._id.toString(),
      first._id.toString(),
    ]);
    expect(res.body.missingIds).toEqual([missingId, 'bad-id']);
  });

  it('GET /workspace/private requires auth', async () => {
    await request(app.getHttpServer()).get('/workspace/private').expect(401);
  });

  it('GET /workspace/private returns aggregated private overview', async () => {
    const account = await registerAndGetToken(app, 'provider', 'workspace-private@test.local', 'Workspace User');
    const userId = String(account.userId);

    await providerProfileModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          status: 'active',
          isBlocked: false,
          displayName: 'Workspace User',
          cityId: 'berlin-city',
          serviceKeys: ['home_cleaning'],
          basePrice: 45,
        },
      },
      { upsert: true, new: true },
    );

    const req1 = await requestModel.create({
      title: 'Client request 1',
      clientId: userId,
      serviceKey: 'home_cleaning',
      cityId: 'berlin-city',
      cityName: 'Berlin',
      propertyType: 'apartment',
      area: 50,
      preferredDate: new Date('2026-03-06T10:00:00.000Z'),
      isRecurring: false,
      status: 'published',
      categoryKey: 'cleaning',
      createdAt: new Date('2026-02-15T10:00:00.000Z'),
    });

    const req2 = await requestModel.create({
      title: 'Client request 2',
      clientId: userId,
      serviceKey: 'moving',
      cityId: 'hamburg-city',
      cityName: 'Hamburg',
      propertyType: 'house',
      area: 90,
      preferredDate: new Date('2026-03-07T10:00:00.000Z'),
      isRecurring: false,
      status: 'closed',
      categoryKey: 'moving',
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
    });

    const offerAccepted = await offerModel.create({
      requestId: req1._id.toString(),
      providerUserId: userId,
      clientUserId: new Types.ObjectId().toString(),
      status: 'accepted',
      pricing: { amount: 200, type: 'fixed' },
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedAt: new Date('2026-03-01T10:30:00.000Z'),
    });

    await offerModel.create({
      requestId: req2._id.toString(),
      providerUserId: userId,
      clientUserId: new Types.ObjectId().toString(),
      status: 'sent',
      pricing: { amount: 180, type: 'fixed' },
      createdAt: new Date('2026-03-02T10:00:00.000Z'),
      updatedAt: new Date('2026-03-02T10:15:00.000Z'),
    });

    await contractModel.create({
      requestId: req1._id.toString(),
      offerId: offerAccepted._id.toString(),
      clientId: userId,
      providerUserId: userId,
      status: 'completed',
      priceAmount: 200,
      priceType: 'fixed',
      completedAt: new Date(),
      confirmedAt: new Date(),
    });

    await favoriteModel.create([
      { userId, type: 'request', targetId: new Types.ObjectId().toString() },
      { userId, type: 'provider', targetId: new Types.ObjectId().toString() },
    ]);

    await reviewModel.create([
      {
        authorUserId: new Types.ObjectId().toString(),
        targetUserId: userId,
        targetRole: 'provider',
        bookingId: new Types.ObjectId().toString(),
        requestId: req1._id.toString(),
        rating: 5,
      },
      {
        authorUserId: new Types.ObjectId().toString(),
        targetUserId: userId,
        targetRole: 'client',
        bookingId: new Types.ObjectId().toString(),
        requestId: req1._id.toString(),
        rating: 4,
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/workspace/private')
      .set('Authorization', `Bearer ${account.accessToken}`)
      .expect(200);

    expect(res.body.user).toMatchObject({ userId });
    expect(res.body.requestsByStatus.total).toBe(2);
    expect(res.body.providerOffersByStatus.total).toBe(2);
    expect(res.body.providerContractsByStatus.total).toBe(1);
    expect(res.body.clientContractsByStatus.total).toBe(1);
    expect(res.body.favorites).toEqual({ requests: 1, providers: 1 });
    expect(res.body.reviews).toEqual({ asProvider: 1, asClient: 1 });
    expect(Array.isArray(res.body.providerMonthlySeries)).toBe(true);
    expect(Array.isArray(res.body.clientMonthlySeries)).toBe(true);
    expect(res.body.providerMonthlySeries).toHaveLength(6);
    expect(res.body.clientMonthlySeries).toHaveLength(6);
  });
});
