import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import { Contract, ContractDocument } from './schemas/contract.schema';
import { Request, RequestDocument } from '../requests/schemas/request.schema';
import { OfferDocument } from '../offers/schemas/offer.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { BookingsService } from '../bookings/bookings.service';
import { ReviewsService, type BookingReviewStatusSummary } from '../reviews/reviews.service';
import { ContractDto } from './dto/contract.dto';

export type ContractBookingSummary = {
  bookingId: string;
  startAt: Date;
  durationMin: number;
  endAt: Date;
  status: 'confirmed' | 'cancelled' | 'completed';
};

type ContractRecord = ContractDocument & {
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly bookings: BookingsService,
    private readonly reviews: ReviewsService,
  ) {}

  private normalizeId(v?: string): string {
    return String(v ?? '').trim();
  }

  private ensureObjectId(id: string, fieldName: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
    }
  }

  private toContractDto(args: {
    contract: ContractRecord;
    booking: ContractBookingSummary | null;
    reviewStatus: BookingReviewStatusSummary | null;
  }): ContractDto {
    const { booking, contract, reviewStatus } = args;

    return {
      id: String(contract._id),
      requestId: contract.requestId,
      offerId: contract.offerId,
      clientId: contract.clientId,
      providerUserId: contract.providerUserId,
      status: contract.status,
      priceAmount: contract.priceAmount ?? null,
      priceType: contract.priceType ?? null,
      priceDetails: contract.priceDetails ?? null,
      confirmedAt: contract.confirmedAt ?? null,
      completedAt: contract.completedAt ?? null,
      cancelledAt: contract.cancelledAt ?? null,
      cancelReason: contract.cancelReason ?? null,
      booking: booking
        ? {
            bookingId: booking.bookingId,
            startAt: booking.startAt,
            durationMin: booking.durationMin,
            endAt: booking.endAt,
            status: booking.status,
          }
        : null,
      reviewStatus: reviewStatus
        ? {
            canClientReviewProvider: reviewStatus.canClientReviewProvider,
            clientReviewId: reviewStatus.clientReviewId,
            clientReviewedProviderAt: reviewStatus.clientReviewedProviderAt,
            clientReviewRating: reviewStatus.clientReviewRating,
            clientReviewText: reviewStatus.clientReviewText,
            canProviderReviewClient: reviewStatus.canProviderReviewClient,
            providerReviewId: reviewStatus.providerReviewId,
            providerReviewedClientAt: reviewStatus.providerReviewedClientAt,
            providerReviewRating: reviewStatus.providerReviewRating,
            providerReviewText: reviewStatus.providerReviewText,
          }
        : null,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  async getBookingSummaryMap(contractIds: string[]): Promise<Map<string, ContractBookingSummary>> {
    const normalizedIds = Array.from(
      new Set(
        contractIds
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0),
      ),
    );

    if (normalizedIds.length === 0) return new Map();

    const bookings = await this.bookingModel
      .find({ contractId: { $in: normalizedIds } })
      .select({ _id: 1, contractId: 1, startAt: 1, durationMin: 1, endAt: 1, status: 1 })
      .exec();

    return new Map(
      (bookings as Array<{
        _id: Types.ObjectId | string;
        contractId?: string | null;
        startAt: Date;
        durationMin?: number | null;
        endAt: Date;
        status: 'confirmed' | 'cancelled' | 'completed';
      }>)
        .map((booking) => {
          const contractId = String(booking.contractId ?? '').trim();
          if (!contractId) return null;
          return [contractId, {
            bookingId: typeof booking._id === 'string' ? booking._id : booking._id.toString(),
            startAt: booking.startAt,
            durationMin: Number(booking.durationMin ?? 60),
            endAt: booking.endAt,
            status: booking.status,
          }] as const;
        })
        .filter((item): item is readonly [string, ContractBookingSummary] => Boolean(item)),
    );
  }

  async toContractDtos(contracts: ContractDocument[]): Promise<ContractDto[]> {
    const contractRecords = contracts as ContractRecord[];
    const bookingByContractId = await this.getBookingSummaryMap(
      contractRecords.map((contract) => String(contract._id)),
    );
    const reviewStatusByBookingId = await this.reviews.getBookingReviewStatusMap(
      Array.from(bookingByContractId.values()).map((booking) => ({
        bookingId: booking.bookingId,
        status: booking.status,
      })),
    );

    return contractRecords.map((contract) => {
      const booking = bookingByContractId.get(String(contract._id)) ?? null;
      return this.toContractDto({
        contract,
        booking,
        reviewStatus: booking ? reviewStatusByBookingId.get(booking.bookingId) ?? null : null,
      });
    });
  }

  async toContractDtoSingle(contract: ContractDocument): Promise<ContractDto> {
    const [dto] = await this.toContractDtos([contract]);
    return dto;
  }

  async createPendingFromOffer(offer: OfferDocument, request: RequestDocument): Promise<ContractDocument> {
    const existing = await this.contractModel.findOne({ offerId: String(offer._id) }).exec();
    if (existing) return existing;

    const price = offer.pricing || null;
    try {
      return await this.contractModel.create({
        requestId: String(request._id),
        offerId: String(offer._id),
        clientId: String(request.clientId ?? ''),
        providerUserId: offer.providerUserId,
        status: 'pending',
        priceAmount: typeof price?.amount === 'number' ? price.amount : null,
        priceType: price?.type ?? null,
        priceDetails: price?.details ?? null,
        confirmedAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
      });
    } catch (e: any) {
      if (e?.code === 11000) {
        const dup = await this.contractModel.findOne({ offerId: String(offer._id) }).exec();
        if (dup) return dup;
      }
      throw e;
    }
  }

  async listMy(
    userId: string,
    filters?: { role?: 'client' | 'provider' | 'all'; status?: Contract['status']; limit?: number; offset?: number },
  ): Promise<ContractDocument[]> {
    const role = filters?.role ?? 'all';
    const match: Record<string, any> = {};
    if (role === 'client') match.clientId = userId;
    if (role === 'provider') match.providerUserId = userId;
    if (role === 'all') match.$or = [{ clientId: userId }, { providerUserId: userId }];
    if (filters?.status) match.status = filters.status;

    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);

    return this.contractModel
      .find(match)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async getByIdForUser(id: string, userId: string): Promise<ContractDocument> {
    const cid = this.normalizeId(id);
    if (!cid) throw new BadRequestException('contractId is required');
    this.ensureObjectId(cid, 'contractId');

    const contract = await this.contractModel.findById(cid).exec();
    if (!contract) throw new NotFoundException('Contract not found');

    if (contract.clientId !== userId && contract.providerUserId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return contract;
  }

  async confirmByClient(
    contractId: string,
    clientId: string,
    input: { startAt: string; durationMin?: number; note?: string },
  ): Promise<ContractDocument> {
    const cid = this.normalizeId(contractId);
    if (!cid) throw new BadRequestException('contractId is required');
    this.ensureObjectId(cid, 'contractId');

    const contract = await this.contractModel.findById(cid).exec();
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.clientId !== clientId) throw new ForbiddenException('Access denied');
    if (contract.status !== 'pending') throw new BadRequestException('Contract is not pending');

    const existingBooking = await this.bookingModel.findOne({ contractId: cid }).exec();
    if (existingBooking) throw new ConflictException('Booking already exists for this contract');

    await this.bookings.createByClient(clientId, {
      requestId: contract.requestId,
      offerId: contract.offerId,
      providerUserId: contract.providerUserId,
      startAt: input.startAt,
      durationMin: input.durationMin,
      note: input.note,
      contractId: cid,
    });

    await this.contractModel.updateOne(
      { _id: contract._id, status: 'pending' },
      { $set: { status: 'confirmed', confirmedAt: new Date() } },
    );

    await this.requestModel.updateOne(
      { _id: contract.requestId, assignedContractId: { $in: [null, cid] } },
      { $set: { status: 'matched', assignedContractId: cid } },
    );

    const updated = await this.contractModel.findById(cid).exec();
    if (!updated) throw new NotFoundException('Contract not found');
    return updated;
  }

  async cancel(
    contractId: string,
    userId: string,
    input: { reason?: string },
  ): Promise<ContractDocument> {
    const cid = this.normalizeId(contractId);
    if (!cid) throw new BadRequestException('contractId is required');
    this.ensureObjectId(cid, 'contractId');

    const contract = await this.contractModel.findById(cid).exec();
    if (!contract) throw new NotFoundException('Contract not found');

    if (contract.clientId !== userId && contract.providerUserId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (contract.status === 'completed') throw new BadRequestException('Cannot cancel completed contract');
    if (contract.status === 'cancelled') return contract;

    await this.contractModel.updateOne(
      { _id: contract._id },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: input.reason ?? null } },
    );

    await this.requestModel.updateOne(
      { _id: contract.requestId, assignedContractId: cid },
      { $set: { status: 'published', matchedProviderUserId: null, matchedAt: null, assignedContractId: null } },
    );

    const updated = await this.contractModel.findById(cid).exec();
    if (!updated) throw new NotFoundException('Contract not found');
    return updated;
  }

  async complete(contractId: string, userId: string): Promise<ContractDocument> {
    const cid = this.normalizeId(contractId);
    if (!cid) throw new BadRequestException('contractId is required');
    this.ensureObjectId(cid, 'contractId');

    const contract = await this.contractModel.findById(cid).exec();
    if (!contract) throw new NotFoundException('Contract not found');

    if (contract.clientId !== userId && contract.providerUserId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (contract.status === 'cancelled') throw new BadRequestException('Contract is cancelled');
    if (contract.status === 'completed') return contract;
    if (contract.status === 'pending') throw new BadRequestException('Contract is not confirmed');

    await this.contractModel.updateOne(
      { _id: contract._id },
      { $set: { status: 'completed', completedAt: new Date() } },
    );

    await this.bookingModel.updateOne({ contractId: cid }, { $set: { status: 'completed' } }).exec();

    await this.requestModel.updateOne(
      { _id: contract.requestId, assignedContractId: cid },
      { $set: { status: 'closed' } },
    );

    const updated = await this.contractModel.findById(cid).exec();
    if (!updated) throw new NotFoundException('Contract not found');
    return updated;
  }
}
