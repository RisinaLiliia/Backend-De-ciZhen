import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspacePublicOverviewService } from './workspace-public-overview.service';
import { RequestsService } from '../requests/requests.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { PresenceService } from '../presence/presence.service';
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

  const citiesMock = {
    resolveActivityCoords: jest.fn(),
  };

  const usersMock = {
    findPublicByIds: jest.fn(),
  };

  const clientProfilesMock = {
    getByUserIds: jest.fn(),
  };

  const presenceMock = {
    getOnlineMap: jest.fn(),
  };

  const modelMock = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
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
        { provide: CitiesService, useValue: citiesMock },
        { provide: UsersService, useValue: usersMock },
        { provide: ClientProfilesService, useValue: clientProfilesMock },
        { provide: PresenceService, useValue: presenceMock },
        { provide: getModelToken(Request.name), useValue: modelMock },
        { provide: getModelToken(ProviderProfile.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspacePublicOverviewService);
    citiesMock.resolveActivityCoords.mockResolvedValue(new Map());
  });

  it('getPublicRequestsBatch returns ordered items and missing ids', async () => {
    const clientId = '65f0c1a2b3c4d5e6f7a8b9c1';
    requestsMock.listPublicByIds.mockResolvedValue([
      {
        _id: { toString: () => '65f0c1a2b3c4d5e6f7a8b9a1' },
        title: 'First',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        cityName: 'Berlin',
        propertyType: 'apartment',
        area: 55,
        preferredDate: new Date('2026-03-01T10:00:00.000Z'),
        isRecurring: false,
        status: 'published',
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
        clientId,
      },
      {
        _id: { toString: () => '65f0c1a2b3c4d5e6f7a8b9a3' },
        title: 'Third',
        serviceKey: 'window_cleaning',
        cityId: 'c2',
        cityName: 'Hamburg',
        propertyType: 'house',
        area: 80,
        preferredDate: new Date('2026-03-02T10:00:00.000Z'),
        isRecurring: false,
        status: 'published',
        createdAt: new Date('2026-03-02T09:00:00.000Z'),
        clientId,
      },
    ]);

    usersMock.findPublicByIds.mockResolvedValue([
      {
        _id: { toString: () => clientId },
        name: 'Anna',
        avatar: { url: '/avatars/a.png' },
        city: 'Berlin',
        lastSeenAt: new Date('2026-03-03T09:00:00.000Z'),
      },
    ]);
    clientProfilesMock.getByUserIds.mockResolvedValue([{ userId: clientId, ratingAvg: 4.8, ratingCount: 12 }]);
    presenceMock.getOnlineMap.mockResolvedValue(new Map([[clientId, true]]));

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

  it('getPublicOverview falls back to city coordinates when aggregated coords are 0,0', async () => {
    requestsMock.listPublic.mockResolvedValue([]);
    requestsMock.countPublic.mockResolvedValue(0);

    modelMock.countDocuments
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(5) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(44) });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      data: [],
      updatedAt: new Date('2030-03-01T00:00:00.000Z').toISOString(),
    });

    modelMock.aggregate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue([
        {
          _id: { cityName: 'Mannheim', cityId: 'city-mannheim' },
          count: 5,
        },
      ]),
    });
    citiesMock.resolveActivityCoords.mockResolvedValue(
      new Map([['mannheim', { cityId: 'city-mannheim', lat: 49.4875, lng: 8.466 }]]),
    );

    const result = await service.getPublicOverview({
      page: 1,
      limit: 10,
      cityActivityLimit: 20,
      activityRange: '30d',
    });

    expect(result.cityActivity.totalActiveCities).toBe(1);
    expect(result.cityActivity.totalActiveRequests).toBe(5);
    expect(result.cityActivity.items[0]).toMatchObject({
      cityName: 'Mannheim',
      requestCount: 5,
      lat: 49.4875,
      lng: 8.466,
    });
  });

  it('getPublicOverview deduplicates city activity by citySlug and sums counts', async () => {
    requestsMock.listPublic.mockResolvedValue([]);
    requestsMock.countPublic.mockResolvedValue(0);

    modelMock.countDocuments
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(6) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(44) });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      data: [],
      updatedAt: new Date('2030-03-01T00:00:00.000Z').toISOString(),
    });

    modelMock.aggregate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue([
        {
          _id: { cityName: 'Berlin', cityId: 'city-berlin-a' },
          count: 2,
        },
        {
          _id: { cityName: 'Berlin', cityId: 'city-berlin-b' },
          count: 1,
        },
        {
          _id: { cityName: 'Mannheim', cityId: 'city-mannheim' },
          count: 3,
        },
      ]),
    });
    citiesMock.resolveActivityCoords.mockResolvedValue(
      new Map([
        ['berlin', { cityId: 'city-berlin-a', lat: 52.52, lng: 13.405 }],
        ['mannheim', { cityId: 'city-mannheim', lat: 49.4875, lng: 8.466 }],
      ]),
    );

    const result = await service.getPublicOverview({
      page: 1,
      limit: 10,
      cityActivityLimit: 20,
      activityRange: '30d',
    });

    expect(result.cityActivity.totalActiveCities).toBe(2);
    expect(result.cityActivity.totalActiveRequests).toBe(6);
    expect(result.cityActivity.items.map((x) => x.citySlug)).toEqual(['berlin', 'mannheim']);

    expect(result.cityActivity.items[0]).toMatchObject({
      citySlug: 'berlin',
      cityName: 'Berlin',
      requestCount: 3,
      cityId: 'city-berlin-a',
      lat: 52.52,
      lng: 13.405,
    });

    expect(result.cityActivity.items[1]).toMatchObject({
      citySlug: 'mannheim',
      cityName: 'Mannheim',
      requestCount: 3,
      cityId: 'city-mannheim',
      lat: 49.4875,
      lng: 8.466,
    });
  });

  it('getPublicOverview supports extended cityActivityLimit for full ranking payloads', async () => {
    requestsMock.listPublic.mockResolvedValue([]);
    requestsMock.countPublic.mockResolvedValue(0);

    modelMock.countDocuments
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(0) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(0) });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      data: [],
      updatedAt: new Date('2030-03-01T00:00:00.000Z').toISOString(),
    });

    modelMock.aggregate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue([]),
    });

    await service.getPublicOverview({
      page: 1,
      limit: 10,
      cityActivityLimit: 5000,
      activityRange: '30d',
    });

    const pipeline = modelMock.aggregate.mock.calls[0]?.[0] as Array<Record<string, number>>;
    const limitStage = pipeline.find((stage) => '$limit' in stage);
    expect(limitStage).toEqual({ $limit: 25000 });
  });
});
