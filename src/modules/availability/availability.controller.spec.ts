// src/modules/availability/availability.controller.spec.ts
import { Test } from '@nestjs/testing';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { ForbiddenException } from '@nestjs/common';

describe('AvailabilityController v2 (unit)', () => {
  let controller: AvailabilityController;

  const svcMock = {
    updateMy: jest.fn(),
    getSlots: jest.fn(),
    listMyBlackouts: jest.fn(),
    addMyBlackout: jest.fn(),
    removeMyBlackout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [{ provide: AvailabilityService, useValue: svcMock }],
    }).compile();
    controller = moduleRef.get(AvailabilityController);
  });

  it('public slots supports tz', async () => {
    svcMock.getSlots.mockResolvedValue([{ startAt: 'x', endAt: 'y' }]);
    const res = await controller.listSlots('p1', { from: '2026-01-29', to: '2026-01-29', tz: 'UTC' } as any);
    expect(svcMock.getSlots).toHaveBeenCalledWith('p1', '2026-01-29', '2026-01-29', 'UTC');
    expect(res).toHaveLength(1);
  });

  it('provider blackouts forbidden for client', async () => {
    await expect(controller.myBlackouts({ userId: 'c1', role: 'client' } as any))
      .rejects
      .toBeInstanceOf(ForbiddenException);
  });
});
