// src/modules/offers/offers.service.ts
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

import { Offer, OfferDocument } from './schemas/offer.schema';
import { ProviderProfile, ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import { Request, RequestDocument } from '../requests/schemas/request.schema';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

const PROVIDER_DAILY_OFFER_LIMIT = 30;
@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(ProviderProfile.name)
    private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private normalizeId(v?: string): string {
    return String(v ?? '').trim();
  }

  private ensureObjectId(id: string, fieldName: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
    }
  }

  private startOfTodayUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }

  private startOfTomorrowUtc(): Date {
    const s = this.startOfTodayUtc();
    return new Date(s.getTime() + 24 * 60 * 60 * 1000);
  }

  private async enforceProviderDailyLimit(providerUserId: string) {
    const from = this.startOfTodayUtc();
    const to = this.startOfTomorrowUtc();

    const cnt = await this.offerModel
      .countDocuments({
        providerUserId,
        createdAt: { $gte: from, $lt: to },
      })
      .exec();

    if (cnt >= PROVIDER_DAILY_OFFER_LIMIT) {
      throw new ForbiddenException(
        `Daily offer limit reached (${PROVIDER_DAILY_OFFER_LIMIT}). Try again tomorrow.`,
      );
    }
  }

  async createForProvider(
    providerUserId: string,
    input: {
      requestId: string;
      message?: string;
      amount?: number;
      priceType?: 'fixed' | 'estimate' | 'hourly';
      availableAt?: string;
      availabilityNote?: string;
    },
  ): Promise<{ offer: OfferDocument; providerProfile: ProviderProfileDocument }> {
    const rid = this.normalizeId(input.requestId);
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    await this.enforceProviderDailyLimit(providerUserId);

    if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }

    const req = await this.requestModel.findById(rid).exec();
    if (!req) throw new NotFoundException('Request not found');

    if (req.status !== 'published') {
      throw new BadRequestException('Request is not available for offers');
    }

    const owner = String(req.clientId ?? '');
    if (!owner) throw new BadRequestException('Request has no clientId');
    if (owner === providerUserId) throw new ForbiddenException('Cannot offer on own request');

    const provider = await this.providerModel.findOne({ userId: providerUserId }).exec();
    if (provider?.isBlocked) throw new ForbiddenException('Provider profile is blocked');

    const serviceKey = req.serviceKey ?? null;
    let providerDoc = provider;

    if (!providerDoc) {
      providerDoc = await this.providerModel.create({
        userId: providerUserId,
        serviceKeys: serviceKey ? [serviceKey] : [],
        status: 'draft',
      });
    } else if (serviceKey && !providerDoc.serviceKeys?.includes(serviceKey)) {
      await this.providerModel.updateOne(
        { _id: providerDoc._id },
        { $addToSet: { serviceKeys: serviceKey } },
      );
      providerDoc = {
        ...(providerDoc as any),
        serviceKeys: [...(providerDoc.serviceKeys ?? []), serviceKey],
      } as any;
    }

    await this.userModel
      .updateOne({ _id: providerUserId, role: { $ne: 'admin' } }, { $set: { role: 'provider' } })
      .exec();

    if (providerDoc?.cityId && req.cityId && providerDoc.cityId !== req.cityId) {
      throw new ForbiddenException('Provider city does not match request city');
    }

    try {
      const offer = await this.offerModel.create({
        requestId: rid,
        providerUserId,
        clientUserId: owner,
        status: 'sent',
        message: input.message ? String(input.message).trim() : null,
        pricing: {
          amount: input.amount,
          type: input.priceType,
        },
        availability: input.availableAt || input.availabilityNote
          ? {
              date: input.availableAt,
              note: input.availabilityNote ? String(input.availabilityNote).trim() : undefined,
            }
          : null,
        metadata: {},
      });

      const providerProfile = await this.providerModel.findOne({ userId: providerUserId }).exec();
      if (!providerProfile) {
        throw new NotFoundException('Provider profile not found');
      }
      return { offer, providerProfile };
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Already offered on this request');
      throw e;
    }
  }

  async updateForProvider(
    providerUserId: string,
    offerId: string,
    input: {
      message?: string;
      amount?: number;
      priceType?: 'fixed' | 'estimate' | 'hourly';
      availableAt?: string;
      availabilityNote?: string;
    },
  ): Promise<{ offer: OfferDocument; providerProfile: ProviderProfileDocument }> {
    const id = this.normalizeId(offerId);
    if (!id) throw new BadRequestException('offerId is required');
    this.ensureObjectId(id, 'offerId');

    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.providerUserId !== providerUserId) throw new ForbiddenException('Access denied');
    if (offer.status !== 'sent') throw new BadRequestException('Only sent offers can be edited');

    const hasAnyField =
      typeof input.amount === 'number'
      || typeof input.message === 'string'
      || typeof input.priceType === 'string'
      || typeof input.availableAt === 'string'
      || typeof input.availabilityNote === 'string';

    if (!hasAnyField) {
      throw new BadRequestException('Nothing to update');
    }

    if (typeof input.amount === 'number' && (!Number.isFinite(input.amount) || input.amount <= 0)) {
      throw new BadRequestException('amount must be a positive number');
    }

    const nextMessage = typeof input.message === 'string' ? String(input.message).trim() : offer.message;
    const nextAmount = typeof input.amount === 'number' ? input.amount : offer.pricing?.amount;
    const nextType = input.priceType ?? offer.pricing?.type;
    const nextAvailableAt = typeof input.availableAt === 'string' ? input.availableAt : offer.availability?.date;
    const nextAvailabilityNote =
      typeof input.availabilityNote === 'string'
        ? String(input.availabilityNote).trim()
        : (offer.availability?.note ?? undefined);

    await this.offerModel
      .updateOne(
        { _id: offer._id, providerUserId, status: 'sent' },
        {
          $set: {
            message: nextMessage || null,
            pricing: {
              amount: nextAmount,
              type: nextType,
            },
            availability: nextAvailableAt || nextAvailabilityNote
              ? {
                  date: nextAvailableAt,
                  note: nextAvailabilityNote || undefined,
                }
              : null,
          },
        },
      )
      .exec();

    const updatedOffer = await this.offerModel.findById(id).exec();
    if (!updatedOffer) throw new NotFoundException('Offer not found');

    const providerProfile = await this.providerModel.findOne({ userId: providerUserId }).exec();
    if (!providerProfile) throw new NotFoundException('Provider profile not found');

    return { offer: updatedOffer, providerProfile };
  }

  async deleteForProvider(providerUserId: string, offerId: string): Promise<void> {
    const id = this.normalizeId(offerId);
    if (!id) throw new BadRequestException('offerId is required');
    this.ensureObjectId(id, 'offerId');

    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.providerUserId !== providerUserId) throw new ForbiddenException('Access denied');
    if (offer.status !== 'sent') throw new BadRequestException('Only sent offers can be deleted');

    await this.offerModel.deleteOne({ _id: offer._id, providerUserId, status: 'sent' }).exec();
  }

  async listMy(
    providerUserId: string,
    filters?: { status?: 'sent' | 'accepted' | 'declined' | 'withdrawn' },
  ): Promise<any[]> {
    const match: Record<string, any> = { providerUserId };
    if (filters?.status) match.status = filters.status;

    return this.offerModel
      .aggregate([
        { $match: match },
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
          $addFields: {
            requestServiceKey: '$req.serviceKey',
            requestCityId: '$req.cityId',
            requestPreferredDate: '$req.preferredDate',
            requestStatus: '$req.status',
          },
        },
        { $project: { req: 0, requestObjId: 0 } },
      ])
      .exec();
  }

  async listByRequestForClient(
    clientUserId: string,
    requestId: string,
    filters?: { status?: 'sent' | 'accepted' | 'declined' | 'withdrawn' },
  ): Promise<any[]> {
    const rid = this.normalizeId(requestId);
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const req = await this.requestModel.findById(rid).exec();
    if (!req) throw new NotFoundException('Request not found');

    const owner = String(req.clientId ?? '');
    if (owner !== clientUserId) throw new ForbiddenException('Access denied');

    const match: Record<string, any> = { requestId: rid };
    if (filters?.status) match.status = filters.status;

    return this.offerModel
      .aggregate([
        { $match: match },
        { $sort: { status: 1, createdAt: -1 } },
        {
          $lookup: {
            from: 'provider_profiles',
            localField: 'providerUserId',
            foreignField: 'userId',
            as: 'prov',
          },
        },
        { $unwind: { path: '$prov', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            providerDisplayName: '$prov.displayName',
            providerAvatarUrl: '$prov.avatarUrl',
            providerRatingAvg: { $ifNull: ['$prov.ratingAvg', 0] },
            providerRatingCount: { $ifNull: ['$prov.ratingCount', 0] },
            providerCompletedJobs: { $ifNull: ['$prov.completedJobs', 0] },
            providerBasePrice: '$prov.basePrice',
          },
        },
        { $project: { prov: 0 } },
      ])
      .exec();
  }

  async listMyClient(
    clientUserId: string,
    filters?: { status?: 'sent' | 'accepted' | 'declined' | 'withdrawn' },
  ): Promise<any[]> {
    const match: Record<string, any> = { clientUserId };
    if (filters?.status) match.status = filters.status;

    return this.offerModel
      .aggregate([
        { $match: match },
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
          $addFields: {
            requestServiceKey: '$req.serviceKey',
            requestCityId: '$req.cityId',
            requestPreferredDate: '$req.preferredDate',
            requestStatus: '$req.status',
          },
        },
        {
          $lookup: {
            from: 'provider_profiles',
            localField: 'providerUserId',
            foreignField: 'userId',
            as: 'prov',
          },
        },
        { $unwind: { path: '$prov', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            providerDisplayName: '$prov.displayName',
            providerAvatarUrl: '$prov.avatarUrl',
            providerRatingAvg: { $ifNull: ['$prov.ratingAvg', 0] },
            providerRatingCount: { $ifNull: ['$prov.ratingCount', 0] },
            providerCompletedJobs: { $ifNull: ['$prov.completedJobs', 0] },
            providerBasePrice: '$prov.basePrice',
          },
        },
        { $project: { req: 0, prov: 0, requestObjId: 0 } },
      ])
      .exec();
  }

  async acceptForClient(clientUserId: string, offerId: string): Promise<void> {
    const id = this.normalizeId(offerId);
    if (!id) throw new BadRequestException('offerId is required');
    this.ensureObjectId(id, 'offerId');

    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException('Offer not found');

    const req = await this.requestModel.findById(offer.requestId).exec();
    if (!req) throw new NotFoundException('Request not found');

    const owner = String(req.clientId ?? '');
    if (owner !== clientUserId) throw new ForbiddenException('Access denied');

    if (offer.status === 'accepted') return;
    if (offer.status === 'declined') throw new BadRequestException('Cannot accept declined offer');
    if (offer.status === 'withdrawn') throw new BadRequestException('Cannot accept withdrawn offer');

    const lock = await this.requestModel
      .updateOne(
        {
          _id: req._id,
          clientId: clientUserId,
          status: 'published',
          matchedProviderUserId: null,
        },
        {
          $set: {
            status: 'paused',
            matchedProviderUserId: offer.providerUserId,
            matchedAt: new Date(),
            assignedContractId: null,
          },
        },
      )
      .exec();

    if (lock.modifiedCount === 0) {
      throw new BadRequestException('Request already matched or not available');
    }

    await this.offerModel.updateOne({ _id: offer._id }, { $set: { status: 'accepted' } }).exec();

    let contract = await this.contractModel.findOne({ offerId: String(offer._id) }).exec();
    if (!contract) {
      try {
        contract = await this.contractModel.create({
          requestId: String(req._id),
          offerId: String(offer._id),
          clientId: clientUserId,
          providerUserId: offer.providerUserId,
          status: 'pending',
          priceAmount: typeof offer.pricing?.amount === 'number' ? offer.pricing.amount : null,
          priceType: offer.pricing?.type ?? null,
          priceDetails: offer.pricing?.details ?? null,
          confirmedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelReason: null,
        } as any);
      } catch (e: any) {
        if (e?.code !== 11000) throw e;
        contract = await this.contractModel.findOne({ offerId: String(offer._id) }).exec();
      }
    }

    if (contract) {
      await this.requestModel.updateOne(
        { _id: req._id, assignedContractId: null },
        { $set: { assignedContractId: String(contract._id) } },
      );
    }

    await this.offerModel
      .updateMany(
        { requestId: offer.requestId, _id: { $ne: offer._id }, status: 'sent' },
        { $set: { status: 'declined' } },
      )
      .exec();
  }

  async declineForClient(clientUserId: string, offerId: string): Promise<void> {
    const id = this.normalizeId(offerId);
    if (!id) throw new BadRequestException('offerId is required');
    this.ensureObjectId(id, 'offerId');

    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException('Offer not found');

    const req = await this.requestModel.findById(offer.requestId).exec();
    if (!req) throw new NotFoundException('Request not found');

    const owner = String(req.clientId ?? '');
    if (owner !== clientUserId) throw new ForbiddenException('Access denied');

    if (req.status === 'matched' || req.status === 'paused') {
      throw new BadRequestException('Request already matched; cannot decline offers');
    }

    if (offer.status === 'declined') return;
    if (offer.status === 'accepted') throw new BadRequestException('Cannot decline accepted offer');

    await this.offerModel.updateOne({ _id: offer._id }, { $set: { status: 'declined' } }).exec();
  }
}
