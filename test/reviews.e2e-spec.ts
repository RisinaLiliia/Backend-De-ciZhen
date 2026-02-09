// test/reviews.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { Booking, BookingDocument } from '../src/modules/bookings/schemas/booking.schema';
import { Review, ReviewDocument } from '../src/modules/reviews/schemas/review.schema';
import { ClientProfile, ClientProfileDocument } from '../src/modules/users/schemas/client-profile.schema';
import { ProviderProfile, ProviderProfileDocument } from '../src/modules/providers/schemas/provider-profile.schema';

jest.setTimeout(30000);

describe('reviews (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let bookingModel: Model<BookingDocument>;
  let reviewModel: Model<ReviewDocument>;
  let clientProfileModel: Model<ClientProfileDocument>;
  let providerProfileModel: Model<ProviderProfileDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    bookingModel = app.get(getModelToken(Booking.name));
    reviewModel = app.get(getModelToken(Review.name));
    clientProfileModel = app.get(getModelToken(ClientProfile.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      bookingModel.deleteMany({}),
      reviewModel.deleteMany({}),
      clientProfileModel.deleteMany({}),
      providerProfileModel.deleteMany({}),
    ]);
  });

  it('provider can review client for completed booking', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-rev@test.local', 'Client Rev');
    const provider = await registerAndGetToken(app, 'provider', 'prov-rev@test.local', 'Provider Rev');

    await providerProfileModel.create({ userId: provider.userId, status: 'active', isBlocked: false });

    const booking = await bookingModel.create({
      requestId: 'r1',
      responseId: 'resp1',
      providerUserId: provider.userId,
      clientId: client.userId,
      startAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      durationMin: 60,
      status: 'completed',
    });

    const res = await request(app.getHttpServer())
      .post('/reviews/client')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ bookingId: booking._id.toString(), rating: 5, text: 'Great client' })
      .expect(201);

    expect(res.body).toMatchObject({
      bookingId: booking._id.toString(),
      targetRole: 'client',
      rating: 5,
      text: 'Great client',
    });

    const profile = await clientProfileModel.findOne({ userId: client.userId }).exec();
    expect(profile?.ratingCount).toBe(1);
    expect(profile?.ratingAvg).toBe(5);
  });

  it('client can review provider for completed booking', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-rev2@test.local', 'Client Rev2');
    const provider = await registerAndGetToken(app, 'provider', 'prov-rev2@test.local', 'Provider Rev2');

    await providerProfileModel.create({ userId: provider.userId, status: 'active', isBlocked: false });

    const booking = await bookingModel.create({
      requestId: 'r2',
      responseId: 'resp2',
      providerUserId: provider.userId,
      clientId: client.userId,
      startAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      durationMin: 60,
      status: 'completed',
    });

    const res = await request(app.getHttpServer())
      .post('/reviews/provider')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ bookingId: booking._id.toString(), rating: 4, text: 'Good work' })
      .expect(201);

    expect(res.body).toMatchObject({
      bookingId: booking._id.toString(),
      targetRole: 'provider',
      rating: 4,
      text: 'Good work',
    });

    const profile = await providerProfileModel.findOne({ userId: provider.userId }).exec();
    expect(profile?.ratingCount).toBe(1);
    expect(profile?.ratingAvg).toBe(4);
  });

  it('GET /reviews lists reviews by targetUserId', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-rev3@test.local', 'Client Rev3');
    const provider = await registerAndGetToken(app, 'provider', 'prov-rev3@test.local', 'Provider Rev3');

    await providerProfileModel.create({ userId: provider.userId, status: 'active', isBlocked: false });

    const booking = await bookingModel.create({
      requestId: 'r3',
      responseId: 'resp3',
      providerUserId: provider.userId,
      clientId: client.userId,
      startAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      durationMin: 60,
      status: 'completed',
    });

    await reviewModel.create({
      authorUserId: provider.userId,
      targetUserId: client.userId,
      targetRole: 'client',
      bookingId: booking._id.toString(),
      requestId: booking.requestId,
      rating: 5,
      text: 'Nice',
    });

    const res = await request(app.getHttpServer())
      .get('/reviews')
      .query({ targetUserId: client.userId, targetRole: 'client', limit: 10, offset: 0 })
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0]).toMatchObject({
      targetUserId: client.userId,
      targetRole: 'client',
      rating: 5,
    });
  });
});
