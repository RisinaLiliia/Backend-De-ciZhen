import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspacePublicOverviewService } from './workspace-public-overview.service';
import { WorkspacePublicRequestEnricherService } from './workspace-public-request-enricher.service';
import { WorkspacePublicCityActivityService } from './workspace-public-city-activity.service';
import { RequestsService } from '../requests/requests.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Request } from '../requests/schemas/request.schema';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';

describe('WorkspacePublicOverviewService (unit)', () => {
  let service: WorkspacePublicOverviewService;

  const requestsMock = {
    listPublic: jest.fn(),
    countPublic: jest.fn(),
    listPublicByIds: jest.fn(),
  };

  const analyticsMock = {
    getPlatformActivity: jest.fn(),
  };

  const enricherMock = {
    enrichPublicRequests: jest.fn(),
  };

  const cityActivityMock = {
    getCityActivity: jest.fn(),
  };

  const modelMock = {
    countDocuments: jest.fn(),
  };

  function execResult<T>(value: T) {
    return { exec: jest.fn().mockResolvedValue(value) };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspacePublicOverviewService,
        { provide: RequestsService, useValue: requestsMock },
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: WorkspacePublicRequestEnricherService, useValue: enricherMock },
        { provide: WorkspacePublicCityActivityService, useValue: cityActivityMock },
        { provide: getModelToken(Request.name), useValue: modelMock },
        { provide: getModelToken(ProviderProfile.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspacePublicOverviewService);
    enricherMock.enrichPublicRequests.mockResolvedValue([]);
    cityActivityMock.getCityActivity.mockResolvedValue({
      totalActiveCities: 0,
      totalActiveRequests: 0,
      items: [],
    });
  });

  it('getPublicRequestsBatch returns ordered items and missing ids', async () => {
    requestsMock.listPublicByIds.mockResolvedValue([
      { _id: { toString: () => '65f0c1a2b3c4d5e6f7a8b9a1' } },
      { _id: { toString: () => '65f0c1a2b3c4d5e6f7a8b9a3' } },
    ]);
    enricherMock.enrichPublicRequests.mockResolvedValue([
      { id: '65f0c1a2b3c4d5e6f7a8b9a1', clientName: 'Anna', clientRatingAvg: 4.8, clientIsOnline: true },
      { id: '65f0c1a2b3c4d5e6f7a8b9a3', clientName: 'Anna', clientRatingAvg: 4.8, clientIsOnline: true },
    ]);

    const result = await service.getPublicRequestsBatch([
      '65f0c1a2b3c4d5e6f7a8b9a3',
      '65f0c1a2b3c4d5e6f7a8b9a2',
      '65f0c1a2b3c4d5e6f7a8b9a1',
      'bad-id',
    ]);

    expect(requestsMock.listPublicByIds).toHaveBeenCalledWith([
      '65f0c1a2b3c4d5e6f7a8b9a3',
      '65f0c1a2b3c4d5e6f7a8b9a2',
      '65f0c1a2b3c4d5e6f7a8b9a1',
      'bad-id',
    ]);
    expect(enricherMock.enrichPublicRequests).toHaveBeenCalledTimes(1);
    expect(result.items.map((item) => item.id)).toEqual([
      '65f0c1a2b3c4d5e6f7a8b9a3',
      '65f0c1a2b3c4d5e6f7a8b9a1',
    ]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        clientName: 'Anna',
        clientRatingAvg: 4.8,
        clientIsOnline: true,
      }),
    );
    expect(result.missingIds).toEqual(['65f0c1a2b3c4d5e6f7a8b9a2', 'bad-id']);
  });

  it('getPublicOverview delegates request enrichment and city activity assembly', async () => {
    requestsMock.listPublic.mockResolvedValue([]);
    requestsMock.countPublic.mockResolvedValue(0);
    modelMock.countDocuments
      .mockReturnValueOnce(execResult(5))
      .mockReturnValueOnce(execResult(44));

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      data: [],
      updatedAt: new Date('2030-03-01T00:00:00.000Z').toISOString(),
    });
    cityActivityMock.getCityActivity.mockResolvedValue({
      totalActiveCities: 2,
      totalActiveRequests: 6,
      items: [
        { citySlug: 'berlin', cityName: 'Berlin', cityId: 'city-berlin-a', requestCount: 3, lat: 52.52, lng: 13.405 },
        { citySlug: 'mannheim', cityName: 'Mannheim', cityId: 'city-mannheim', requestCount: 3, lat: 49.4875, lng: 8.466 },
      ],
    });

    const result = await service.getPublicOverview({
      page: 1,
      limit: 10,
      cityActivityLimit: 20,
      activityRange: '30d',
    });

    expect(enricherMock.enrichPublicRequests).toHaveBeenCalledWith([]);
    expect(cityActivityMock.getCityActivity).toHaveBeenCalledWith({
      activityRange: '30d',
      cityActivityLimit: 20,
    });
    expect(result.cityActivity.totalActiveCities).toBe(2);
    expect(result.cityActivity.totalActiveRequests).toBe(6);
    expect(result.cityActivity.items.map((x) => x.citySlug)).toEqual(['berlin', 'mannheim']);
  });

  it('caps request list pagination input independently from city activity limits', async () => {
    requestsMock.listPublic.mockResolvedValue([]);
    requestsMock.countPublic.mockResolvedValue(0);
    modelMock.countDocuments
      .mockReturnValueOnce(execResult(0))
      .mockReturnValueOnce(execResult(0));
    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      data: [],
      updatedAt: new Date('2030-03-01T00:00:00.000Z').toISOString(),
    });

    await service.getPublicOverview({
      page: 1,
      limit: 500,
      cityActivityLimit: 5000,
      activityRange: '30d',
    });

    expect(requestsMock.listPublic).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100 }),
    );
    expect(cityActivityMock.getCityActivity).toHaveBeenCalledWith({
      activityRange: '30d',
      cityActivityLimit: 5000,
    });
  });
});
