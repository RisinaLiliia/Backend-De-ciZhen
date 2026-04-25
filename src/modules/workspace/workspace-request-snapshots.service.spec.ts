import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspaceRequestSnapshotsService } from './workspace-request-snapshots.service';
import { Request } from '../requests/schemas/request.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import { Booking } from '../bookings/schemas/booking.schema';
import { Review } from '../reviews/schemas/review.schema';

describe('WorkspaceRequestSnapshotsService (unit)', () => {
  let service: WorkspaceRequestSnapshotsService;

  const requestModelMock = { find: jest.fn() };
  const offerModelMock = { find: jest.fn(), aggregate: jest.fn() };
  const contractModelMock = { find: jest.fn() };
  const bookingModelMock = { find: jest.fn() };
  const reviewModelMock = { find: jest.fn() };

  function execResult<T>(value: T) {
    return { exec: jest.fn().mockResolvedValue(value) };
  }

  function leanResult<T>(value: T) {
    return {
      lean: jest.fn().mockReturnValue(execResult(value)),
    };
  }

  function sortLeanResult<T>(value: T) {
    return {
      sort: jest.fn().mockReturnValue(leanResult(value)),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceRequestSnapshotsService,
        { provide: getModelToken(Request.name), useValue: requestModelMock },
        { provide: getModelToken(Offer.name), useValue: offerModelMock },
        { provide: getModelToken(Contract.name), useValue: contractModelMock },
        { provide: getModelToken(Booking.name), useValue: bookingModelMock },
        { provide: getModelToken(Review.name), useValue: reviewModelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceRequestSnapshotsService);
  });

  it('loads and normalizes customer/provider workspace request snapshots', async () => {
    requestModelMock.find.mockReturnValueOnce(
      sortLeanResult([
        {
          _id: 'request-customer-1',
          title: 'Logo design for boutique',
          description: 'Need a new logo package',
          serviceKey: 'logo_design',
          cityId: 'berlin',
          cityName: 'Berlin',
          categoryKey: 'design',
          categoryName: 'Design',
          subcategoryName: 'Logo',
          price: 400,
          preferredDate: new Date('2026-04-12T09:00:00.000Z'),
          status: 'published',
          createdAt: new Date('2026-04-05T08:00:00.000Z'),
          isRecurring: false,
          imageUrl: null,
          tags: ['Design'],
        },
      ]),
    );
    offerModelMock.find.mockReturnValueOnce(
      sortLeanResult([
        {
          _id: 'offer-client-1',
          requestId: 'request-customer-1',
          providerUserId: 'provider-2',
          clientUserId: 'user-1',
          status: 'sent',
          message: 'I can help',
          pricing: { amount: 450, type: 'fixed' },
          availability: { date: new Date('2026-04-13T10:00:00.000Z'), note: 'Next week' },
          createdAt: new Date('2026-04-06T08:30:00.000Z'),
          updatedAt: new Date('2026-04-06T09:00:00.000Z'),
        },
      ]),
    );
    offerModelMock.aggregate.mockReturnValueOnce(
      execResult([
        {
          id: 'offer-provider-1',
          requestId: 'request-provider-1',
          providerUserId: 'user-1',
          clientUserId: 'client-9',
          status: 'accepted',
          message: 'Available on Thursday',
          amount: 900,
          priceType: 'fixed',
          availableAt: new Date('2026-04-09T10:00:00.000Z'),
          availabilityNote: 'Can start immediately',
          createdAt: new Date('2026-04-06T11:00:00.000Z'),
          updatedAt: new Date('2026-04-06T11:30:00.000Z'),
          requestTitle: 'Wedding photography',
          requestDescription: 'Looking for a full-day shoot',
          requestServiceKey: 'wedding_photography',
          requestCityId: 'hamburg',
          requestCityName: 'Hamburg',
          requestCategoryKey: 'photo',
          requestCategoryName: 'Photography',
          requestSubcategoryName: 'Wedding',
          requestPreferredDate: new Date('2026-04-20T10:00:00.000Z'),
          requestStatus: 'matched',
          requestPrice: 850,
          requestPreviousPrice: 800,
          requestPriceTrend: 'up',
          requestCreatedAt: new Date('2026-04-04T09:00:00.000Z'),
          requestIsRecurring: false,
          requestImageUrl: null,
          requestTags: ['Wedding'],
        },
      ]),
    );
    contractModelMock.find
      .mockReturnValueOnce(
        sortLeanResult([
          {
            _id: 'contract-provider-1',
            requestId: 'request-provider-1',
            offerId: 'offer-provider-1',
            clientId: 'client-9',
            providerUserId: 'user-1',
            status: 'confirmed',
            priceAmount: 900,
            priceType: 'fixed',
            priceDetails: null,
            confirmedAt: new Date('2026-04-08T09:00:00.000Z'),
            completedAt: null,
            cancelledAt: null,
            cancelReason: null,
            createdAt: new Date('2026-04-06T12:00:00.000Z'),
            updatedAt: new Date('2026-04-06T13:00:00.000Z'),
          },
        ]),
      )
      .mockReturnValueOnce(
        sortLeanResult([
          {
            _id: 'contract-client-1',
            requestId: 'request-customer-1',
            offerId: 'offer-client-accepted-1',
            clientId: 'user-1',
            providerUserId: 'provider-2',
            status: 'completed',
            priceAmount: 450,
            priceType: 'fixed',
            priceDetails: null,
            confirmedAt: new Date('2026-04-12T09:00:00.000Z'),
            completedAt: new Date('2026-04-15T10:00:00.000Z'),
            cancelledAt: null,
            cancelReason: null,
            createdAt: new Date('2026-04-10T08:00:00.000Z'),
            updatedAt: new Date('2026-04-15T10:00:00.000Z'),
          },
        ]),
      );
    bookingModelMock.find.mockReturnValueOnce(
      leanResult([
        {
          _id: 'booking-1',
          requestId: 'request-customer-1',
          offerId: 'offer-client-accepted-1',
          contractId: 'contract-client-1',
          providerUserId: 'provider-2',
          clientId: 'user-1',
          startAt: new Date('2026-04-12T09:00:00.000Z'),
          durationMin: 120,
          endAt: new Date('2026-04-12T11:00:00.000Z'),
          status: 'completed',
        },
      ]),
    );
    reviewModelMock.find.mockReturnValueOnce(
      sortLeanResult([
        {
          _id: 'review-1',
          bookingId: 'booking-1',
          targetRole: 'provider',
          rating: 5,
          text: 'Great work',
          createdAt: new Date('2026-04-16T10:00:00.000Z'),
        },
      ]),
    );

    const result = await service.loadWorkspaceRequestSnapshots('user-1');

    expect(requestModelMock.find).toHaveBeenCalledWith({ clientId: 'user-1', archivedAt: null });
    expect(offerModelMock.find).toHaveBeenCalledWith({ clientUserId: 'user-1' });
    expect(contractModelMock.find).toHaveBeenNthCalledWith(1, { providerUserId: 'user-1' });
    expect(contractModelMock.find).toHaveBeenNthCalledWith(2, { clientId: 'user-1' });
    expect(bookingModelMock.find).toHaveBeenCalledWith({ contractId: { $in: ['contract-client-1'] } });
    expect(reviewModelMock.find).toHaveBeenCalledWith({ bookingId: { $in: ['booking-1'] }, targetRole: 'provider' });

    expect(result.requests).toEqual([
      expect.objectContaining({
        id: 'request-customer-1',
        title: 'Logo design for boutique',
        categoryName: 'Design',
      }),
    ]);
    expect(result.customerOffersByRequest.get('request-customer-1')).toEqual([
      expect.objectContaining({
        id: 'offer-client-1',
        amount: 450,
        availabilityNote: 'Next week',
      }),
    ]);
    expect(result.providerOfferByRequest.get('request-provider-1')).toEqual(
      expect.objectContaining({
        id: 'offer-provider-1',
        requestTitle: 'Wedding photography',
        requestPriceTrend: 'up',
      }),
    );
    expect(result.providerContractByRequest.get('request-provider-1')).toEqual(
      expect.objectContaining({
        id: 'contract-provider-1',
        priceAmount: 900,
      }),
    );
    expect(result.clientContractByRequest.get('request-customer-1')).toEqual(
      expect.objectContaining({
        id: 'contract-client-1',
        status: 'completed',
      }),
    );
    expect(result.clientBookingByContractId.get('contract-client-1')).toEqual(
      expect.objectContaining({
        id: 'booking-1',
        status: 'completed',
      }),
    );
    expect(result.clientReviewByBookingId.get('booking-1')).toEqual(
      expect.objectContaining({
        clientReviewId: 'review-1',
        clientReviewRating: 5,
        clientReviewText: 'Great work',
      }),
    );
  });

  it('skips booking and review lookups when the user has no client contracts', async () => {
    requestModelMock.find.mockReturnValueOnce(sortLeanResult([]));
    offerModelMock.find.mockReturnValueOnce(sortLeanResult([]));
    offerModelMock.aggregate.mockReturnValueOnce(execResult([]));
    contractModelMock.find
      .mockReturnValueOnce(sortLeanResult([]))
      .mockReturnValueOnce(sortLeanResult([]));

    const result = await service.loadWorkspaceRequestSnapshots('user-1');

    expect(bookingModelMock.find).not.toHaveBeenCalled();
    expect(reviewModelMock.find).not.toHaveBeenCalled();
    expect(result.clientContractByRequest.size).toBe(0);
    expect(result.clientBookingByContractId.size).toBe(0);
    expect(result.clientReviewByBookingId.size).toBe(0);
  });
});
