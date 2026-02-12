// src/modules/favorites/favorites.controller.spec.ts
import { Test } from '@nestjs/testing';
import { FavoritesController } from './favorites.controller';
import { ProvidersService } from '../providers/providers.service';
import { RequestsService } from '../requests/requests.service';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { PresenceService } from '../presence/presence.service';
import { ForbiddenException } from '@nestjs/common';

describe('FavoritesController (unit)', () => {
  let controller: FavoritesController;

  const providersMock = {
    addFavoriteRequest: jest.fn(),
    removeFavoriteRequest: jest.fn(),
    listFavoriteRequestIds: jest.fn(),
  };
  const requestsMock = {
    listPublicByIds: jest.fn(),
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        { provide: ProvidersService, useValue: providersMock },
        { provide: RequestsService, useValue: requestsMock },
        { provide: UsersService, useValue: usersMock },
        { provide: ClientProfilesService, useValue: clientProfilesMock },
        { provide: PresenceService, useValue: presenceMock },
      ],
    }).compile();

    controller = moduleRef.get(FavoritesController);
  });

  it('addFavorite forbids non-provider', async () => {
    await expect(
      controller.addFavorite({ userId: 'u1', role: 'client' } as any, 'r1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listFavorites returns mapped items', async () => {
    providersMock.listFavoriteRequestIds.mockResolvedValue(['r1']);
    requestsMock.listPublicByIds.mockResolvedValue([
      {
        _id: { toString: () => 'r1' },
        title: 'Test',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        cityName: 'Berlin',
        categoryKey: 'cleaning',
        categoryName: 'Cleaning',
        subcategoryName: 'Home cleaning',
        propertyType: 'apartment',
        area: 55,
        price: 120,
        preferredDate: new Date('2026-02-01T10:00:00.000Z'),
        isRecurring: false,
        comment: null,
        description: 'details',
        photos: [],
        imageUrl: null,
        tags: [],
        status: 'published',
        createdAt: new Date('2026-01-28T10:00:00.000Z'),
        clientId: 'c1',
      },
    ]);
    usersMock.findPublicByIds.mockResolvedValue([
      {
        _id: { toString: () => 'c1' },
        name: 'Anna',
        avatar: { url: '/avatars/a.png', isDefault: false },
        city: 'Berlin',
        lastSeenAt: new Date('2026-02-11T10:00:00.000Z'),
      },
    ]);
    clientProfilesMock.getByUserIds.mockResolvedValue([{ userId: 'c1', ratingAvg: 4.8, ratingCount: 12 }]);
    presenceMock.getOnlineMap.mockResolvedValue(new Map([['c1', true]]));

    const res = await controller.listFavorites({ userId: 'p1', role: 'provider' } as any);

    expect(res[0]).toEqual(
      expect.objectContaining({
        id: 'r1',
        clientId: 'c1',
        clientName: 'Anna',
        clientAvatarUrl: '/avatars/a.png',
        clientCity: 'Berlin',
        clientRatingAvg: 4.8,
        clientRatingCount: 12,
        clientIsOnline: true,
      }),
    );
  });
});
