import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspacePublicCityActivityService } from './workspace-public-city-activity.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { Request } from '../requests/schemas/request.schema';

describe('WorkspacePublicCityActivityService (unit)', () => {
  let service: WorkspacePublicCityActivityService;

  const citiesMock = {
    resolveActivityCoords: jest.fn(),
  };

  const requestModelMock = {
    aggregate: jest.fn(),
  };

  function execResult<T>(value: T) {
    return { exec: jest.fn().mockResolvedValue(value) };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspacePublicCityActivityService,
        { provide: CitiesService, useValue: citiesMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspacePublicCityActivityService);
    citiesMock.resolveActivityCoords.mockResolvedValue(new Map());
  });

  it('falls back to resolved city coordinates and returns aggregated activity totals', async () => {
    requestModelMock.aggregate.mockReturnValueOnce(
      execResult([
        { _id: { cityName: 'Mannheim', cityId: 'city-mannheim' }, count: 5 },
      ]),
    );
    citiesMock.resolveActivityCoords.mockResolvedValue(
      new Map([['mannheim', { cityId: 'city-mannheim', lat: 49.4875, lng: 8.466 }]]),
    );

    const result = await service.getCityActivity({ activityRange: '30d', cityActivityLimit: 20 });

    expect(result.totalActiveCities).toBe(1);
    expect(result.totalActiveRequests).toBe(5);
    expect(result.items[0]).toMatchObject({
      cityName: 'Mannheim',
      requestCount: 5,
      lat: 49.4875,
      lng: 8.466,
    });
  });

  it('deduplicates city rows by slug and caps aggregation size for large limits', async () => {
    requestModelMock.aggregate.mockReturnValueOnce(
      execResult([
        { _id: { cityName: 'Berlin', cityId: 'city-berlin-a' }, count: 2 },
        { _id: { cityName: 'Berlin', cityId: 'city-berlin-b' }, count: 1 },
        { _id: { cityName: 'Mannheim', cityId: 'city-mannheim' }, count: 3 },
      ]),
    );
    citiesMock.resolveActivityCoords.mockResolvedValue(
      new Map([
        ['berlin', { cityId: 'city-berlin-a', lat: 52.52, lng: 13.405 }],
        ['mannheim', { cityId: 'city-mannheim', lat: 49.4875, lng: 8.466 }],
      ]),
    );

    const result = await service.getCityActivity({ activityRange: '30d', cityActivityLimit: 5000 });

    expect(result.totalActiveCities).toBe(2);
    expect(result.totalActiveRequests).toBe(6);
    expect(result.items.map((x) => x.citySlug)).toEqual(['berlin', 'mannheim']);
    expect(result.items[0]).toMatchObject({
      citySlug: 'berlin',
      requestCount: 3,
      cityId: 'city-berlin-a',
    });

    const pipeline = requestModelMock.aggregate.mock.calls[0]?.[0] as Array<Record<string, number>>;
    const limitStage = pipeline.find((stage) => '$limit' in stage);
    expect(limitStage).toEqual({ $limit: 25000 });
  });
});
