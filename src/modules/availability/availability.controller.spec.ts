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

  it('updateMy calls service for provider', async () => {
    svcMock.updateMy.mockResolvedValue(undefined);

    const res = await controller.updateMy(
      { userId: 'p1', role: 'provider' } as any,
      { timeZone: 'Europe/Berlin', isActive: true } as any,
    );

    expect(svcMock.updateMy).toHaveBeenCalledWith('p1', { timeZone: 'Europe/Berlin', isActive: true });
    expect(res).toEqual({ ok: true });
  });

  it('myBlackouts returns mapped list for provider', async () => {
    svcMock.listMyBlackouts.mockResolvedValue([
      {
        _id: { toString: () => 'b1' },
        startAt: new Date('2026-02-01T10:00:00.000Z'),
        endAt: new Date('2026-02-01T11:00:00.000Z'),
        reason: 'Vacation',
        isActive: true,
      },
    ]);

    const res = await controller.myBlackouts({ userId: 'p1', role: 'provider' } as any);

    expect(svcMock.listMyBlackouts).toHaveBeenCalledWith('p1');
    expect(res[0]).toEqual(
      expect.objectContaining({
        id: 'b1',
        reason: 'Vacation',
        isActive: true,
      }),
    );
  });

  it('addBlackout creates blackout for provider', async () => {
    svcMock.addMyBlackout.mockResolvedValue({
      _id: { toString: () => 'b2' },
      startAt: new Date('2026-02-02T10:00:00.000Z'),
      endAt: new Date('2026-02-02T12:00:00.000Z'),
      reason: null,
      isActive: true,
    });

    const res = await controller.addBlackout(
      { userId: 'p1', role: 'provider' } as any,
      { startAt: '2026-02-02T10:00:00.000Z', endAt: '2026-02-02T12:00:00.000Z', isActive: true } as any,
    );

    expect(svcMock.addMyBlackout).toHaveBeenCalledWith('p1', {
      startAt: new Date('2026-02-02T10:00:00.000Z'),
      endAt: new Date('2026-02-02T12:00:00.000Z'),
      reason: undefined,
      isActive: true,
    });
    expect(res).toEqual(expect.objectContaining({ id: 'b2', isActive: true }));
  });

  it('removeBlackout calls service for provider', async () => {
    svcMock.removeMyBlackout.mockResolvedValue(undefined);

    const res = await controller.removeBlackout(
      { userId: 'p1', role: 'provider' } as any,
      'b3',
    );

    expect(svcMock.removeMyBlackout).toHaveBeenCalledWith('p1', 'b3');
    expect(res).toEqual({ ok: true });
  });
});
