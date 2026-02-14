// test/availability-blackouts.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { ProviderProfile, ProviderProfileDocument } from '../src/modules/providers/schemas/provider-profile.schema';
import { ProviderAvailability, ProviderAvailabilityDocument } from '../src/modules/availability/schemas/provider-availability.schema';
import { ProviderBlackout, ProviderBlackoutDocument } from '../src/modules/availability/schemas/provider-blackout.schema';

jest.setTimeout(30000);

describe('availability blackouts (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let providerProfileModel: Model<ProviderProfileDocument>;
  let availabilityModel: Model<ProviderAvailabilityDocument>;
  let blackoutModel: Model<ProviderBlackoutDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
    availabilityModel = app.get(getModelToken(ProviderAvailability.name));
    blackoutModel = app.get(getModelToken(ProviderBlackout.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      providerProfileModel.deleteMany({}),
      availabilityModel.deleteMany({}),
      blackoutModel.deleteMany({}),
    ]);
  });

  it('provider can update availability', async () => {
    const provider = await registerAndGetToken(app, 'provider', 'prov-avail@test.local', 'Provider Avail');

    await providerProfileModel.findOneAndUpdate(
      { userId: provider.userId },
      { userId: provider.userId, status: 'active', isBlocked: false },
      { upsert: true, new: true },
    );

    await request(app.getHttpServer())
      .patch('/availability/me')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        timeZone: 'Europe/Berlin',
        slotDurationMin: 60,
        bufferMin: 0,
        isActive: true,
        weekly: [
          {
            dayOfWeek: 1,
            ranges: [{ start: '09:00', end: '12:00' }],
          },
        ],
      })
      .expect(200)
      .expect({ ok: true });

    const saved = await availabilityModel.findOne({ providerUserId: provider.userId }).exec();
    expect(saved?.timeZone).toBe('Europe/Berlin');
    expect(saved?.slotDurationMin).toBe(60);
    expect(saved?.weekly?.length).toBe(1);
  });

  it('provider can manage blackouts', async () => {
    const provider = await registerAndGetToken(app, 'provider', 'prov-blackout@test.local', 'Provider Blackout');

    await providerProfileModel.findOneAndUpdate(
      { userId: provider.userId },
      { userId: provider.userId, status: 'active', isBlocked: false },
      { upsert: true, new: true },
    );

    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);

    const createRes = await request(app.getHttpServer())
      .post('/availability/me/blackouts')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        reason: 'Vacation',
        isActive: true,
      })
      .expect(201);

    expect(createRes.body).toMatchObject({
      reason: 'Vacation',
      isActive: true,
    });

    const listRes = await request(app.getHttpServer())
      .get('/availability/me/blackouts')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    expect(listRes.body.length).toBe(1);
    const blackoutId = listRes.body[0].id as string;

    await request(app.getHttpServer())
      .delete(`/availability/me/blackouts/${blackoutId}`)
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200)
      .expect({ ok: true });

    const listAfter = await request(app.getHttpServer())
      .get('/availability/me/blackouts')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .expect(200);

    expect(listAfter.body.length).toBe(0);
  });

  it('GET /availability/providers/:providerUserId/slots returns slots (HTTP)', async () => {
    const provider = await registerAndGetToken(app, 'provider', 'prov-slots@test.local', 'Provider Slots');
    await providerProfileModel.findOneAndUpdate(
      { userId: provider.userId },
      { userId: provider.userId, status: 'active', isBlocked: false },
      { upsert: true, new: true },
    );

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const isoDay = tomorrow.toISOString().slice(0, 10);
    const dayOfWeek = tomorrow.getUTCDay();

    await request(app.getHttpServer())
      .patch('/availability/me')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        timeZone: 'UTC',
        slotDurationMin: 60,
        bufferMin: 0,
        isActive: true,
        weekly: [
          {
            dayOfWeek,
            ranges: [{ start: '09:00', end: '10:00' }],
          },
        ],
      })
      .expect(200)
      .expect({ ok: true });

    const res = await request(app.getHttpServer())
      .get(`/availability/providers/${provider.userId}/slots`)
      .query({ from: isoDay, to: isoDay, tz: 'UTC' })
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].startAt).toContain(`${isoDay}T09:00`);
  });
});
