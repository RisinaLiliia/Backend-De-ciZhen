// test/bookings-my.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';

import { AvailabilityService } from '../src/modules/availability/availability.service';
import { Booking, BookingDocument } from '../src/modules/bookings/schemas/booking.schema';
import { ProviderAvailability } from '../src/modules/availability/schemas/provider-availability.schema';
import { ProviderProfile } from '../src/modules/providers/schemas/provider-profile.schema';

jest.setTimeout(30000);

describe('v6.2 bookings /my (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let availability: AvailabilityService;

  let bookingModel: Model<BookingDocument>;
  let providerAvailabilityModel: Model<any>;
  let providerProfileModel: Model<any>;

  const providerUserId = 'p1';

  async function createBookingAsClient(
    token: string,
    payload: {
      requestId: string;
      offerId: string;
      providerUserId: string;
      startAt: string;
      durationMin?: number;
      note?: string;
    },
  ) {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    return res.body;
  }

  async function ensureProviderHasAvailability(providerId: string) {
    await providerProfileModel.create({ userId: providerId, displayName: `Provider ${providerId}` });

    await availability.updateMy(providerId, {
      timeZone: 'UTC',
      slotDurationMin: 60,
      bufferMin: 0,
      isActive: true,
      weekly: [{ dayOfWeek: 4, ranges: [{ start: '09:00', end: '11:00' }] }],
    } as any);
  }

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    availability = app.get(AvailabilityService);

    bookingModel = app.get(getModelToken(Booking.name));
    providerAvailabilityModel = app.get(getModelToken(ProviderAvailability.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      bookingModel.deleteMany({}),
      providerAvailabilityModel.deleteMany({}),
      providerProfileModel.deleteMany({}),
    ]);

    await ensureProviderHasAvailability(providerUserId);
  });

  it('GET /bookings/my: client sees own bookings; provider sees own bookings', async () => {
    const client = await registerAndGetToken(app, 'client', 'client1@test.local', 'Client One');
    const provider = await registerAndGetToken(app, 'provider', 'provider1@test.local', 'Provider One');

    await createBookingAsClient(client.accessToken, {
      requestId: 'req-my-1',
      offerId: 'resp-my-1',
      providerUserId,
      startAt: '2026-03-05T09:00:00.000Z', 
      durationMin: 60,
      note: 'A',
    });

    await createBookingAsClient(client.accessToken, {
      requestId: 'req-my-2',
      offerId: 'resp-my-2',
      providerUserId,
      startAt: '2026-03-05T10:00:00.000Z', 
      durationMin: 60,
      note: 'B',
    });

    const myClient = await request(app.getHttpServer())
      .get('/bookings/my')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(Array.isArray(myClient.body)).toBe(true);
    expect(myClient.body.length).toBe(2);

    expect(myClient.body[0]).toMatchObject({
      requestId: 'req-my-2',
      offerId: 'resp-my-2',
      status: 'confirmed',
      startAt: '2026-03-05T10:00:00.000Z',
      endAt: '2026-03-05T11:00:00.000Z',
    });

    expect(myClient.body[1]).toMatchObject({
      requestId: 'req-my-1',
      offerId: 'resp-my-1',
      status: 'confirmed',
      startAt: '2026-03-05T09:00:00.000Z',
      endAt: '2026-03-05T10:00:00.000Z',
    });

    const myProvider0 = await request(app.getHttpServer())
      .get('/bookings/my')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    expect(Array.isArray(myProvider0.body)).toBe(true);
    expect(myProvider0.body.length).toBe(0);

    if (provider.userId) {
      await ensureProviderHasAvailability(String(provider.userId));

      await createBookingAsClient(client.accessToken, {
        requestId: 'req-my-3',
        offerId: 'resp-my-3',
        providerUserId: String(provider.userId),
        startAt: '2026-03-05T09:00:00.000Z', 
        durationMin: 60,
      });

      const myProvider = await request(app.getHttpServer())
        .get('/bookings/my')
        .set('Authorization', `Bearer ${provider.accessToken}`)
        .expect(200);

      expect(myProvider.body.length).toBe(1);
      expect(myProvider.body[0]).toMatchObject({
        requestId: 'req-my-3',
        offerId: 'resp-my-3',
        providerUserId: String(provider.userId),
        status: 'confirmed',
        startAt: '2026-03-05T09:00:00.000Z',
        endAt: '2026-03-05T10:00:00.000Z',
      });
    }
  });

  it('GET /bookings/my supports filters: status, from/to, limit/offset', async () => {
    const client = await registerAndGetToken(app, 'client', 'client2@test.local', 'Client Two');

    await createBookingAsClient(client.accessToken, {
      requestId: 'req-f-1',
      offerId: 'resp-f-1',
      providerUserId,
      startAt: '2026-03-05T09:00:00.000Z',
      durationMin: 60,
    });

    await createBookingAsClient(client.accessToken, {
      requestId: 'req-f-2',
      offerId: 'resp-f-2',
      providerUserId,
      startAt: '2026-03-05T10:00:00.000Z',
      durationMin: 60,
    });

    await createBookingAsClient(client.accessToken, {
      requestId: 'req-f-3',
      offerId: 'resp-f-3',
      providerUserId,
      startAt: '2026-03-12T09:00:00.000Z',
      durationMin: 60,
    });

    const marchWeek1Only = await request(app.getHttpServer())
      .get('/bookings/my')
      .query({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-08T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(marchWeek1Only.body.length).toBe(2);
    expect(marchWeek1Only.body.map((x: any) => x.requestId).sort()).toEqual(['req-f-1', 'req-f-2']);

    const paged = await request(app.getHttpServer())
      .get('/bookings/my')
      .query({ limit: 1, offset: 1 })
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(paged.body.length).toBe(1);
    expect(paged.body[0].requestId).toBe('req-f-2');

    const myAll = await request(app.getHttpServer())
      .get('/bookings/my')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    const targetId = myAll.body.find((x: any) => x.requestId === 'req-f-2')?.id;
    expect(targetId).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/bookings/${targetId}/cancel`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ reason: 'changed plans' })
      .expect(200);

    const onlyCancelled = await request(app.getHttpServer())
      .get('/bookings/my')
      .query({ status: 'cancelled' })
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(onlyCancelled.body.length).toBe(1);
    expect(onlyCancelled.body[0].requestId).toBe('req-f-2');

    const onlyConfirmed = await request(app.getHttpServer())
      .get('/bookings/my')
      .query({ status: 'confirmed' })
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(onlyConfirmed.body.length).toBe(2);
    expect(onlyConfirmed.body.map((x: any) => x.requestId).sort()).toEqual(['req-f-1', 'req-f-3']);
  });

  it('GET /bookings/my requires auth (401)', async () => {
    await request(app.getHttpServer()).get('/bookings/my').expect(401);
  });
});
