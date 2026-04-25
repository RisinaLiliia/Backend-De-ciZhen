import { Test } from '@nestjs/testing';

import { WorkspacePublicRequestEnricherService } from './workspace-public-request-enricher.service';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { PresenceService } from '../presence/presence.service';

describe('WorkspacePublicRequestEnricherService (unit)', () => {
  let service: WorkspacePublicRequestEnricherService;

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
      providers: [
        WorkspacePublicRequestEnricherService,
        { provide: UsersService, useValue: usersMock },
        { provide: ClientProfilesService, useValue: clientProfilesMock },
        { provide: PresenceService, useValue: presenceMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspacePublicRequestEnricherService);
  });

  it('enriches public requests with client public profile and normalized location', async () => {
    const clientId = '65f0c1a2b3c4d5e6f7a8b9c1';
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

    const result = await service.enrichPublicRequests([
      {
        _id: { toString: () => '65f0c1a2b3c4d5e6f7a8b9a1' },
        title: 'First',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        cityName: 'Berlin',
        location: { coordinates: [13.4049541, 52.520008] },
        propertyType: 'apartment',
        area: 55,
        preferredDate: new Date('2026-03-01T10:00:00.000Z'),
        isRecurring: false,
        status: 'published',
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
        clientId,
        photos: [],
        tags: [],
      } as any,
    ] as any);

    expect(usersMock.findPublicByIds).toHaveBeenCalledWith([clientId]);
    expect(clientProfilesMock.getByUserIds).toHaveBeenCalledWith([clientId]);
    expect(presenceMock.getOnlineMap).toHaveBeenCalledWith([clientId]);
    expect(result).toEqual([
      expect.objectContaining({
        id: '65f0c1a2b3c4d5e6f7a8b9a1',
        clientName: 'Anna',
        clientAvatarUrl: '/avatars/a.png',
        clientCity: 'Berlin',
        clientRatingAvg: 4.8,
        clientRatingCount: 12,
        clientIsOnline: true,
        location: {
          type: 'Point',
          coordinates: [13.4, 52.52],
        },
      }),
    ]);
  });

  it('returns base dto when no client enrichment is available', async () => {
    usersMock.findPublicByIds.mockResolvedValue([]);
    clientProfilesMock.getByUserIds.mockResolvedValue([]);
    presenceMock.getOnlineMap.mockResolvedValue(new Map());

    const result = await service.enrichPublicRequests([
      {
        id: 'req-1',
        title: 'No client',
        serviceKey: 'window_cleaning',
        cityId: 'c2',
        cityName: 'Hamburg',
        clientId: null,
        status: 'cancelled',
        inactiveReason: 'withdrawn',
        inactiveMessage: 'Hidden',
        createdAt: new Date('2026-03-02T09:00:00.000Z'),
        photos: [],
        tags: [],
      } as any,
    ] as any);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'req-1',
        clientId: null,
        clientName: null,
        isInactive: true,
        inactiveReason: 'withdrawn',
        inactiveMessage: 'Hidden',
      }),
    ]);
  });
});
