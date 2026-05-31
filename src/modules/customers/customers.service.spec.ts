import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { CitiesService } from '../catalog/cities/cities.service';
import { PresenceService } from '../presence/presence.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { UsersService } from '../users/users.service';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  let service: CustomersService;

  const usersMock = {
    findById: jest.fn(),
  };
  const clientProfilesMock = {
    getByUserIds: jest.fn(),
  };
  const citiesMock = {
    findActiveByLabel: jest.fn(),
  };
  const presenceMock = {
    getOnlineMap: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: UsersService, useValue: usersMock },
        { provide: ClientProfilesService, useValue: clientProfilesMock },
        { provide: CitiesService, useValue: citiesMock },
        { provide: PresenceService, useValue: presenceMock },
      ],
    }).compile();

    service = moduleRef.get(CustomersService);
  });

  it('maps public customer profile from user, client profile, city and presence', async () => {
    usersMock.findById.mockResolvedValue({
      _id: { toString: () => 'u1' },
      name: 'Ban Raflas',
      bio: 'Customer bio',
      city: 'Frankfurt',
      avatar: { url: 'https://cdn.example.com/customer.png' },
      isBlocked: false,
      lastSeenAt: new Date('2026-05-31T10:15:00.000Z'),
    });
    clientProfilesMock.getByUserIds.mockResolvedValue([
      { userId: 'u1', ratingAvg: 4.8, ratingCount: 12 },
    ]);
    citiesMock.findActiveByLabel.mockResolvedValue({
      _id: { toString: () => 'city-1' },
    });
    presenceMock.getOnlineMap.mockResolvedValue(new Map([['u1', true]]));

    const result = await service.getPublicById('u1');

    expect(clientProfilesMock.getByUserIds).toHaveBeenCalledWith(['u1']);
    expect(citiesMock.findActiveByLabel).toHaveBeenCalledWith('Frankfurt', 'DE');
    expect(presenceMock.getOnlineMap).toHaveBeenCalledWith(['u1']);
    expect(result).toEqual(
      expect.objectContaining({
        id: 'u1',
        userId: 'u1',
        displayName: 'Ban Raflas',
        bio: 'Customer bio',
        avatarUrl: 'https://cdn.example.com/customer.png',
        cityId: 'city-1',
        cityName: 'Frankfurt',
        ratingAvg: 4.8,
        ratingCount: 12,
        isOnline: true,
      }),
    );
  });

  it('hides blocked users from public customer profile', async () => {
    usersMock.findById.mockResolvedValue({
      _id: { toString: () => 'u1' },
      isBlocked: true,
    });

    await expect(service.getPublicById('u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
