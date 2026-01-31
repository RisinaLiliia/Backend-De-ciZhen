// src/modules/bookings/bookings.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BookingsService } from './bookings.service';
import { Booking } from './schemas/booking.schema';
import { ProviderBlackout } from '../availability/schemas/provider-blackout.schema';
import { AvailabilityService } from '../availability/availability.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BookingsService (unit)', () => {
  let svc: BookingsService;

  const bookingModelMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    db: {
      startSession: jest.fn(),
    },
  };

  const blackoutModelMock = {
    countDocuments: jest.fn(),
  };

  const availabilityMock = {
    getSlots: jest.fn(),
  };

  const execWrap = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getModelToken(Booking.name), useValue: bookingModelMock },
        { provide: getModelToken(ProviderBlackout.name), useValue: blackoutModelMock },
        { provide: AvailabilityService, useValue: availabilityMock }, 
      ],
    }).compile();

    svc = moduleRef.get(BookingsService);
  });

  it('normalizeFilters throws if to < from', async () => {
    expect(() =>
      svc.normalizeFilters({
        from: '2026-01-02T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      } as any),
    ).toThrow(BadRequestException);
  });

  it('listMyClient applies status and date filters', async () => {
    bookingModelMock.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(execWrap([])),
        }),
      }),
    });

    await svc.listMyClient('c1', {
      status: 'confirmed',
      from: new Date('2026-01-01T00:00:00.000Z'),
      limit: 10,
      offset: 5,
    } as any);

    expect(bookingModelMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'c1',
        status: 'confirmed',
        startAt: expect.any(Object),
      }),
    );
  });

  it('cancel throws if booking not found', async () => {
    bookingModelMock.findById.mockReturnValue(execWrap(null));

    await expect(
      svc.cancel({ userId: 'c1', role: 'client' }, '507f1f77bcf86cd799439011', 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancel forbids if client is not owner', async () => {
    bookingModelMock.findById.mockReturnValue(
      execWrap({
        _id: 'b1',
        clientId: 'other',
        providerUserId: 'p1',
        status: 'confirmed',
        startAt: new Date(Date.now() + 3600000),
        save: jest.fn(),
      }),
    );

    await expect(
      svc.cancel({ userId: 'c1', role: 'client' }, '507f1f77bcf86cd799439011', 'x'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancel sets cancelled fields for provider owner', async () => {
    const later = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const doc: any = {
      _id: 'b1',
      clientId: 'c1',
      providerUserId: 'p1',
      status: 'confirmed',
      startAt: later,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    bookingModelMock.findById.mockReturnValue(execWrap(doc));

    await svc.cancel({ userId: 'p1', role: 'provider' }, '507f1f77bcf86cd799439011', 'No time');
    expect(doc.status).toBe('cancelled');
    expect(doc.cancelledBy).toBe('provider');
    expect(doc.save).toHaveBeenCalled();
  });

  it('reschedule cancels old and creates new (transaction)', async () => {
    const farFuture = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const oldDoc: any = {
      _id: 'b1',
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId: 'p1',
      clientId: 'c1',
      startAt: farFuture,
      durationMin: 60,
      endAt: new Date(farFuture.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
    };

    bookingModelMock.findById.mockReturnValue(execWrap(oldDoc));

    bookingModelMock.countDocuments.mockReturnValue({
      session: jest.fn().mockResolvedValue(0),
    });
    blackoutModelMock.countDocuments.mockReturnValue({
      session: jest.fn().mockResolvedValue(0),
    });

    const oldInTx: any = {
      ...oldDoc,
      save: jest.fn().mockResolvedValue(undefined),
    };

    bookingModelMock.findById.mockImplementation((id: any) => {
      return {
        exec: jest.fn().mockResolvedValue(oldDoc),
        session: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(oldInTx),
        }),
      };
    });

    bookingModelMock.create.mockResolvedValue([
      {
        ...oldDoc,
        _id: 'b2',
        startAt: new Date('2026-02-10T10:00:00.000Z'),
        endAt: new Date('2026-02-10T11:00:00.000Z'),
        status: 'confirmed',
      },
    ]);

    bookingModelMock.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    bookingModelMock.db.startSession.mockResolvedValue({
      withTransaction: async (fn: any) => fn(),
      endSession: jest.fn().mockResolvedValue(undefined),
    });

    availabilityMock.getSlots.mockResolvedValue([
      {
        startAt: '2026-02-10T10:00:00.000Z',
        endAt: '2026-02-10T11:00:00.000Z',
      },
    ]);

    const created = await svc.reschedule(
      { userId: 'c1', role: 'client' },
      '507f1f77bcf86cd799439011',
      { startAt: '2026-02-10T10:00:00.000Z', durationMin: 60, reason: 'x' },
    );

    expect(oldInTx.save).toHaveBeenCalled();
    expect(bookingModelMock.create).toHaveBeenCalled();
    expect(created._id).toBe('b2');
  });

  it('reschedule forbids if less than 24h before start', async () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const oldDoc: any = {
      _id: 'b1',
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId: 'p1',
      clientId: 'c1',
      startAt: soon,
      durationMin: 60,
      endAt: new Date(soon.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
    };

    (bookingModelMock as any).findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(oldDoc) });
    (bookingModelMock as any).countDocuments = jest.fn().mockResolvedValue(0);
    blackoutModelMock.countDocuments = jest.fn().mockResolvedValue(0);

    await expect(
      svc.reschedule(
        { userId: 'c1', role: 'client' },
        '507f1f77bcf86cd799439011',
        { startAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('complete sets status completed (provider)', async () => {
    const ended = new Date(Date.now() - 10 * 60 * 1000);
    const started = new Date(Date.now() - 70 * 60 * 1000);

    const b: any = {
      _id: 'b1',
      providerUserId: 'p1',
      clientId: 'c1',
      status: 'confirmed',
      startAt: started,
      endAt: ended,
    };

    (bookingModelMock as any).findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(b) });
    (bookingModelMock as any).updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    await svc.complete({ userId: 'p1', role: 'provider' }, '507f1f77bcf86cd799439011');
    expect((bookingModelMock as any).updateOne).toHaveBeenCalled();
  });

  it('cancel forbids if less than N hours before start', async () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const b: any = {
      _id: 'b1',
      clientId: 'c1',
      providerUserId: 'p1',
      status: 'confirmed',
      startAt: soon,
      endAt: new Date(soon.getTime() + 60 * 60 * 1000),
    };

    bookingModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(b) });

    await expect(svc.cancelByClient('c1', '507f1f77bcf86cd799439011', 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cancel allows provider to cancel own booking (atomic update)', async () => {
    const later = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const b: any = {
      _id: 'b1',
      clientId: 'c1',
      providerUserId: 'p1',
      status: 'confirmed',
      startAt: later,
      endAt: new Date(later.getTime() + 60 * 60 * 1000),
    };

    bookingModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(b) });
    bookingModelMock.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });

    await svc.cancelByProvider('p1', '507f1f77bcf86cd799439011', 'No availability');
    expect(bookingModelMock.updateOne).toHaveBeenCalled();
  });

  it('getHistory returns ordered chain root->latest', async () => {
    const id1 = '507f1f77bcf86cd799439011';
    const id2 = '507f1f77bcf86cd799439012';
    const id3 = '507f1f77bcf86cd799439013';

    const requestedLean: any = {
      _id: id2,
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId: 'p1',
      clientId: 'c1',
    };

    const b1: any = {
      _id: id1,
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId: 'p1',
      clientId: 'c1',
      rescheduledFromId: null,
      rescheduledToId: id2,
      startAt: new Date(),
      durationMin: 60,
      endAt: new Date(),
      status: 'cancelled',
    };
    const b2: any = {
      _id: id2,
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId: 'p1',
      clientId: 'c1',
      rescheduledFromId: id1,
      rescheduledToId: id3,
      startAt: new Date(),
      durationMin: 60,
      endAt: new Date(),
      status: 'cancelled',
    };
    const b3: any = {
      _id: id3,
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId: 'p1',
      clientId: 'c1',
      rescheduledFromId: id2,
      rescheduledToId: null,
      startAt: new Date(),
      durationMin: 60,
      endAt: new Date(),
      status: 'confirmed',
    };

    bookingModelMock.findById.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(requestedLean),
        }),
      }),
    }));

    bookingModelMock.find.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([b1, b2, b3]),
        }),
      }),
    }));

    const res = await svc.getHistory({ userId: 'c1', role: 'client' }, id2);

    expect(res.rootId).toBe(id1);
    expect(res.latestId).toBe(id3);
    expect(res.currentIndex).toBe(1);
    expect(res.items.map((x: any) => String(x._id))).toEqual([id1, id2, id3]);
  });
});
