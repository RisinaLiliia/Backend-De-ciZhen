import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Response as Resp, ResponseDocument } from './schemas/response.schema';
import { ProviderProfile, ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import { Request, RequestDocument } from '../requests/schemas/request.schema';

@Injectable()
export class ResponsesService {
  constructor(
    @InjectModel(Resp.name) private readonly responseModel: Model<ResponseDocument>,
    @InjectModel(ProviderProfile.name) private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
  ) {}

  private normalizeId(v?: string): string {
    return String(v ?? '').trim();
  }

  async createForProvider(providerUserId: string, requestId: string): Promise<ResponseDocument> {
    const rid = this.normalizeId(requestId);
    if (!rid) throw new BadRequestException('requestId is required');

    const provider = await this.providerModel.findOne({ userId: providerUserId }).exec();
    if (!provider) throw new NotFoundException('Provider profile not found');
    if (provider.isBlocked) throw new ForbiddenException('Provider profile is blocked');
    if (provider.status !== 'active') throw new ForbiddenException('Provider profile is not active');

    const req = await this.requestModel.findById(rid).exec();
    if (!req) throw new NotFoundException('Request not found');

    const status = (req as any).status as string | undefined;
    if (status && !['open', 'published', 'active'].includes(status)) {
      throw new BadRequestException('Request is not available for responses');
    }

    try {
      return await this.responseModel.create({
        requestId: rid,
        providerUserId,
        clientUserId: String((req as any).clientUserId ?? (req as any).clientId ?? ''),
        status: 'pending',
        metadata: {},
      });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Already responded to this request');
      throw e;
    }
  }

  async listMy(providerUserId: string): Promise<ResponseDocument[]> {
    return this.responseModel
      .find({ providerUserId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async listByRequestForClient(clientUserId: string, requestId: string): Promise<ResponseDocument[]> {
    const rid = this.normalizeId(requestId);
    if (!rid) throw new BadRequestException('requestId is required');

    const req = await this.requestModel.findById(rid).exec();
    if (!req) throw new NotFoundException('Request not found');

    const owner = String((req as any).clientUserId ?? (req as any).clientId ?? '');
    if (owner !== clientUserId) throw new ForbiddenException('Access denied');

    return this.responseModel
      .find({ requestId: rid })
      .sort({ status: 1, createdAt: -1 })
      .exec();
  }

  async acceptForClient(clientUserId: string, responseId: string): Promise<void> {
    const id = this.normalizeId(responseId);
    if (!id) throw new BadRequestException('responseId is required');

    const resp = await this.responseModel.findById(id).exec();
    if (!resp) throw new NotFoundException('Response not found');

    const req = await this.requestModel.findById(resp.requestId).exec();
    if (!req) throw new NotFoundException('Request not found');

    const owner = String((req as any).clientUserId ?? (req as any).clientId ?? '');
    if (owner !== clientUserId) throw new ForbiddenException('Access denied');

    if (resp.status === 'accepted') return;

    const alreadyAccepted = await this.responseModel
      .findOne({ requestId: resp.requestId, status: 'accepted' })
      .exec();

    if (alreadyAccepted && alreadyAccepted._id.toString() !== resp._id.toString()) {
      throw new BadRequestException('Request already has an accepted provider');
    }

    resp.status = 'accepted';
    await resp.save();

    await this.responseModel.updateMany(
      { requestId: resp.requestId, _id: { $ne: resp._id }, status: 'pending' },
      { $set: { status: 'rejected' } },
    ).exec();

    if (typeof (req as any).status === 'string') {
      (req as any).status = 'matched';
      await (req as any).save?.();
    }
  }
}
