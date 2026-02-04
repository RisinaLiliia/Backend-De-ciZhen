// src/modules/requests/requests.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Request, RequestDocument, RequestStatus } from './schemas/request.schema';
import type { CreateRequestDto } from './dto/create-request.dto';

type ListFilters = { status?: RequestStatus; from?: Date; to?: Date };
type ListPagination = { limit?: number; offset?: number };

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name)
    private readonly model: Model<RequestDocument>,
  ) {}

  private parseDateOrThrow(value: string, field: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} must be a valid ISO date`);
    return d;
  }

  normalizeFilters(input?: {
    status?: RequestStatus;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): (ListFilters & ListPagination) | undefined {
    if (!input) return undefined;

    const filters: ListFilters & ListPagination = {};
    if (input.status) filters.status = input.status;
    if (input.from) filters.from = this.parseDateOrThrow(input.from, 'from');
    if (input.to) filters.to = this.parseDateOrThrow(input.to, 'to');

    if (filters.from && filters.to && filters.to.getTime() < filters.from.getTime()) {
      throw new BadRequestException('to must be >= from');
    }

    if (typeof input.limit === 'number') filters.limit = input.limit;
    if (typeof input.offset === 'number') filters.offset = input.offset;

    return filters;
  }

  async createPublic(dto: CreateRequestDto, clientId?: string | null): Promise<RequestDocument> {
    const serviceKey = String(dto.serviceKey).trim().toLowerCase();
    const cityId = String(dto.cityId).trim();

    const doc = await this.model.create({
      clientId: clientId ?? null,
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

  async listMyClient(
    clientId: string,
    filters?: ListFilters & ListPagination,
  ): Promise<RequestDocument[]> {
    const q: Record<string, any> = { clientId };
    if (filters?.status) q.status = filters.status;

    if (filters?.from || filters?.to) {
      q.createdAt = {};
      if (filters.from) q.createdAt.$gte = filters.from;
      if (filters.to) q.createdAt.$lt = filters.to;
    }

    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);

    return this.model.find(q).sort({ createdAt: -1 }).skip(offset).limit(limit).exec();
  }
}
