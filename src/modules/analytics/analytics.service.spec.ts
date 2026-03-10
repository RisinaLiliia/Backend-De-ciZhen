import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { AnalyticsService } from './analytics.service';
import { RedisService } from '../../infra/redis.service';
import { Request } from '../requests/schemas/request.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { SearchAnalyticsAggregate } from './schemas/search-analytics-aggregate.schema';

describe('AnalyticsService (unit)', () => {
  let service: AnalyticsService;

  const redisMock = {
    setIfAbsent: jest.fn(),
  };

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'app.searchAnalyticsBucketSeconds') return 900;
      if (key === 'app.searchAnalyticsDedupeTtlSeconds') return 1020;
      if (key === 'app.analyticsHashSalt') return 'test-salt';
      if (key === 'app.jwtSecret') return 'test_jwt_secret_min_32_chars_value';
      return undefined;
    }),
  };

  const requestModelMock = {
    find: jest.fn(),
  };

  const offerModelMock = {
    find: jest.fn(),
  };

  const aggregateModelMock = {
    updateOne: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: RedisService, useValue: redisMock },
        { provide: ConfigService, useValue: configMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
        { provide: getModelToken(Offer.name), useValue: offerModelMock },
        { provide: getModelToken(SearchAnalyticsAggregate.name), useValue: aggregateModelMock },
      ],
    }).compile();

    service = moduleRef.get(AnalyticsService);
  });

  it('tracks search event and persists aggregate when dedupe key is new', async () => {
    redisMock.setIfAbsent.mockResolvedValue(true);
    aggregateModelMock.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ acknowledged: true }) });

    const result = await service.trackSearchEvent(
      {
        target: 'request',
        source: 'workspace_filters',
        cityId: 'berlin-city',
        cityName: 'Berlin',
        categoryKey: 'cleaning',
      },
      {
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.deduped).toBe(false);
    expect(redisMock.setIfAbsent).toHaveBeenCalledTimes(1);
    expect(aggregateModelMock.updateOne).toHaveBeenCalledTimes(1);
  });

  it('returns deduped=true and skips persistence for duplicate event', async () => {
    redisMock.setIfAbsent.mockResolvedValue(false);

    const result = await service.trackSearchEvent(
      {
        target: 'provider',
        source: 'workspace_filters',
        cityId: 'berlin-city',
      },
      {
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.deduped).toBe(true);
    expect(aggregateModelMock.updateOne).not.toHaveBeenCalled();
  });

  it('throws 400 when no search criteria are provided', async () => {
    await expect(
      service.trackSearchEvent(
        {
          target: 'request',
          source: 'workspace_filters',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
      ),
    ).rejects.toThrow('At least one search criterion is required');
  });

  it('returns city search counters aggregated by target', async () => {
    aggregateModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          _id: {
            cityId: 'berlin-city',
            cityName: 'Berlin',
            citySlug: 'berlin',
          },
          requestSearchCount: 7,
          providerSearchCount: 3,
        },
      ]),
    });

    const result = await service.getCitySearchCounts('30d');

    expect(result).toEqual([
      {
        cityId: 'berlin-city',
        cityName: 'Berlin',
        citySlug: 'berlin',
        requestSearchCount: 7,
        providerSearchCount: 3,
      },
    ]);
  });
});
