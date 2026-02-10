// test/responses.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { Response as Resp, ResponseDocument } from '../src/modules/responses/schemas/response.schema';
import { Request as Req, RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { ProviderProfile, ProviderProfileDocument } from '../src/modules/providers/schemas/provider-profile.schema';
import { Booking, BookingDocument } from '../src/modules/bookings/schemas/booking.schema';

jest.setTimeout(30000);

describe('responses (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let responseModel: Model<ResponseDocument>;
  let requestModel: Model<RequestDocument>;
  let providerProfileModel: Model<ProviderProfileDocument>;
  let bookingModel: Model<BookingDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    responseModel = app.get(getModelToken(Resp.name));
    requestModel = app.get(getModelToken(Req.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
    bookingModel = app.get(getModelToken(Booking.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      responseModel.deleteMany({}),
      requestModel.deleteMany({}),
      providerProfileModel.deleteMany({}),
      bookingModel.deleteMany({}),
    ]);
  });

  it('provider can list own responses and client can list by request', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-resp1@test.local', 'Client Resp1');
    const provider = await registerAndGetToken(app, 'provider', 'prov-resp1@test.local', 'Provider Resp1');

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
      .post('/responses')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString() })
      .expect(201);

    const responseId = createRes.body.id as string;

    const myRes = await request(app.getHttpServer())
      .get('/responses/my')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .query({ status: 'pending' })
      .expect(200);

    expect(myRes.body.length).toBe(1);
    expect(myRes.body[0]).toMatchObject({ id: responseId, requestId: req._id.toString() });

    const listRes = await request(app.getHttpServer())
      .get(`/responses/request/${req._id.toString()}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .query({ status: 'pending' })
      .expect(200);

    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toMatchObject({ id: responseId });

    const myClientRes = await request(app.getHttpServer())
      .get('/responses/my-client')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .query({ status: 'pending' })
      .expect(200);

    expect(myClientRes.body.length).toBe(1);
    expect(myClientRes.body[0]).toMatchObject({ id: responseId, clientUserId: client.userId });
  });

  it('client can accept response', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-resp2@test.local', 'Client Resp2');
    const provider = await registerAndGetToken(app, 'provider', 'prov-resp2@test.local', 'Provider Resp2');

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
      .post('/responses')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString() })
      .expect(201);

    const responseId = createRes.body.id as string;

    await request(app.getHttpServer())
      .patch(`/responses/${responseId}/accept`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200)
      .expect({ ok: true, acceptedResponseId: responseId });

    const updatedReq = await requestModel.findById(req._id).exec();
    expect(updatedReq?.status).toBe('matched');
    expect(updatedReq?.matchedProviderUserId).toBe(provider.userId);

    const updatedResp = await responseModel.findById(responseId).exec();
    expect(updatedResp?.status).toBe('accepted');

    const booking = await bookingModel.findOne({ responseId, requestId: String(req._id) }).exec();
    expect(booking).toBeTruthy();
  });

  it('client can reject response', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-resp3@test.local', 'Client Resp3');
    const provider = await registerAndGetToken(app, 'provider', 'prov-resp3@test.local', 'Provider Resp3');

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
      .post('/responses')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString() })
      .expect(201);

    const responseId = createRes.body.id as string;

    await request(app.getHttpServer())
      .patch(`/responses/${responseId}/reject`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200)
      .expect({ ok: true, rejectedResponseId: responseId });

    const updatedResp = await responseModel.findById(responseId).exec();
    expect(updatedResp?.status).toBe('rejected');
  });
});
