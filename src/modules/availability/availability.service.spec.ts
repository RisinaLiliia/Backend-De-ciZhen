// src/modules/availability/availability.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AvailabilityService } from './availability.service';
import { ProviderAvailability } from './schemas/provider-availability.schema';
import { ProviderBlackout } from './schemas/provider-blackout.schema';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';
import { Booking } from '../bookings/schemas/booking.schema';
import { BadRequestException } from '@nestjs/common';

describe('AvailabilityService v3 (bookings)', () => {
  let svc: AvailabilityService;

  const availabilityModelMock = { findOne: jest.fn(), create: jest.fn() };
  const providerModelMock = { findOne: jest.fn() };
  const blackoutModelMock = { find: jest.fn(), create: jest.fn(), deleteOne: jest.fn() };
  const bookingModelMock = { find: jest.fn() };

  const execWrap = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: getModelToken(ProviderAvailability.name), useValue: availabilityModelMock },
        { provide: getModelToken(ProviderProfile.name), useValue: providerModelMock },
        { provide: getModelToken(ProviderBlackout.name), useValue: blackoutModelMock },
        { provide: getModelToken(Booking.name), useValue: bookingModelMock },
      ],
    }).compile();

    svc = moduleRef.get(AvailabilityService);
  });

  it('getSlots enforces max range (14 days)', async () => {
    availabilityModelMock.findOne.mockReturnValue(
      execWrap({ isActive: true, timeZone: 'Europe/Berlin', weekly: [], slotDurationMin: 60, bufferMin: 0 }),
    );

    await expect(svc.getSlots('p1', '2026-01-01', '2026-01-20')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getSlots filters out slots that intersect blackout', async () => {
    availabilityModelMock.findOne.mockReturnValue(
      execWrap({
        isActive: true,
        timeZone: 'Europe/Berlin',
        slotDurationMin: 60,
        bufferMin: 0,
        weekly: [{ dayOfWeek: 4, ranges: [{ start: '09:00', end: '11:00' }] }], 
      }),
    );

    blackoutModelMock.find.mockReturnValue(
      execWrap([
        { startAt: new Date('2026-02-05T09:00:00.000Z'), endAt: new Date('2026-02-05T10:00:00.000Z') },
      ]),
    );

    bookingModelMock.find.mockReturnValue({
      select: jest.fn().mockReturnValue(execWrap([])),
    });

    const res = await svc.getSlots('p1', '2026-02-05', '2026-02-05', 'UTC');
    expect(res.length).toBe(1);
  });

  it('getSlots filters out slots that intersect confirmed booking', async () => {
    availabilityModelMock.findOne.mockReturnValue(
      execWrap({
        isActive: true,
        timeZone: 'UTC',
        slotDurationMin: 60,
        bufferMin: 0,
        weekly: [{ dayOfWeek: 4, ranges: [{ start: '09:00', end: '11:00' }] }], // Thu
      }),
    );

    blackoutModelMock.find.mockReturnValue(execWrap([]));

    bookingModelMock.find.mockReturnValue({
      select: jest.fn().mockReturnValue(
        execWrap([
          { startAt: new Date('2026-02-05T10:00:00.000Z'), endAt: new Date('2026-02-05T11:00:00.000Z') },
        ]),
      ),
    });

    const res = await svc.getSlots('p1', '2026-02-05', '2026-02-05', 'UTC');
    expect(res.length).toBe(1);
    expect(res[0].startAt).toContain('09:00:00.000Z');
  });
});
