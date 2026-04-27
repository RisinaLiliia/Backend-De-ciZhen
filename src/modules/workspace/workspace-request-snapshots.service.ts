import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { Booking, type BookingDocument } from '../bookings/schemas/booking.schema';
import { Review, type ReviewDocument } from '../reviews/schemas/review.schema';
import {
  WorkspaceBookingSnapshot,
  WorkspaceContractReviewSnapshot,
  WorkspaceContractSnapshot,
  WorkspaceOfferSnapshot,
  WorkspaceRequestSnapshot,
  WorkspaceRequestsSupport,
} from './workspace-requests.support';

export type WorkspaceRequestOverviewSnapshots = {
  requests: WorkspaceRequestSnapshot[];
  customerOffersByRequest: Map<string, WorkspaceOfferSnapshot[]>;
  providerOfferByRequest: Map<string, WorkspaceOfferSnapshot>;
  providerContractByRequest: Map<string, WorkspaceContractSnapshot>;
  clientContractByRequest: Map<string, WorkspaceContractSnapshot>;
  clientBookingByContractId: Map<string, WorkspaceBookingSnapshot>;
  clientReviewByBookingId: Map<string, WorkspaceContractReviewSnapshot>;
};

@Injectable()
export class WorkspaceRequestSnapshotsService {
  private readonly support = new WorkspaceRequestsSupport();

  constructor(
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
  ) {}

  async loadWorkspaceRequestSnapshots(userId: string): Promise<WorkspaceRequestOverviewSnapshots> {
    const uid = String(userId ?? '').trim();

    const [myRequests, myClientOffers, myProviderOffers, myProviderContracts, myClientContracts] = await Promise.all([
      this.requestModel.find({ clientId: uid, archivedAt: null }).sort({ createdAt: -1 }).lean().exec(),
      this.offerModel.find({ clientUserId: uid }).sort({ createdAt: -1 }).lean().exec(),
      this.offerModel
        .aggregate<WorkspaceOfferSnapshot>([
          { $match: { providerUserId: uid } },
          { $sort: { createdAt: -1 } },
          {
            $addFields: {
              requestObjId: {
                $cond: [
                  { $and: [{ $ne: ['$requestId', null] }, { $ne: ['$requestId', ''] }] },
                  { $toObjectId: '$requestId' },
                  null,
                ],
              },
            },
          },
          {
            $lookup: {
              from: 'requests',
              localField: 'requestObjId',
              foreignField: '_id',
              as: 'req',
            },
          },
          { $unwind: { path: '$req', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              id: { $toString: '$_id' },
              requestId: 1,
              providerUserId: 1,
              clientUserId: 1,
              status: 1,
              message: 1,
              amount: '$pricing.amount',
              priceType: '$pricing.type',
              availableAt: '$availability.date',
              availabilityNote: '$availability.note',
              createdAt: 1,
              updatedAt: 1,
              requestTitle: '$req.title',
              requestDescription: '$req.description',
              requestServiceKey: '$req.serviceKey',
              requestCityId: '$req.cityId',
              requestCityName: '$req.cityName',
              requestCategoryKey: '$req.categoryKey',
              requestCategoryName: '$req.categoryName',
              requestSubcategoryName: '$req.subcategoryName',
              requestPreferredDate: '$req.preferredDate',
              requestStatus: '$req.status',
              requestPrice: '$req.price',
              requestPreviousPrice: '$req.previousPrice',
              requestPriceTrend: '$req.priceTrend',
              requestCreatedAt: '$req.createdAt',
              requestIsRecurring: '$req.isRecurring',
              requestImageUrl: '$req.imageUrl',
              requestTags: '$req.tags',
            },
          },
        ])
        .exec(),
      this.contractModel.find({ providerUserId: uid }).sort({ createdAt: -1 }).lean().exec(),
      this.contractModel.find({ clientId: uid }).sort({ createdAt: -1 }).lean().exec(),
    ]);

    const requests = (myRequests as Array<any>).map((request) => ({
      id: String(request._id),
      title: request.title ?? null,
      description: request.description ?? null,
      serviceKey: request.serviceKey ?? null,
      cityId: request.cityId ?? null,
      cityName: request.cityName ?? null,
      categoryKey: request.categoryKey ?? null,
      categoryName: request.categoryName ?? null,
      subcategoryName: request.subcategoryName ?? null,
      price: request.price ?? null,
      previousPrice: request.previousPrice ?? null,
      priceTrend: request.priceTrend ?? null,
      preferredDate: request.preferredDate ?? null,
      status: request.status ?? null,
      createdAt: request.createdAt ?? null,
      isRecurring: request.isRecurring ?? false,
      imageUrl: request.imageUrl ?? null,
      tags: request.tags ?? [],
      inactiveReason: request.inactiveReason ?? null,
      inactiveMessage: request.inactiveMessage ?? null,
      purgeAt: request.purgeAt ?? null,
    } satisfies WorkspaceRequestSnapshot));

    const customerOffersByRequest = (myClientOffers as Array<any>).reduce((map, offer) => {
      const requestId = String(offer.requestId ?? '').trim();
      if (!requestId) return map;
      const current = map.get(requestId) ?? [];
      current.push({
        id: String(offer._id),
        requestId,
        providerUserId: this.support.normalizeId(offer.providerUserId),
        clientUserId: this.support.normalizeId(offer.clientUserId),
        status: offer.status,
        message: offer.message ?? null,
        amount: typeof offer.pricing?.amount === 'number' ? offer.pricing.amount : null,
        priceType: offer.pricing?.type ?? null,
        availableAt: offer.availability?.date ?? null,
        availabilityNote: offer.availability?.note ?? null,
        createdAt: offer.createdAt ?? null,
        updatedAt: offer.updatedAt ?? null,
      } satisfies WorkspaceOfferSnapshot);
      map.set(requestId, current);
      return map;
    }, new Map<string, WorkspaceOfferSnapshot[]>());

    const providerOfferByRequest = this.support.pickLatestByRequest(
      (myProviderOffers ?? []).map((offer) => ({
        ...offer,
        requestId: String(offer.requestId ?? '').trim(),
      })),
    );
    const providerContractByRequest = this.support.pickLatestByRequest(
      (myProviderContracts as Array<any>).map((contract) => ({
        id: String(contract._id),
        requestId: String(contract.requestId ?? '').trim(),
        offerId: String(contract.offerId ?? ''),
        clientId: String(contract.clientId ?? ''),
        providerUserId: String(contract.providerUserId ?? ''),
        status: contract.status,
        priceAmount: contract.priceAmount ?? null,
        priceType: contract.priceType ?? null,
        priceDetails: contract.priceDetails ?? null,
        confirmedAt: contract.confirmedAt ?? null,
        completedAt: contract.completedAt ?? null,
        cancelledAt: contract.cancelledAt ?? null,
        cancelReason: contract.cancelReason ?? null,
        createdAt: contract.createdAt ?? null,
        updatedAt: contract.updatedAt ?? null,
      } satisfies WorkspaceContractSnapshot)),
    );
    const clientContractByRequest = this.support.pickLatestByRequest(
      (myClientContracts as Array<any>).map((contract) => ({
        id: String(contract._id),
        requestId: String(contract.requestId ?? '').trim(),
        offerId: String(contract.offerId ?? ''),
        clientId: String(contract.clientId ?? ''),
        providerUserId: String(contract.providerUserId ?? ''),
        status: contract.status,
        priceAmount: contract.priceAmount ?? null,
        priceType: contract.priceType ?? null,
        priceDetails: contract.priceDetails ?? null,
        confirmedAt: contract.confirmedAt ?? null,
        completedAt: contract.completedAt ?? null,
        cancelledAt: contract.cancelledAt ?? null,
        cancelReason: contract.cancelReason ?? null,
        createdAt: contract.createdAt ?? null,
        updatedAt: contract.updatedAt ?? null,
      } satisfies WorkspaceContractSnapshot)),
    );
    const clientContractIds = Array.from(clientContractByRequest.values()).map((contract) => contract.id);
    const clientBookings = clientContractIds.length > 0
      ? await this.bookingModel
        .find({ contractId: { $in: clientContractIds } })
        .lean()
        .exec()
      : [];
    const clientBookingByContractId = new Map(
      (clientBookings as Array<any>).map((booking) => [
        String(booking.contractId ?? '').trim(),
        {
          id: String(booking._id),
          requestId: String(booking.requestId ?? '').trim(),
          offerId: String(booking.offerId ?? '').trim(),
          contractId: String(booking.contractId ?? '').trim() || null,
          providerUserId: String(booking.providerUserId ?? '').trim(),
          clientId: String(booking.clientId ?? '').trim(),
          startAt: booking.startAt ?? null,
          durationMin: booking.durationMin ?? null,
          endAt: booking.endAt ?? null,
          status: booking.status,
        } satisfies WorkspaceBookingSnapshot,
      ]),
    );
    const completedBookingIds = Array.from(clientBookingByContractId.values())
      .filter((booking) => booking.status === 'completed')
      .map((booking) => booking.id);
    const clientProviderReviews = completedBookingIds.length > 0
      ? await this.reviewModel
        .find({ bookingId: { $in: completedBookingIds }, targetRole: 'provider' })
        .sort({ createdAt: -1 })
        .lean()
        .exec()
      : [];
    const clientReviewByBookingId = new Map<string, WorkspaceContractReviewSnapshot>();
    for (const review of clientProviderReviews as Array<any>) {
      const bookingId = String(review.bookingId ?? '').trim();
      if (!bookingId || clientReviewByBookingId.has(bookingId)) continue;
      clientReviewByBookingId.set(bookingId, {
        clientReviewId: String(review._id ?? '').trim() || null,
        clientReviewedProviderAt: this.support.parseActivityAt(review.createdAt),
        clientReviewRating: typeof review.rating === 'number' ? review.rating : null,
        clientReviewText: typeof review.text === 'string' ? review.text : null,
      });
    }

    return {
      requests,
      customerOffersByRequest,
      providerOfferByRequest,
      providerContractByRequest,
      clientContractByRequest,
      clientBookingByContractId,
      clientReviewByBookingId,
    };
  }
}
