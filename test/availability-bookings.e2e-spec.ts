// test/availability-bookings.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppModule } from '../src/app.module';

import { AvailabilityService } from '../src/modules/availability/availability.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';

import { Booking, BookingDocument } from '../src/modules/bookings/schemas/booking.schema';
import { ProviderAvailability } from '../src/modules/availability/schemas/provider-availability.schema';
import { ProviderProfile } from '../src/modules/providers/schemas/provider-profile.schema';

jest.setTimeout(30000);

describe('v6.1 availability + bookings (e2e + services in one app)', () => {
  let replSet: MongoMemoryReplSet;
  let app: INestApplication;
  let moduleRef: TestingModule;

  let availability: AvailabilityService;
  let bookings: BookingsService;

  let bookingModel: Model<BookingDocument>;
  let providerAvailabilityModel: Model<any>;
  let providerProfileModel: Model<any>;

  const providerUserId = 'p1';
  const clientId = 'c1';

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = uri;
    process.env.MONGODB_URI = uri;
    process.env.DATABASE_URI = uri;
    process.env.DATABASE_URL = uri;

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // ✅ services from the same container
    availability = app.get(AvailabilityService);
    bookings = app.get(BookingsService);

    // ✅ models from the same container (same mongoose connection)
    bookingModel = app.get(getModelToken(Booking.name));
    providerAvailabilityModel = app.get(getModelToken(ProviderAvailability.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
  });

  afterAll(async () => {
    // ✅ close Nest first (it will close mongoose connection created by MongooseModule)
    if (app) await app.close();

    // extra safety: ensure mongoose is fully disconnected
    await mongoose.disconnect();

    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      bookingModel.deleteMany({}),
      providerAvailabilityModel.deleteMany({}),
      providerProfileModel.deleteMany({}),
    ]);

    await providerProfileModel.create({ userId: providerUserId, displayName: 'Test Provider' });

    await availability.updateMy(providerUserId, {
      timeZone: 'UTC',
      slotDurationMin: 60,
      bufferMin: 0,
      isActive: true,
      weekly: [{ dayOfWeek: 4, ranges: [{ start: '09:00', end: '11:00' }] }],
    } as any);
  });

  it('sanity: /health (GET)', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ ok: true });
  });

  it('create booking → slot disappears; cancel → returns; reschedule → moves; history chain ok', async () => {
    const day = '2026-02-05';

    const before = await availability.getSlots(providerUserId, day, day, 'UTC');
    expect(before.map((s: { startAt: string }) => s.startAt)).toEqual([
      '2026-02-05T09:00:00.000Z',
      '2026-02-05T10:00:00.000Z',
    ]);

    const b1 = await bookingModel.create({
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId,
      clientId,
      startAt: new Date('2026-02-05T10:00:00.000Z'),
      durationMin: 60,
      endAt: new Date('2026-02-05T11:00:00.000Z'),
      status: 'confirmed',
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      metadata: {},
    });

    const afterCreate = await availability.getSlots(providerUserId, day, day, 'UTC');
    expect(afterCreate.map((s: { startAt: string }) => s.startAt)).toEqual([
      '2026-02-05T09:00:00.000Z',
    ]);

    await bookings.cancelByProvider(providerUserId, String(b1._id), 'x');

    const afterCancel = await availability.getSlots(providerUserId, day, day, 'UTC');
    expect(afterCancel.map((s: { startAt: string }) => s.startAt)).toEqual([
      '2026-02-05T09:00:00.000Z',
      '2026-02-05T10:00:00.000Z',
    ]);

    const b2 = await bookingModel.create({
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId,
      clientId,
      startAt: new Date('2026-02-05T09:00:00.000Z'),
      durationMin: 60,
      endAt: new Date('2026-02-05T10:00:00.000Z'),
      status: 'confirmed',
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      metadata: {},
    });

    const slotsBeforeReschedule = await availability.getSlots(providerUserId, day, day, 'UTC');
    expect(slotsBeforeReschedule.map((s: { startAt: string }) => s.startAt)).toEqual([
      '2026-02-05T10:00:00.000Z',
    ]);

    const day2 = '2026-03-05';

    const day2Before = await availability.getSlots(providerUserId, day2, day2, 'UTC');
    expect(day2Before.length).toBe(2);

    const created = await bookings.reschedule(
      { userId: clientId, role: 'client' },
      String(b2._id),
      { startAt: '2026-03-05T10:00:00.000Z', durationMin: 60, reason: 'move' },
    );

    const day1AfterReschedule = await availability.getSlots(providerUserId, day, day, 'UTC');
    expect(day1AfterReschedule.map((s: { startAt: string }) => s.startAt)).toEqual([
      '2026-02-05T09:00:00.000Z',
      '2026-02-05T10:00:00.000Z',
    ]);

    const day2AfterReschedule = await availability.getSlots(providerUserId, day2, day2, 'UTC');
    expect(day2AfterReschedule.map((s: { startAt: string }) => s.startAt)).toEqual([
      '2026-03-05T09:00:00.000Z',
    ]);

    const hist = await bookings.getHistory({ userId: clientId, role: 'client' }, String(created._id));
    expect(hist.items.length).toBe(2);
    expect(hist.rootId).toBe(String(b2._id));
    expect(hist.latestId).toBe(String(created._id));
  });
});
