import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspaceStatisticsService } from './workspace-statistics.service';
import { WorkspaceService } from './workspace.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Request } from '../requests/schemas/request.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';
import { Review } from '../reviews/schemas/review.schema';

describe('WorkspaceStatisticsService (unit)', () => {
  let service: WorkspaceStatisticsService;

  const workspaceMock = {
    getPublicOverview: jest.fn(),
    getPrivateOverview: jest.fn(),
  };

  const analyticsMock = {
    getPlatformActivity: jest.fn(),
  };

  const requestModelMock = {
    aggregate: jest.fn(),
  };

  const contractModelMock = {
    countDocuments: jest.fn(),
  };

  const providerModelMock = {};

  const reviewModelMock = {
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceStatisticsService,
        { provide: WorkspaceService, useValue: workspaceMock },
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
        { provide: getModelToken(Contract.name), useValue: contractModelMock },
        { provide: getModelToken(ProviderProfile.name), useValue: providerModelMock },
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

    requestModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 11 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, count: 9 },
        ]),
      });

    contractModelMock.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(5),
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
    expect(result.demand.cities[0]).toMatchObject({
      cityName: 'Berlin',
      requestCount: 9,
      lat: 52.52,
      lng: 13.405,
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

    requestModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

    contractModelMock.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
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
});
