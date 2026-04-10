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

  it('GET /workspace/requests requires auth', async () => {
    await request(app.getHttpServer()).get('/workspace/requests').expect(401);
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
      .query({ period: '30d' })
      .set('Authorization', `Bearer ${account.accessToken}`)
      .expect(200);

    expect(res.body.user).toMatchObject({ userId });
    expect(res.body.preferredRole).toBe('customer');
    expect(res.body.requestsByStatus.total).toBeGreaterThanOrEqual(0);
    expect(res.body.favorites).toHaveProperty('requests');
    expect(res.body.reviews).toHaveProperty('asProvider');
  });

  it('GET /workspace/requests returns personalized workflow board', async () => {
    const account = await registerAndGetToken(
      app,
      'provider',
      'workspace-requests@test.local',
      'Workflow User',
    );

    const userId = String(account.userId);
    const customerRequestId = new Types.ObjectId().toString();
    const providerRequestId = new Types.ObjectId().toString();
    const externalProviderId = new Types.ObjectId().toString();
    const externalClientId = new Types.ObjectId().toString();
    const providerOfferId = new Types.ObjectId().toString();

    await requestModel.create([
      {
        _id: customerRequestId,
        title: 'Wohnung reinigen',
        clientId: userId,
        serviceKey: 'home_cleaning',
        cityId: 'berlin-city',
        cityName: 'Berlin',
        propertyType: 'apartment',
        area: 50,
        price: 140,
        preferredDate: new Date('2026-04-07T10:00:00.000Z'),
        isRecurring: false,
        status: 'published',
        categoryKey: 'cleaning',
        categoryName: 'Reinigung',
        subcategoryName: 'Grundreinigung',
      },
      {
        _id: providerRequestId,
        title: 'Büro reinigen',
        clientId: externalClientId,
        serviceKey: 'office_cleaning',
        cityId: 'berlin-city',
        cityName: 'Berlin',
        propertyType: 'apartment',
        area: 70,
        price: 220,
        preferredDate: new Date('2026-04-08T12:00:00.000Z'),
        isRecurring: false,
        status: 'matched',
        categoryKey: 'cleaning',
        categoryName: 'Reinigung',
        subcategoryName: 'Büroreinigung',
      },
    ]);

    await offerModel.create([
      {
        requestId: customerRequestId,
        providerUserId: externalProviderId,
        clientUserId: userId,
        status: 'sent',
        message: 'Kann morgen starten',
        pricing: { amount: 150, type: 'fixed', details: null },
        availability: { date: '2026-04-07T11:00:00.000Z', note: null },
        metadata: {},
      },
      {
        _id: providerOfferId,
        requestId: providerRequestId,
        providerUserId: userId,
        clientUserId: externalClientId,
        status: 'accepted',
        message: 'Bereit für den Auftrag',
        pricing: { amount: 220, type: 'fixed', details: null },
        availability: { date: '2026-04-08T10:00:00.000Z', note: null },
        metadata: {},
      },
    ]);

    await contractModel.create({
      requestId: providerRequestId,
      offerId: providerOfferId,
      clientId: externalClientId,
      providerUserId: userId,
      status: 'confirmed',
      priceAmount: 220,
      priceType: 'fixed',
      priceDetails: null,
      confirmedAt: new Date('2026-04-08T12:30:00.000Z'),
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });

    const res = await request(app.getHttpServer())
      .get('/workspace/requests')
      .query({ scope: 'my', role: 'all', state: 'all', period: '30d' })
      .set('Authorization', `Bearer ${account.accessToken}`)
      .set('Accept-Language', 'de-DE')
      .expect(200);

    expect(res.body).toMatchObject({
      section: 'requests',
      scope: 'my',
      header: { title: 'Meine Vorgänge' },
      filters: {
        role: 'all',
        state: 'all',
        period: '30d',
      },
    });
    expect(res.body.summary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'all', value: 2 }),
        expect.objectContaining({ key: 'attention', value: 1 }),
        expect.objectContaining({ key: 'execution', value: 1 }),
      ]),
    );
    expect(res.body.list.items).toHaveLength(2);
    expect(res.body.list.items[0]).toEqual(
      expect.objectContaining({
        requestId: providerRequestId,
        role: 'provider',
        state: 'active',
        requestPreview: expect.objectContaining({
          href: `/requests/${providerRequestId}`,
          categoryLabel: 'Reinigung',
        }),
        status: expect.objectContaining({
          badgeLabel: 'Angenommen',
          actions: expect.arrayContaining([
            expect.objectContaining({
              key: 'chat',
              kind: 'open_chat',
              chatInput: expect.objectContaining({
                requestId: providerRequestId,
                offerId: providerOfferId,
                participantUserId: userId,
              }),
            }),
          ]),
        }),
        decision: expect.objectContaining({
          needsAction: false,
          actionType: 'none',
          primaryAction: null,
        }),
      }),
    );
    expect(res.body.list.items[1]).toEqual(
      expect.objectContaining({
        requestId: customerRequestId,
        role: 'customer',
        state: 'clarifying',
        requestPreview: expect.objectContaining({
          href: `/requests/${customerRequestId}`,
          categoryLabel: 'Reinigung',
        }),
        status: expect.objectContaining({
          badgeLabel: 'Offen',
        }),
        decision: expect.objectContaining({
          needsAction: true,
          actionType: 'review_offers',
          primaryAction: expect.objectContaining({
            key: 'open',
            kind: 'link',
          }),
        }),
      }),
    );
    expect(res.body.list.items[0].progress.steps.map((step: { label: string }) => step.label)).toEqual([
      'Anfrage',
      'Angebote',
      'Auswahl',
      'Vertrag',
      'Abschluss',
    ]);
    expect(res.body.decisionPanel).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalNeedsAction: 1,
          newOffersCount: 1,
        }),
        primaryAction: {
          label: 'Jetzt handeln',
          mode: 'decision',
          targetFilter: 'needs_action',
        },
        queue: [
          expect.objectContaining({
            requestId: customerRequestId,
            actionType: 'review_offers',
          }),
        ],
      }),
    );
    expect(res.body.sidePanel).toEqual(
      expect.objectContaining({
        focus: expect.any(Object),
        recommendation: expect.any(Object),
      }),
    );
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

    expect(res.body.viewerMode).toBe('provider');
    expect(res.body.activityComparison).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        subtitle: expect.any(String),
        hasReliableSeries: expect.any(Boolean),
        points: expect.any(Array),
      }),
    );
    expect(res.body.activityComparison).toHaveProperty('peakTimestamp');
    expect(res.body.activityComparison).toHaveProperty('bestWindowTimestamp');
    expect(res.body.activityComparison).toHaveProperty('updatedAt');
    expect(res.body.activityComparison.points[0]).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
      }),
    );
    expect(res.body.activityComparison.points[0]).toHaveProperty('clientActivity');
    expect(res.body.activityComparison.points[0]).toHaveProperty('providerActivity');
    expect(res.body.decisionLayer).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        metrics: expect.any(Array),
      }),
    );
    expect(res.body.decisionLayer.metrics).toHaveLength(6);
    const offerRateMetric = res.body.decisionLayer.metrics.find((metric: { id: string }) => metric.id === 'offer_rate');
    const completedMetric = res.body.decisionLayer.metrics.find((metric: { id: string }) => metric.id === 'completed_jobs');
    const offersStage = res.body.funnelComparison.stages.find((stage: { key: string }) => stage.key === 'offers');
    const completedStage = res.body.funnelComparison.stages.find((stage: { key: string }) => stage.key === 'completed');
    expect(offerRateMetric.userValue).toBe(offersStage.userRateFromPrev ?? null);
    expect(offerRateMetric.marketValue).toBe(offersStage.marketRateFromPrev ?? null);
    expect(completedMetric.userValue).toBe(completedStage.userCount ?? null);
    expect(completedMetric.marketValue).toBe(completedStage.marketCount ?? null);
    expect(res.body.decisionInsight).toBe(res.body.decisionLayer.primaryInsight);
    expect(res.body.personalizedPricing).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        comparisonReliability: expect.stringMatching(/^(high|medium|low|unavailable)$/),
      }),
    );
    expect(res.body.categoryFit).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        hasReliableItems: expect.any(Boolean),
        items: expect.any(Array),
      }),
    );
    expect(res.body.categoryFit.items[0]).toEqual(
      expect.objectContaining({
        reliability: expect.stringMatching(/^(high|medium|low|unknown)$/),
      }),
    );
    expect(res.body.cityComparison).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        hasReliableItems: expect.any(Boolean),
        items: expect.any(Array),
      }),
    );
    expect(res.body.cityComparison.items[0]).toEqual(
      expect.objectContaining({
        reliability: expect.stringMatching(/^(high|medium|low|unknown)$/),
      }),
    );
    expect(res.body.funnelComparison).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        stages: expect.any(Array),
      }),
    );
    expect(res.body.funnelComparison.stages).toHaveLength(5);
    const userStageCounts = res.body.funnelComparison.stages.map((stage: { userCount: number }) => stage.userCount);
    const marketStageCounts = res.body.funnelComparison.stages.map((stage: { marketCount: number }) => stage.marketCount);
    expect(userStageCounts[4]).toBeLessThanOrEqual(userStageCounts[3]);
    expect(userStageCounts[3]).toBeLessThanOrEqual(userStageCounts[2]);
    expect(userStageCounts[2]).toBeLessThanOrEqual(userStageCounts[1]);
    expect(userStageCounts[1]).toBeLessThanOrEqual(userStageCounts[0]);
    expect(marketStageCounts[4]).toBeLessThanOrEqual(marketStageCounts[3]);
    expect(marketStageCounts[3]).toBeLessThanOrEqual(marketStageCounts[2]);
    expect(marketStageCounts[2]).toBeLessThanOrEqual(marketStageCounts[1]);
    expect(marketStageCounts[1]).toBeLessThanOrEqual(marketStageCounts[0]);
    expect(res.body.risks).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        hasReliableItems: expect.any(Boolean),
        items: expect.any(Array),
      }),
    );
    expect(res.body.opportunities).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        hasReliableItems: expect.any(Boolean),
        items: expect.any(Array),
      }),
    );
    expect(res.body.nextSteps).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        hasReliableItems: expect.any(Boolean),
        items: expect.any(Array),
      }),
    );

    expect(Array.isArray(res.body.insights)).toBe(true);
  });
});
