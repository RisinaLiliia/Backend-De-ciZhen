// src/modules/requests/requests.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Request, RequestDocument } from './schemas/request.schema';
import type { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name)
    private readonly model: Model<RequestDocument>,
  ) {}

  async createPublic(dto: CreateRequestDto): Promise<RequestDocument> {
    const serviceKey = String(dto.serviceKey).trim().toLowerCase();
    const cityId = String(dto.cityId).trim();

    const doc = await this.model.create({
      clientId: null,
      serviceKey,
      cityId,
      propertyType: dto.propertyType,
      area: dto.area,
      preferredDate: new Date(dto.preferredDate),
      isRecurring: dto.isRecurring,
      comment: dto.comment ? String(dto.comment).trim() : null,
      status: 'published',
    });

    return doc;
  }

  async listPublic(filters: { cityId?: string; serviceKey?: string }): Promise<RequestDocument[]> {
    const q: Record<string, unknown> = { status: 'published' };

    const cityId = (filters.cityId ?? '').trim();
    if (cityId.length > 0) q.cityId = cityId;

    const serviceKey = (filters.serviceKey ?? '').trim().toLowerCase();
    if (serviceKey.length > 0) q.serviceKey = serviceKey;

    return this.model
      .find(q)
      .sort({ preferredDate: 1, createdAt: -1 })
      .exec();
  }
}
