// src/modules/reviews/reviews.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { ClientProfilesService } from '../users/client-profiles.service';
import { ProvidersService } from '../providers/providers.service';

export type ReviewSummaryResult = {
  total: number;
  averageRating: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
};

export type ReviewListSort = 'created_desc' | 'rating_desc';

export type ReviewOverviewResult = {
  items: ReviewDocument[];
  total: number;
  limit: number;
  offset: number;
  summary: ReviewSummaryResult;
};

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly clientProfiles: ClientProfilesService,
    private readonly providers: ProvidersService,
  ) {}

  private ensureObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${field} must be a valid ObjectId`);
    }
  }

  async createForProvider(
    providerUserId: string,
    input: { bookingId: string; rating: number; text?: string },
  ): Promise<ReviewDocument> {
    const bookingId = String(input.bookingId ?? '').trim();
    if (!bookingId) throw new BadRequestException('bookingId is required');
    this.ensureObjectId(bookingId, 'bookingId');

    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.providerUserId !== providerUserId) {
      throw new ForbiddenException('Access denied');
    }
    if (booking.status !== 'completed') {
      throw new BadRequestException('Booking must be completed to leave a review');
    }

    const existing = await this.reviewModel
      .findOne({ bookingId, targetRole: 'client' })
      .exec();
    if (existing) {
      throw new BadRequestException('Review already exists');
    }

    const rating = Number(input.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    const text = input.text?.trim?.() ? String(input.text).trim() : null;

    const review = await this.reviewModel.create({
      authorUserId: providerUserId,
      targetUserId: booking.clientId,
      targetRole: 'client',
      bookingId,
      requestId: booking.requestId ?? null,
      rating,
      text,
    });

    await this.clientProfiles.applyRating(booking.clientId, rating);

    const saved = await this.reviewModel.findById(review._id).exec();
    return saved ?? review;
  }

  async createForClient(
    clientId: string,
    input: { bookingId: string; rating: number; text?: string },
  ): Promise<ReviewDocument> {
    const bookingId = String(input.bookingId ?? '').trim();
    if (!bookingId) throw new BadRequestException('bookingId is required');
    this.ensureObjectId(bookingId, 'bookingId');

    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    if (booking.status !== 'completed') {
      throw new BadRequestException('Booking must be completed to leave a review');
    }

    const existing = await this.reviewModel
      .findOne({ bookingId, targetRole: 'provider' })
      .exec();
    if (existing) {
      throw new BadRequestException('Review already exists');
    }

    const rating = Number(input.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    const text = input.text?.trim?.() ? String(input.text).trim() : null;

    const review = await this.reviewModel.create({
      authorUserId: clientId,
      targetUserId: booking.providerUserId,
      targetRole: 'provider',
      bookingId,
      requestId: booking.requestId ?? null,
      rating,
      text,
    });

    await this.providers.applyRating(booking.providerUserId, rating);

    const saved = await this.reviewModel.findById(review._id).exec();
    return saved ?? review;
  }

  async listByTarget(
    targetUserId: string,
    targetRole?: 'client' | 'provider',
    limit?: number,
    offset?: number,
    sort: ReviewListSort = 'created_desc',
  ): Promise<ReviewDocument[]> {
    const id = String(targetUserId ?? '').trim();
    if (!id) throw new BadRequestException('targetUserId is required');

    const q: Record<string, unknown> = { targetUserId: id };
    if (targetRole) q.targetRole = targetRole;

    const safeLimit = Math.min(Math.max(limit ?? 20, 1), 100);
    const safeOffset = Math.max(offset ?? 0, 0);

    let sortBy: Record<string, 1 | -1>;
    if (sort === 'rating_desc') {
      sortBy = { rating: -1, createdAt: -1 };
    } else {
      sortBy = { createdAt: -1 };
    }

    return this.reviewModel
      .find(q)
      .sort(sortBy)
      .skip(safeOffset)
      .limit(safeLimit)
      .exec();
  }

  async getOverviewByTarget(
    targetUserId: string,
    targetRole?: 'client' | 'provider',
    limit?: number,
    offset?: number,
    sort: ReviewListSort = 'created_desc',
  ): Promise<ReviewOverviewResult> {
    const id = String(targetUserId ?? '').trim();
    if (!id) throw new BadRequestException('targetUserId is required');

    const q: Record<string, unknown> = { targetUserId: id };
    if (targetRole) q.targetRole = targetRole;

    const safeLimit = Math.min(Math.max(limit ?? 20, 1), 100);
    const safeOffset = Math.max(offset ?? 0, 0);
    const sortBy: Record<string, 1 | -1> =
      sort === 'rating_desc' ? { rating: -1, createdAt: -1 } : { createdAt: -1 };

    const [facets] = await this.reviewModel
      .aggregate<{
        items: Array<{
          _id: Types.ObjectId | string;
          targetRole: 'client' | 'provider';
          rating: number;
          text?: string | null;
          createdAt: Date;
          authorUserId?: string | null;
        }>;
        totalCount: Array<{ value: number }>;
        summaryStats: Array<{
          total?: number;
          averageRating?: number;
          d1?: number;
          d2?: number;
          d3?: number;
          d4?: number;
          d5?: number;
        }>;
      }>([
        { $match: q },
        {
          $facet: {
            items: [
              { $sort: sortBy },
              { $skip: safeOffset },
              { $limit: safeLimit },
            ],
            totalCount: [{ $count: 'value' }],
            summaryStats: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  averageRating: { $avg: '$rating' },
                  d1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
                  d2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                  d3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                  d4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                  d5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                },
              },
            ],
          },
        },
      ])
      .exec();

    const summary = facets?.summaryStats?.[0];
    const total =
      Number.isFinite(facets?.totalCount?.[0]?.value) && Number(facets.totalCount[0].value) >= 0
        ? Math.floor(Number(facets.totalCount[0].value))
        : 0;
    const averageRaw = Number(summary?.averageRating ?? 0);
    const averageRating =
      total > 0 && Number.isFinite(averageRaw)
        ? Math.round(Math.max(0, Math.min(5, averageRaw)) * 10) / 10
        : 0;

    return {
      items: (facets?.items ?? []) as unknown as ReviewDocument[],
      total,
      limit: safeLimit,
      offset: safeOffset,
      summary: {
        total,
        averageRating,
        distribution: {
          '1': Number.isFinite(summary?.d1) ? Math.max(0, Math.floor(Number(summary?.d1))) : 0,
          '2': Number.isFinite(summary?.d2) ? Math.max(0, Math.floor(Number(summary?.d2))) : 0,
          '3': Number.isFinite(summary?.d3) ? Math.max(0, Math.floor(Number(summary?.d3))) : 0,
          '4': Number.isFinite(summary?.d4) ? Math.max(0, Math.floor(Number(summary?.d4))) : 0,
          '5': Number.isFinite(summary?.d5) ? Math.max(0, Math.floor(Number(summary?.d5))) : 0,
        },
      },
    };
  }

  async listMyReceived(
    userId: string,
    role: 'all' | 'client' | 'provider' = 'all',
    limit?: number,
    offset?: number,
  ): Promise<ReviewDocument[]> {
    const id = String(userId ?? '').trim();
    if (!id) throw new BadRequestException('userId is required');

    const q: Record<string, unknown> = { targetUserId: id };
    if (role !== 'all') q.targetRole = role;

    const safeLimit = Math.min(Math.max(limit ?? 20, 1), 100);
    const safeOffset = Math.max(offset ?? 0, 0);

    return this.reviewModel
      .find(q)
      .sort({ createdAt: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .exec();
  }

  async getSummaryByTarget(
    targetUserId: string,
    targetRole?: 'client' | 'provider',
  ): Promise<ReviewSummaryResult> {
    const id = String(targetUserId ?? '').trim();
    if (!id) throw new BadRequestException('targetUserId is required');

    const q: Record<string, unknown> = { targetUserId: id };
    if (targetRole) q.targetRole = targetRole;

    const [summary] = await this.reviewModel
      .aggregate<{
        total?: number;
        averageRating?: number;
        d1?: number;
        d2?: number;
        d3?: number;
        d4?: number;
        d5?: number;
      }>([
        { $match: q },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            d1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            d2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            d3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            d4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            d5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          },
        },
      ])
      .exec();

    const total = Number.isFinite(summary?.total) ? Math.max(0, Math.floor(Number(summary?.total))) : 0;
    const averageRaw = Number(summary?.averageRating ?? 0);
    const averageRating =
      total > 0 && Number.isFinite(averageRaw)
        ? Math.round(Math.max(0, Math.min(5, averageRaw)) * 10) / 10
        : 0;

    return {
      total,
      averageRating,
      distribution: {
        '1': Number.isFinite(summary?.d1) ? Math.max(0, Math.floor(Number(summary?.d1))) : 0,
        '2': Number.isFinite(summary?.d2) ? Math.max(0, Math.floor(Number(summary?.d2))) : 0,
        '3': Number.isFinite(summary?.d3) ? Math.max(0, Math.floor(Number(summary?.d3))) : 0,
        '4': Number.isFinite(summary?.d4) ? Math.max(0, Math.floor(Number(summary?.d4))) : 0,
        '5': Number.isFinite(summary?.d5) ? Math.max(0, Math.floor(Number(summary?.d5))) : 0,
      },
    };
  }
}
