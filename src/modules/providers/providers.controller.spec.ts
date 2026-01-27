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
});
