import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspaceStatisticsService } from './workspace-statistics.service';
import { WorkspaceService } from './workspace.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Request } from '../requests/schemas/request.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { Review } from '../reviews/schemas/review.schema';

describe('WorkspaceStatisticsService (unit)', () => {
  let service: WorkspaceStatisticsService;

  const workspaceMock = {
    getPublicOverview: jest.fn(),
    getPrivateOverview: jest.fn(),
  };

  const analyticsMock = {
    getPlatformActivity: jest.fn(),
    getCitySearchCounts: jest.fn(),
  };
  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'app.platformTakeRatePercent') return 10;
      return undefined;
    }),
  };

  const requestModelMock = {
    aggregate: jest.fn(),
  };

  const contractModelMock = {
    aggregate: jest.fn(),
  };

  const offerModelMock = {
    aggregate: jest.fn(),
  };

  const reviewModelMock = {
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceStatisticsService,
        { provide: ConfigService, useValue: configMock },
        { provide: WorkspaceService, useValue: workspaceMock },
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
        { provide: getModelToken(Offer.name), useValue: offerModelMock },
        { provide: getModelToken(Contract.name), useValue: contractModelMock },
        { provide: getModelToken(Review.name), useValue: reviewModelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceStatisticsService);
  });

  it('returns platform mode payload for guest', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 120,
        totalActiveProviders: 25,
      },
      cityActivity: {
        items: [
          { citySlug: 'berlin', cityName: 'Berlin', cityId: 'c-1', requestCount: 9, lat: 52.52, lng: 13.405 },
        ],
      },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [
        { timestamp: '2026-03-01T00:00:00.000Z', requests: 10, offers: 7 },
        { timestamp: '2026-03-02T00:00:00.000Z', requests: 12, offers: 9 },
      ],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([
      {
        cityId: 'c-1',
        cityName: 'Berlin',
        citySlug: 'berlin',
        requestSearchCount: 21,
        providerSearchCount: 14,
      },
    ]);

    requestModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 11 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, requestCount: 9, anbieterSuchenCount: 4 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-03-01T08:00:00.000Z'),
            firstOfferAt: new Date('2026-03-01T08:30:00.000Z'),
            responseMinutes: 30,
          },
          {
            createdAt: new Date('2026-03-02T08:00:00.000Z'),
            firstOfferAt: null,
            responseMinutes: null,
          },
        ]),
      });

    offerModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: { cityId: 'c-1', cityName: 'Berlin' }, auftragSuchenCount: 12 },
      ]),
    });

    contractModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 5, cancelledJobs: 1, gmvAmount: 1250 }]),
    });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ total: 22, average: 4.6 }]),
    });

    const result = await service.getStatisticsOverview('30d');

    expect(result.mode).toBe('platform');
    expect(result.summary.totalPublishedRequests).toBe(120);
    expect(result.kpis.requestsTotal).toBe(22);
    expect(result.kpis.offersTotal).toBe(16);
    expect(result.demand.categories[0]).toMatchObject({
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      requestCount: 11,
    });
    const categoryPipeline = requestModelMock.aggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(categoryPipeline.some((stage) => Object.prototype.hasOwnProperty.call(stage, '$limit'))).toBe(false);
    const cityPipeline = requestModelMock.aggregate.mock.calls[1]?.[0] as Array<Record<string, unknown>>;
    expect(cityPipeline.some((stage) => Object.prototype.hasOwnProperty.call(stage, '$limit'))).toBe(false);
    expect(result.demand.cities[0]).toMatchObject({
      cityName: 'Berlin',
      requestCount: 9,
      auftragSuchenCount: 21,
      anbieterSuchenCount: 14,
      lat: 52.52,
      lng: 13.405,
    });
    expect(result.activity.metrics).toMatchObject({
      offerRatePercent: 73,
      responseMedianMinutes: 30,
      unansweredRequests24h: 1,
      cancellationRatePercent: 17,
      completedJobs: 5,
      gmvAmount: 1250,
      platformRevenueAmount: 125,
      takeRatePercent: 10,
    });
  });

  it('returns personalized mode payload for authenticated user', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 80,
        totalActiveProviders: 14,
      },
      cityActivity: { items: [] },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '7d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [{ timestamp: '2026-03-09T00:00:00.000Z', requests: 4, offers: 2 }],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([]);

    requestModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

    offerModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    contractModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 2, cancelledJobs: 1, gmvAmount: 400 }]),
    });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    workspaceMock.getPrivateOverview.mockResolvedValue({
      requestsByStatus: { total: 5 },
      providerOffersByStatus: { sent: 6, accepted: 3 },
      providerContractsByStatus: { completed: 2 },
      clientContractsByStatus: { completed: 1 },
      profiles: { providerCompleteness: 72, clientCompleteness: 64 },
      kpis: { acceptanceRate: 44, avgResponseMinutes: 18, myOpenRequests: 3, recentOffers7d: 2 },
    });

    const result = await service.getStatisticsOverview('7d', 'user-1', 'provider');

    expect(workspaceMock.getPrivateOverview).toHaveBeenCalledWith('user-1', 'provider');
    expect(result.mode).toBe('personalized');
    expect(result.kpis.requestsTotal).toBe(5);
    expect(result.kpis.completedJobsTotal).toBe(3);
    expect(result.kpis.profileCompleteness).toBe(72);
    expect(result.profileFunnel).toMatchObject({
      stage1: 3,
      stage2: 6,
      stage3: 3,
      stage4: 3,
      conversionRate: 44,
    });
  });

  it('computes category sharePercent from full period category set', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 90,
        totalActiveProviders: 14,
      },
      cityActivity: { items: [] },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [{ timestamp: '2026-03-09T00:00:00.000Z', requests: 9, offers: 4 }],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([]);

    requestModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'c1', categoryName: 'Category 1' }, count: 10 },
          { _id: { categoryKey: 'c2', categoryName: 'Category 2' }, count: 10 },
          { _id: { categoryKey: 'c3', categoryName: 'Category 3' }, count: 10 },
          { _id: { categoryKey: 'c4', categoryName: 'Category 4' }, count: 10 },
          { _id: { categoryKey: 'c5', categoryName: 'Category 5' }, count: 10 },
          { _id: { categoryKey: 'c6', categoryName: 'Category 6' }, count: 10 },
          { _id: { categoryKey: 'c7', categoryName: 'Category 7' }, count: 10 },
          { _id: { categoryKey: 'c8', categoryName: 'Category 8' }, count: 10 },
          { _id: { categoryKey: 'c9', categoryName: 'Category 9' }, count: 10 },
        ]),
      })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

    offerModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    contractModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await service.getStatisticsOverview('30d');

    expect(result.demand.categories).toHaveLength(9);
    expect(result.demand.categories[0].sharePercent).toBe(11);
    expect(result.demand.categories[8].sharePercent).toBe(11);
  });
});
