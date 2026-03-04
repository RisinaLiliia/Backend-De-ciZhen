import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspaceService } from './workspace.service';
import { RequestsService } from '../requests/requests.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { PresenceService } from '../presence/presence.service';
import { Request } from '../requests/schemas/request.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';
import { Favorite } from '../favorites/schemas/favorite.schema';
import { Review } from '../reviews/schemas/review.schema';
import { ClientProfile } from '../users/schemas/client-profile.schema';

describe('WorkspaceService (unit)', () => {
  let service: WorkspaceService;

  const requestsMock = {
    listPublicByIds: jest.fn(),
  };

  const analyticsMock = {
    getPlatformActivity: jest.fn(),
  };

  const usersMock = {
    findPublicByIds: jest.fn(),
    findById: jest.fn(),
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
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: RequestsService, useValue: requestsMock },
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: UsersService, useValue: usersMock },
        { provide: ClientProfilesService, useValue: clientProfilesMock },
        { provide: PresenceService, useValue: presenceMock },
        { provide: getModelToken(Request.name), useValue: modelMock },
        { provide: getModelToken(Offer.name), useValue: modelMock },
        { provide: getModelToken(Contract.name), useValue: modelMock },
        { provide: getModelToken(ProviderProfile.name), useValue: modelMock },
        { provide: getModelToken(Favorite.name), useValue: modelMock },
        { provide: getModelToken(Review.name), useValue: modelMock },
        { provide: getModelToken(ClientProfile.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceService);
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
});
