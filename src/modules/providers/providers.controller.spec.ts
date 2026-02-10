// src/modules/providers/providers.controller.spec.ts
import { Test } from '@nestjs/testing';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

describe('ProvidersController (unit) public list', () => {
  let controller: ProvidersController;

  const svcMock = {
    listPublic: jest.fn(),
    getOrCreateMyProfile: jest.fn(),
    updateMyProfile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ProvidersController],
      providers: [{ provide: ProvidersService, useValue: svcMock }],
    }).compile();

    controller = moduleRef.get(ProvidersController);
  });

  it('listPublic passes filters and maps dto', async () => {
    svcMock.listPublic.mockResolvedValue([
      {
        _id: { toString: () => 'p1' },
        userId: 'u1',
        displayName: 'Anna',
        cityId: 'c1',
        serviceKeys: ['home_cleaning'],
        basePrice: 35,
        status: 'active',
      },
    ]);

    const res = await controller.listPublic({ cityId: 'c1', serviceKey: 'home_cleaning' } as any);

    expect(svcMock.listPublic).toHaveBeenCalledWith({ cityId: 'c1', serviceKey: 'home_cleaning' });
    expect(res[0]).toEqual(
      expect.objectContaining({
        id: 'p1',
        displayName: 'Anna',
        ratingAvg: 0,
        ratingCount: 0,
        completedJobs: 0,
        basePrice: 35,
      }),
    );
    expect(res[0].avatarUrl ?? null).toBeNull();
  });

  it('myProfile returns dto for provider', async () => {
    svcMock.getOrCreateMyProfile.mockResolvedValue({
      _id: { toString: () => 'p1' },
      userId: 'u1',
      displayName: 'Anna',
      cityId: 'c1',
      serviceKeys: ['home_cleaning'],
      basePrice: 35,
      status: 'active',
      isBlocked: false,
      blockedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const res = await controller.myProfile({ userId: 'u1', role: 'provider' } as any);

    expect(svcMock.getOrCreateMyProfile).toHaveBeenCalledWith('u1');
    expect(res).toEqual(expect.objectContaining({ id: 'p1', userId: 'u1', status: 'active' }));
  });

  it('updateMyProfile updates for provider', async () => {
    svcMock.updateMyProfile.mockResolvedValue({
      _id: { toString: () => 'p2' },
      userId: 'u2',
      displayName: 'New Name',
      cityId: 'c2',
      serviceKeys: ['window_cleaning'],
      basePrice: 50,
      status: 'active',
      isBlocked: false,
      blockedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });

    const dto = { displayName: 'New Name', cityId: 'c2' } as any;
    const res = await controller.updateMyProfile({ userId: 'u2', role: 'provider' } as any, dto);

    expect(svcMock.updateMyProfile).toHaveBeenCalledWith('u2', dto);
    expect(res).toEqual(expect.objectContaining({ id: 'p2', displayName: 'New Name' }));
  });

  it('myProfile forbids client', async () => {
    await expect(controller.myProfile({ userId: 'u3', role: 'client' } as any)).rejects.toBeInstanceOf(Error);
  });
});
