// test/offers.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { Offer, OfferDocument } from '../src/modules/offers/schemas/offer.schema';
import { Request as Req, RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { ProviderProfile, ProviderProfileDocument } from '../src/modules/providers/schemas/provider-profile.schema';
import { Booking, BookingDocument } from '../src/modules/bookings/schemas/booking.schema';

jest.setTimeout(30000);

describe('offers (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let offerModel: Model<OfferDocument>;
  let requestModel: Model<RequestDocument>;
  let providerProfileModel: Model<ProviderProfileDocument>;
  let bookingModel: Model<BookingDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    offerModel = app.get(getModelToken(Offer.name));
    requestModel = app.get(getModelToken(Req.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
    bookingModel = app.get(getModelToken(Booking.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      offerModel.deleteMany({}),
      requestModel.deleteMany({}),
      providerProfileModel.deleteMany({}),
      bookingModel.deleteMany({}),
    ]);
  });

  it('provider can list own offers and client can list by request', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-offer1@test.local', 'Client Offer1');
    const provider = await registerAndGetToken(app, 'provider', 'prov-offer1@test.local', 'Provider Offer1');

    await providerProfileModel.create({
      userId: provider.userId,
      status: 'active',
      isBlocked: false,
      cityId: 'c1',
      serviceKeys: ['home_cleaning'],
      basePrice: 35,
    });

    const req = await requestModel.create({
      title: 'Need cleaning',
      clientId: client.userId,
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRecurring: false,
      status: 'published',
    });

    const createRes = await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString() })
      .expect(201);

    const offerId = createRes.body.id as string;

    const myRes = await request(app.getHttpServer())
      .get('/offers/my')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .query({ status: 'sent' })
      .expect(200);

    expect(myRes.body.length).toBe(1);
    expect(myRes.body[0]).toMatchObject({ id: offerId, requestId: req._id.toString() });

    const listRes = await request(app.getHttpServer())
      .get(`/offers/by-request/${req._id.toString()}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .query({ status: 'sent' })
      .expect(200);

    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toMatchObject({ id: offerId });

    const myClientRes = await request(app.getHttpServer())
      .get('/offers/my-client')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .query({ status: 'sent' })
      .expect(200);

    expect(myClientRes.body.length).toBe(1);
    expect(myClientRes.body[0]).toMatchObject({ id: offerId, clientUserId: client.userId });
  });

  it('client can accept offer', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-offer2@test.local', 'Client Offer2');
    const provider = await registerAndGetToken(app, 'provider', 'prov-offer2@test.local', 'Provider Offer2');

    await providerProfileModel.create({
      userId: provider.userId,
      status: 'active',
      isBlocked: false,
      cityId: 'c1',
      serviceKeys: ['home_cleaning'],
      basePrice: 35,
    });

    const req = await requestModel.create({
      title: 'Need cleaning',
      clientId: client.userId,
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRecurring: false,
      status: 'published',
    });

    const createRes = await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString() })
      .expect(201);

    const offerId = createRes.body.id as string;

    await request(app.getHttpServer())
      .patch(`/offers/actions/${offerId}/accept`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200)
      .expect({ ok: true, acceptedOfferId: offerId });

    const updatedReq = await requestModel.findById(req._id).exec();
    expect(updatedReq?.status).toBe('matched');
    expect(updatedReq?.matchedProviderUserId).toBe(provider.userId);

    const updatedOffer = await offerModel.findById(offerId).exec();
    expect(updatedOffer?.status).toBe('accepted');

    const booking = await bookingModel.findOne({ offerId, requestId: String(req._id) }).exec();
    expect(booking).toBeTruthy();
  });

  it('client can decline offer', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-offer3@test.local', 'Client Offer3');
    const provider = await registerAndGetToken(app, 'provider', 'prov-offer3@test.local', 'Provider Offer3');

    await providerProfileModel.create({
      userId: provider.userId,
      status: 'active',
      isBlocked: false,
      cityId: 'c1',
      serviceKeys: ['home_cleaning'],
      basePrice: 35,
    });

    const req = await requestModel.create({
      title: 'Need cleaning',
      clientId: client.userId,
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRecurring: false,
      status: 'published',
    });

    const createRes = await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString() })
      .expect(201);

    const offerId = createRes.body.id as string;

    await request(app.getHttpServer())
      .patch(`/offers/actions/${offerId}/decline`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200)
      .expect({ ok: true, rejectedOfferId: offerId });

    const updatedOffer = await offerModel.findById(offerId).exec();
    expect(updatedOffer?.status).toBe('declined');
  });
});
