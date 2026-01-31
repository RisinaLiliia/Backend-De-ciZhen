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

  const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function registerAndGetToken(
  app: INestApplication,
  role: 'client' | 'provider',
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  const password = 'Passw0rd!123';

  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .set('Content-Type', 'application/json')
    .send({
      name: `${role} Test`,
      email,
      password,
      role,
      acceptPrivacyPolicy: true,
    })
    .expect(201);

  expect(res.body?.accessToken).toBeTruthy();
  expect(res.body?.user?.id).toBeTruthy();

  return { accessToken: res.body.accessToken as string, userId: res.body.user.id as string };
}


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

    availability = app.get(AvailabilityService);
    bookings = app.get(BookingsService);

    bookingModel = app.get(getModelToken(Booking.name));
    providerAvailabilityModel = app.get(getModelToken(ProviderAvailability.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
  });

  afterAll(async () => {
    if (app) await app.close();
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

  it('create booking → slot disappears; cancel → returns; reschedule → moves; history chain ok (services)', async () => {
    const clientId = 'c1';
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
    expect(afterCreate.map((s: { startAt: string }) => s.startAt)).toEqual(['2026-02-05T09:00:00.000Z']);

    await bookings.cancelByProvider(providerUserId, String(b1._id), 'x');

    const afterCancel = await availability.getSlots(providerUserId, day, day, 'UTC');
    expect(afterCancel.map((s: { startAt: string }) => s.startAt)).toEqual([
      '2026-02-05T09:00:00.000Z',
      '2026-02-05T10:00:00.000Z',
    ]);

    const b2 = await bookingModel.create({
      requestId: 'r2',
      responseId: 'resp2',
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
    expect(slotsBeforeReschedule.map((s: { startAt: string }) => s.startAt)).toEqual(['2026-02-05T10:00:00.000Z']);

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
    expect(day2AfterReschedule.map((s: { startAt: string }) => s.startAt)).toEqual(['2026-03-05T09:00:00.000Z']);

    const hist = await bookings.getHistory({ userId: clientId, role: 'client' }, String(created._id));
    expect(hist.items.length).toBe(2);
    expect(hist.rootId).toBe(String(b2._id));
    expect(hist.latestId).toBe(String(created._id));
  });

  it('HTTP: client can create booking -> slot disappears', async () => {
    const email = `${uid('c1')}@test.local`;
    const { accessToken } = await registerAndGetToken(app, 'client', email);

    const day = '2026-02-05';
    const slotsBefore = await availability.getSlots(providerUserId, day, day, 'UTC');
    expect(slotsBefore.map((s: any) => s.startAt)).toEqual([
      '2026-02-05T09:00:00.000Z',
      '2026-02-05T10:00:00.000Z',
    ]);

    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        requestId: uid('req-e2e'),
        responseId: uid('resp-e2e'),
        providerUserId,
        startAt: '2026-02-05T10:00:00.000Z',
        durationMin: 60,
        note: 'hello',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      providerUserId,
      startAt: '2026-02-05T10:00:00.000Z',
      endAt: '2026-02-05T11:00:00.000Z',
      status: 'confirmed',
    });

    const slotsAfter = await availability.getSlots(providerUserId, day, day, 'UTC');
    expect(slotsAfter.map((s: any) => s.startAt)).toEqual(['2026-02-05T09:00:00.000Z']);
  });

  it('HTTP: create booking fails if startAt not in availability slots (409)', async () => {
    const email = `${uid('c2')}@test.local`;
    const { accessToken } = await registerAndGetToken(app, 'client', email);

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        requestId: uid('req-e2e-badslot'),
        responseId: uid('resp-e2e-badslot'),
        providerUserId,
        startAt: '2026-02-05T09:30:00.000Z',
        durationMin: 60,
      })
      .expect(409);
  });

  it('HTTP: create booking fails if slot already taken (409)', async () => {
    const { accessToken: t1 } = await registerAndGetToken(app, 'client', `${uid('c3')}@test.local`);
    const { accessToken: t2 } = await registerAndGetToken(app, 'client', `${uid('c4')}@test.local`);

    const payload = {
      providerUserId,
      startAt: '2026-02-05T10:00:00.000Z',
      durationMin: 60,
    };

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${t1}`)
      .send({ requestId: uid('req-e2e-a'), responseId: uid('resp-e2e-a'), ...payload })
      .expect(201);

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${t2}`)
      .send({ requestId: uid('req-e2e-b'), responseId: uid('resp-e2e-b'), ...payload })
      .expect(409);
  });

  it('HTTP FLOW: create -> cancel -> create -> reschedule -> history chain ok', async () => {
  const providerEmail = `${uid('prov')}@test.local`;
  const clientEmail = `${uid('client')}@test.local`;

  const { accessToken: providerToken, userId: providerId } = await registerAndGetToken(app, 'provider', providerEmail);
  const { accessToken: clientToken, userId: clientId } = await registerAndGetToken(app, 'client', clientEmail);

  await providerProfileModel.create({ userId: providerId, displayName: 'HTTP Provider' });

  await availability.updateMy(providerId, {
    timeZone: 'UTC',
    slotDurationMin: 60,
    bufferMin: 0,
    isActive: true,
    weekly: [{ dayOfWeek: 4, ranges: [{ start: '09:00', end: '11:00' }] }], 
  } as any);

  const day1 = '2026-02-05'; 
  const day2 = '2026-03-05'; 

  const slots0 = await availability.getSlots(providerId, day1, day1, 'UTC');
  expect(slots0.map((s: any) => s.startAt)).toEqual([
    '2026-02-05T09:00:00.000Z',
    '2026-02-05T10:00:00.000Z',
  ]);

  const reqA = uid('reqA');
  const respA = uid('respA');

  const created1 = await request(app.getHttpServer())
    .post('/bookings')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      requestId: reqA,
      responseId: respA,
      providerUserId: providerId,
      startAt: '2026-02-05T10:00:00.000Z',
      durationMin: 60,
      note: 'hello',
    })
    .expect(201);

  expect(created1.body).toMatchObject({
    requestId: reqA,
    responseId: respA,
    providerUserId: providerId,
    clientId: clientId,
    startAt: '2026-02-05T10:00:00.000Z',
    endAt: '2026-02-05T11:00:00.000Z',
    status: 'confirmed',
  });

  const bookingId1 = created1.body.id as string;
  expect(bookingId1).toBeTruthy();

  const slots1 = await availability.getSlots(providerId, day1, day1, 'UTC');
  expect(slots1.map((s: any) => s.startAt)).toEqual(['2026-02-05T09:00:00.000Z']);

  await request(app.getHttpServer())
    .patch(`/bookings/${bookingId1}/cancel`)
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ reason: 'change of plans' })
    .expect(200);

  const slots2 = await availability.getSlots(providerId, day1, day1, 'UTC');
  expect(slots2.map((s: any) => s.startAt)).toEqual([
    '2026-02-05T09:00:00.000Z',
    '2026-02-05T10:00:00.000Z',
  ]);

  const reqB = uid('reqB');
  const respB = uid('respB');

  const created2 = await request(app.getHttpServer())
    .post('/bookings')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      requestId: reqB,
      responseId: respB,
      providerUserId: providerId,
      startAt: '2026-02-05T09:00:00.000Z',
      durationMin: 60,
    })
    .expect(201);

  const bookingId2 = created2.body.id as string;

  const rescheduled = await request(app.getHttpServer())
    .patch(`/bookings/${bookingId2}/reschedule`)
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      startAt: '2026-03-05T10:00:00.000Z',
      durationMin: 60,
      reason: 'move',
    })
    .expect(200);

  expect(rescheduled.body).toMatchObject({
    requestId: reqB,
    responseId: respB,
    providerUserId: providerId,
    clientId: clientId,
    startAt: '2026-03-05T10:00:00.000Z',
    endAt: '2026-03-05T11:00:00.000Z',
    status: 'confirmed',
    rescheduledFromId: bookingId2,
  });

  const newBookingId = rescheduled.body.id as string;
  expect(newBookingId).toBeTruthy();

  const day1After = await availability.getSlots(providerId, day1, day1, 'UTC');
  expect(day1After.map((s: any) => s.startAt)).toEqual([
    '2026-02-05T09:00:00.000Z',
    '2026-02-05T10:00:00.000Z',
  ]);

  const day2After = await availability.getSlots(providerId, day2, day2, 'UTC');
  expect(day2After.map((s: any) => s.startAt)).toEqual(['2026-03-05T09:00:00.000Z']);

  const hist = await request(app.getHttpServer())
    .get(`/bookings/${newBookingId}/history`)
    .set('Authorization', `Bearer ${clientToken}`)
    .expect(200);

  expect(hist.body.rootId).toBe(bookingId2);
  expect(hist.body.latestId).toBe(newBookingId);
  expect(hist.body.items).toHaveLength(2);
  expect(hist.body.items.map((x: any) => x.id)).toEqual([bookingId2, newBookingId]);
});

});
