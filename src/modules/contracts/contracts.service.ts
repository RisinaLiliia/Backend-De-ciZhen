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

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly bookings: BookingsService,
  ) {}

  private normalizeId(v?: string): string {
    return String(v ?? '').trim();
  }

  private ensureObjectId(id: string, fieldName: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
    }
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
