// src/modules/bookings/bookings.controller.spec.ts
import { Test } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { ForbiddenException } from '@nestjs/common';

describe('BookingsController (unit)', () => {
  let controller: BookingsController;

  const svcMock = {
    normalizeFilters: jest.fn().mockReturnValue({}),
    listMyClient: jest.fn(),
    listMyProvider: jest.fn(),
    cancelByClient: jest.fn(),
    cancelByProvider: jest.fn(),
    cancelByAdmin: jest.fn(),
    reschedule: jest.fn(),
    complete: jest.fn(),
    getHistory: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: svcMock }],
    }).compile();

    controller = moduleRef.get(BookingsController);
  });

  it('GET /bookings/my uses client list for client role', async () => {
    svcMock.listMyClient.mockResolvedValue([
      {
        _id: { toString: () => 'b1' },
        requestId: 'r1',
        responseId: 'resp1',
        providerUserId: 'p1',
        clientId: 'c1',
        startAt: new Date(),
        durationMin: 60,
        endAt: new Date(Date.now() + 3600000),
        status: 'confirmed',
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      },
    ]);

    const res = await controller.my({ userId: 'c1', role: 'client' } as any, {} as any);
    expect(svcMock.listMyClient).toHaveBeenCalledWith('c1', {});
    expect(res[0]).toEqual(expect.objectContaining({ id: 'b1', status: 'confirmed' }));
  });

  it('GET /bookings/my uses provider list for provider role', async () => {
    svcMock.normalizeFilters.mockReturnValue({
      status: 'confirmed',
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-01T00:00:00.000Z'),
      limit: 10,
      offset: 5,
    });
    svcMock.listMyProvider.mockResolvedValue([]);
    await controller.my(
      { userId: 'p1', role: 'provider' } as any,
      { status: 'confirmed', from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z', limit: 10, offset: 5 } as any,
    );
    expect(svcMock.normalizeFilters).toHaveBeenCalled();
    expect(svcMock.listMyProvider).toHaveBeenCalledWith(
      'p1',
      {
        status: 'confirmed',
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-02-01T00:00:00.000Z'),
        limit: 10,
        offset: 5,
      },
    );
  });

  it('GET /bookings/my forbids admin (no explicit mode)', async () => {
    await expect(controller.my({ userId: 'a1', role: 'admin' } as any, {} as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('PATCH /bookings/:id/cancel calls service', async () => {
    svcMock.cancelByClient.mockResolvedValue(undefined);
    const res = await controller.cancel(
      { userId: 'c1', role: 'client' } as any,
      '507f1f77bcf86cd799439011',
      { reason: 'x' } as any,
    );
    expect(svcMock.cancelByClient).toHaveBeenCalledWith('c1', '507f1f77bcf86cd799439011', 'x');
    expect(res).toEqual({ ok: true, bookingId: '507f1f77bcf86cd799439011', status: 'cancelled' });
  });

  it('PATCH /bookings/:id/reschedule returns created booking dto', async () => {
    svcMock.reschedule.mockResolvedValue({
      _id: { toString: () => 'b2' },
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId: 'p1',
      clientId: 'c1',
      startAt: new Date('2026-02-10T10:00:00.000Z'),
      durationMin: 60,
      endAt: new Date('2026-02-10T11:00:00.000Z'),
      status: 'confirmed',
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      rescheduledFromId: 'b1',
      rescheduledToId: null,
      rescheduledAt: null,
      rescheduleReason: null,
    });

    const res = await controller.reschedule(
      { userId: 'c1', role: 'client' } as any,
      '507f1f77bcf86cd799439011',
      { startAt: '2026-02-10T10:00:00.000Z', durationMin: 60, reason: 'x' } as any,
    );

    expect(svcMock.reschedule).toHaveBeenCalled();
    expect(res).toEqual(expect.objectContaining({ id: 'b2', status: 'confirmed', rescheduledFromId: 'b1' }));
  });
  
  it('PATCH /bookings/:id/complete ok for provider', async () => {
    svcMock.complete.mockResolvedValue(undefined);

    const res = await controller.complete(
      { userId: 'p1', role: 'provider' } as any,
      '507f1f77bcf86cd799439011',
    );

    expect(svcMock.complete).toHaveBeenCalledWith({ userId: 'p1', role: 'provider' }, '507f1f77bcf86cd799439011');
    expect(res).toEqual({ ok: true, bookingId: '507f1f77bcf86cd799439011', status: 'completed' });
  });

  it('cancel allows provider', async () => {
    svcMock.cancelByProvider.mockResolvedValue(undefined);

  const res = await controller.cancel(
    { userId: 'p1', role: 'provider' } as any,
    '507f1f77bcf86cd799439011',
    { reason: 'No availability' } as any,
  );

  expect(svcMock.cancelByProvider).toHaveBeenCalledWith(
    'p1',
    '507f1f77bcf86cd799439011',
    'No availability',
  );
  expect(res).toEqual({ ok: true, bookingId: '507f1f77bcf86cd799439011', status: 'cancelled' });
});

  it('cancel allows admin', async () => {
    svcMock.cancelByAdmin.mockResolvedValue(undefined);

  const res = await controller.cancel(
    { userId: 'a1', role: 'admin' } as any,
    '507f1f77bcf86cd799439011',
    { reason: 'Force cancel' } as any,
  );

  expect(svcMock.cancelByAdmin).toHaveBeenCalledWith(
    'a1',
    '507f1f77bcf86cd799439011',
    'Force cancel',
  );
  expect(res).toEqual({ ok: true, bookingId: '507f1f77bcf86cd799439011', status: 'cancelled' });
});

    it('GET /bookings/:id/history returns chain dto', async () => {
    svcMock.getHistory.mockResolvedValue({
      rootId: 'b1',
      requestedId: 'b2',
      latestId: 'b3',
      currentIndex: 1,
      items: [
        { _id: { toString: () => 'b1' }, requestId: 'r1', responseId: 'resp1', providerUserId: 'p1', clientId: 'c1', startAt: new Date(), durationMin: 60, endAt: new Date(), status: 'cancelled' },
        { _id: { toString: () => 'b2' }, requestId: 'r1', responseId: 'resp1', providerUserId: 'p1', clientId: 'c1', startAt: new Date(), durationMin: 60, endAt: new Date(), status: 'cancelled' },
        { _id: { toString: () => 'b3' }, requestId: 'r1', responseId: 'resp1', providerUserId: 'p1', clientId: 'c1', startAt: new Date(), durationMin: 60, endAt: new Date(), status: 'confirmed' },
      ],
    });

    const res = await controller.history({ userId: 'c1', role: 'client' } as any, 'b2');

    expect(svcMock.getHistory).toHaveBeenCalledWith({ userId: 'c1', role: 'client' }, 'b2');
    expect(res.rootId).toBe('b1');
    expect(res.latestId).toBe('b3');
    expect(res.currentIndex).toBe(1);
    expect(res.items).toHaveLength(3);
  });


});
