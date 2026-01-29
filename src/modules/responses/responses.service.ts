// src/modules/responses/responses.service.ts
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

import { Response as Resp, ResponseDocument } from './schemas/response.schema';
import { ProviderProfile, ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import { Request, RequestDocument } from '../requests/schemas/request.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';

const PROVIDER_DAILY_RESPONSE_LIMIT = 30;
const DEFAULT_BOOKING_DURATION_MIN = 60; 

@Injectable()
export class ResponsesService {
  constructor(
    @InjectModel(Resp.name) private readonly responseModel: Model<ResponseDocument>,
    @InjectModel(ProviderProfile.name)
    private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
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

    const cnt = await this.responseModel
      .countDocuments({
        providerUserId,
        createdAt: { $gte: from, $lt: to },
      })
      .exec();

    if (cnt >= PROVIDER_DAILY_RESPONSE_LIMIT) {
      throw new ForbiddenException(
        `Daily response limit reached (${PROVIDER_DAILY_RESPONSE_LIMIT}). Try again tomorrow.`,
      );
    }
  }

  async createForProvider(providerUserId: string, requestId: string): Promise<ResponseDocument> {
    const rid = this.normalizeId(requestId);
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    await this.enforceProviderDailyLimit(providerUserId);

    const provider = await this.providerModel.findOne({ userId: providerUserId }).exec();
    if (!provider) throw new NotFoundException('Provider profile not found');
    if (provider.isBlocked) throw new ForbiddenException('Provider profile is blocked');
    if (provider.status !== 'active') throw new ForbiddenException('Provider profile is not active');

    const req = await this.requestModel.findById(rid).exec();
    if (!req) throw new NotFoundException('Request not found');

    if (req.status !== 'published') {
      throw new BadRequestException('Request is not available for responses');
    }

    const owner = String(req.clientId ?? '');
    if (!owner) throw new BadRequestException('Request has no clientId');
    if (owner === providerUserId) throw new ForbiddenException('Cannot respond to own request');

    if (provider.cityId && req.cityId && provider.cityId !== req.cityId) {
      throw new ForbiddenException('Provider city does not match request city');
    }
    if (!provider.serviceKeys?.includes(req.serviceKey)) {
      throw new ForbiddenException('Provider does not offer requested service');
    }

    try {
      return await this.responseModel.create({
        requestId: rid,
        providerUserId,
        clientUserId: owner,
        status: 'pending',
        metadata: {},
      });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Already responded to this request');
      throw e;
    }
  }

  async listMy(
    providerUserId: string,
    filters?: { status?: 'pending' | 'accepted' | 'rejected' },
  ): Promise<any[]> {
    const match: Record<string, any> = { providerUserId };
    if (filters?.status) match.status = filters.status;

    return this.responseModel
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
    filters?: { status?: 'pending' | 'accepted' | 'rejected' },
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

    return this.responseModel
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

  async acceptForClient(clientUserId: string, responseId: string): Promise<void> {
    const id = this.normalizeId(responseId);
    if (!id) throw new BadRequestException('responseId is required');
    this.ensureObjectId(id, 'responseId');

    const resp = await this.responseModel.findById(id).exec();
    if (!resp) throw new NotFoundException('Response not found');

    const req = await this.requestModel.findById(resp.requestId).exec();
    if (!req) throw new NotFoundException('Request not found');

    const owner = String(req.clientId ?? '');
    if (owner !== clientUserId) throw new ForbiddenException('Access denied');

    if (resp.status === 'accepted') return;
    if (resp.status === 'rejected') throw new BadRequestException('Cannot accept rejected response');

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
            status: 'matched',
            matchedProviderUserId: resp.providerUserId,
            matchedAt: new Date(),
          },
        },
      )
      .exec();

    if (lock.modifiedCount === 0) {
      throw new BadRequestException('Request already matched or not available');
    }

    await this.responseModel.updateOne({ _id: resp._id }, { $set: { status: 'accepted' } }).exec();
    
    const durationMin = DEFAULT_BOOKING_DURATION_MIN;
const startAt = new Date(req.preferredDate);
const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);

try {
  await this.bookingModel.create({
    requestId: String(req._id),
    responseId: String(resp._id),
    providerUserId: resp.providerUserId,
    clientId: clientUserId,
    startAt,
    durationMin,
    endAt,
    status: 'confirmed',
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    metadata: {},
  } as any);
} catch (e: any) {
  if (e?.code !== 11000) throw e;
}

    await this.responseModel
      .updateMany(
        { requestId: resp.requestId, _id: { $ne: resp._id }, status: 'pending' },
        { $set: { status: 'rejected' } },
      )
      .exec();
  }

  async rejectForClient(clientUserId: string, responseId: string): Promise<void> {
    const id = this.normalizeId(responseId);
    if (!id) throw new BadRequestException('responseId is required');
    this.ensureObjectId(id, 'responseId');

    const resp = await this.responseModel.findById(id).exec();
    if (!resp) throw new NotFoundException('Response not found');

    const req = await this.requestModel.findById(resp.requestId).exec();
    if (!req) throw new NotFoundException('Request not found');

    const owner = String(req.clientId ?? '');
    if (owner !== clientUserId) throw new ForbiddenException('Access denied');

    if (req.status === 'matched') {
      throw new BadRequestException('Request already matched; cannot reject responses');
    }

    if (resp.status === 'rejected') return;
    if (resp.status === 'accepted') throw new BadRequestException('Cannot reject accepted response');

    await this.responseModel.updateOne({ _id: resp._id }, { $set: { status: 'rejected' } }).exec();
  }
}
