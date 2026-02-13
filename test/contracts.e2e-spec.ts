// test/contracts.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { Offer, OfferDocument } from '../src/modules/offers/schemas/offer.schema';
import { Request as Req, RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { ProviderProfile, ProviderProfileDocument } from '../src/modules/providers/schemas/provider-profile.schema';
import { Contract, ContractDocument } from '../src/modules/contracts/schemas/contract.schema';
import { Booking, BookingDocument } from '../src/modules/bookings/schemas/booking.schema';
import { ProviderAvailability } from '../src/modules/availability/schemas/provider-availability.schema';
import { AvailabilityService } from '../src/modules/availability/availability.service';

jest.setTimeout(30000);

describe('contracts (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let offerModel: Model<OfferDocument>;
  let requestModel: Model<RequestDocument>;
  let providerProfileModel: Model<ProviderProfileDocument>;
  let contractModel: Model<ContractDocument>;
  let bookingModel: Model<BookingDocument>;
  let providerAvailabilityModel: Model<any>;
  let availability: AvailabilityService;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    offerModel = app.get(getModelToken(Offer.name));
    requestModel = app.get(getModelToken(Req.name));
    providerProfileModel = app.get(getModelToken(ProviderProfile.name));
    contractModel = app.get(getModelToken(Contract.name));
    bookingModel = app.get(getModelToken(Booking.name));
    providerAvailabilityModel = app.get(getModelToken(ProviderAvailability.name));
    availability = app.get(AvailabilityService);
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      offerModel.deleteMany({}),
      requestModel.deleteMany({}),
      providerProfileModel.deleteMany({}),
      contractModel.deleteMany({}),
      bookingModel.deleteMany({}),
      providerAvailabilityModel.deleteMany({}),
    ]);
  });

  const setupProvider = async (userId: string) => {
    await providerProfileModel.findOneAndUpdate(
      { userId },
      {
        userId,
        status: 'active',
        isBlocked: false,
        cityId: 'c1',
        serviceKeys: ['home_cleaning'],
        basePrice: 35,
      },
      { upsert: true, new: true },
    );

    await availability.updateMy(userId, {
      timeZone: 'UTC',
      slotDurationMin: 60,
      bufferMin: 0,
      isActive: true,
      weekly: [{ dayOfWeek: 4, ranges: [{ start: '09:00', end: '11:00' }] }],
    } as any);
  };

  const createPublishedRequest = async (clientId: string) => {
    return requestModel.create({
      title: 'Need cleaning',
      clientId,
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date('2026-03-05T09:00:00.000Z'),
      isRecurring: false,
      status: 'published',
    });
  };

  const acceptOfferAndGetContract = async (clientToken: string, offerId: string) => {
    await request(app.getHttpServer())
      .patch(`/offers/actions/${offerId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const contract = await contractModel.findOne({ offerId }).exec();
    expect(contract).toBeTruthy();
    return contract!;
  };

  it('accept offer creates pending contract and pauses request', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-contract1@test.local', 'Client Contract1');
    const provider = await registerAndGetToken(app, 'provider', 'prov-contract1@test.local', 'Provider Contract1');

    await setupProvider(provider.userId);
    const req = await createPublishedRequest(client.userId);

    const createRes = await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString(), amount: 120 })
      .expect(201);

    const offerId = createRes.body.offer.id as string;
    const contract = await acceptOfferAndGetContract(client.accessToken, offerId);

    expect(contract.status).toBe('pending');

    const updatedReq = await requestModel.findById(req._id).exec();
    expect(updatedReq?.status).toBe('paused');
    expect(updatedReq?.assignedContractId).toBe(String(contract._id));
  });

  it('confirm contract creates booking and sets statuses', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-contract2@test.local', 'Client Contract2');
    const provider = await registerAndGetToken(app, 'provider', 'prov-contract2@test.local', 'Provider Contract2');

    await setupProvider(provider.userId);
    const req = await createPublishedRequest(client.userId);

    const createRes = await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString(), amount: 120 })
      .expect(201);

    const offerId = createRes.body.offer.id as string;
    const contract = await acceptOfferAndGetContract(client.accessToken, offerId);

    await request(app.getHttpServer())
      .post(`/contracts/${contract._id.toString()}/confirm`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ startAt: '2026-03-05T09:00:00.000Z', durationMin: 60 })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('confirmed');
      });

    const booking = await bookingModel.findOne({ contractId: contract._id.toString() }).exec();
    expect(booking).toBeTruthy();
    expect(booking?.status).toBe('confirmed');

    const updatedReq = await requestModel.findById(req._id).exec();
    expect(updatedReq?.status).toBe('matched');
  });

  it('cancel pending contract returns request to published', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-contract3@test.local', 'Client Contract3');
    const provider = await registerAndGetToken(app, 'provider', 'prov-contract3@test.local', 'Provider Contract3');

    await setupProvider(provider.userId);
    const req = await createPublishedRequest(client.userId);

    const createRes = await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString(), amount: 120 })
      .expect(201);

    const offerId = createRes.body.offer.id as string;
    const contract = await acceptOfferAndGetContract(client.accessToken, offerId);

    await request(app.getHttpServer())
      .post(`/contracts/${contract._id.toString()}/cancel`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ reason: 'no longer needed' })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('cancelled');
      });

    const updatedReq = await requestModel.findById(req._id).exec();
    expect(updatedReq?.status).toBe('published');
    expect(updatedReq?.assignedContractId).toBeNull();
  });

  it('complete confirmed contract closes request and booking', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-contract4@test.local', 'Client Contract4');
    const provider = await registerAndGetToken(app, 'provider', 'prov-contract4@test.local', 'Provider Contract4');

    await setupProvider(provider.userId);
    const req = await createPublishedRequest(client.userId);

    const createRes = await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString(), amount: 120 })
      .expect(201);

    const offerId = createRes.body.offer.id as string;
    const contract = await acceptOfferAndGetContract(client.accessToken, offerId);

    await request(app.getHttpServer())
      .post(`/contracts/${contract._id.toString()}/confirm`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ startAt: '2026-03-05T10:00:00.000Z', durationMin: 60 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/contracts/${contract._id.toString()}/complete`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('completed');
      });

    const booking = await bookingModel.findOne({ contractId: contract._id.toString() }).exec();
    expect(booking?.status).toBe('completed');

    const updatedReq = await requestModel.findById(req._id).exec();
    expect(updatedReq?.status).toBe('closed');
  });
});
