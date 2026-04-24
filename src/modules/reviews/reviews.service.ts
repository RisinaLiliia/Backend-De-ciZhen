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
export type PlatformReviewRange = '24h' | '7d' | '30d' | '90d';

export type ReviewOverviewResult = {
  items: ReviewDocument[];
  total: number;
  limit: number;
  offset: number;
  summary: ReviewSummaryResult;
};

export type BookingReviewStatusSummary = {
  canClientReviewProvider: boolean;
  clientReviewId: string | null;
  clientReviewedProviderAt: Date | null;
  clientReviewRating: number | null;
  clientReviewText: string | null;
  canProviderReviewClient: boolean;
  providerReviewId: string | null;
  providerReviewedClientAt: Date | null;
  providerReviewRating: number | null;
  providerReviewText: string | null;
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

  private normalizeRating(value: number) {
    const rating = Number(value);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }
    return rating;
  }

  private normalizeText(value?: string) {
    return value?.trim?.() ? String(value).trim() : null;
  }

  private normalizeAuthorName(value?: string | null) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    return raw.slice(0, 120);
  }

  private resolveRangeStart(range?: PlatformReviewRange): Date | null {
    if (!range) return null;
    const now = new Date();
    const start = new Date(now);

    if (range === '24h') {
      start.setHours(now.getHours() - 24);
      return start;
    }

    if (range === '7d') {
      start.setDate(now.getDate() - 7);
      return start;
    }

    if (range === '90d') {
      start.setDate(now.getDate() - 90);
      return start;
    }

    start.setDate(now.getDate() - 30);
    return start;
  }

  async getBookingReviewStatusMap(
    bookings: Array<{ bookingId: string; status: 'confirmed' | 'cancelled' | 'completed' }>,
  ): Promise<Map<string, BookingReviewStatusSummary>> {
    const bookingIds = Array.from(
      new Set(
        bookings
          .map((item) => String(item.bookingId ?? '').trim())
          .filter((item) => item.length > 0),
      ),
    );

    if (bookingIds.length === 0) return new Map();

    const reviews = await this.reviewModel
      .find({
        bookingId: { $in: bookingIds },
        targetRole: { $in: ['provider', 'client'] },
      })
      .select({ _id: 1, bookingId: 1, targetRole: 1, rating: 1, text: 1, createdAt: 1 })
      .exec();

    const reviewMap = new Map<string, {
      provider: {
        id: string | null;
        at: Date | null;
        rating: number | null;
        text: string | null;
      };
      client: {
        id: string | null;
        at: Date | null;
        rating: number | null;
        text: string | null;
      };
    }>();
    for (const review of reviews as Array<{
      _id?: Types.ObjectId | string;
      bookingId?: string | null;
      targetRole: 'provider' | 'client';
      rating?: number | null;
      text?: string | null;
      createdAt?: Date | null;
    }>) {
      const bookingId = String(review.bookingId ?? '').trim();
      if (!bookingId) continue;
      const current = reviewMap.get(bookingId) ?? {
        provider: { id: null, at: null, rating: null, text: null },
        client: { id: null, at: null, rating: null, text: null },
      };
      const target = review.targetRole === 'provider' ? current.provider : current.client;
      target.id = typeof review._id === 'string' ? review._id : review._id?.toString?.() ?? null;
      target.at = review.createdAt ?? target.at;
      target.rating = typeof review.rating === 'number' ? review.rating : target.rating;
      target.text = typeof review.text === 'string' ? review.text : target.text;
      reviewMap.set(bookingId, current);
    }

    return new Map(
      bookings.map((booking) => {
        const bookingId = String(booking.bookingId ?? '').trim();
        const summary = reviewMap.get(bookingId) ?? {
          provider: { id: null, at: null, rating: null, text: null },
          client: { id: null, at: null, rating: null, text: null },
        };
        const isCompleted = booking.status === 'completed';
        return [bookingId, {
          canClientReviewProvider: isCompleted && !summary.provider.at,
          clientReviewId: summary.provider.id,
          clientReviewedProviderAt: summary.provider.at,
          clientReviewRating: summary.provider.rating,
          clientReviewText: summary.provider.text,
          canProviderReviewClient: isCompleted && !summary.client.at,
          providerReviewId: summary.client.id,
          providerReviewedClientAt: summary.client.at,
          providerReviewRating: summary.client.rating,
          providerReviewText: summary.client.text,
        }];
      }),
    );
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

    const rating = this.normalizeRating(input.rating);
    const text = this.normalizeText(input.text);

    const review = await this.reviewModel.create({
      authorUserId: providerUserId,
      targetUserId: booking.clientId,
      targetRole: 'client',
      bookingId,
      requestId: booking.requestId ?? null,
      rating,
      text,
      authorName: null,
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

    const rating = this.normalizeRating(input.rating);
    const text = this.normalizeText(input.text);

    const review = await this.reviewModel.create({
      authorUserId: clientId,
      targetUserId: booking.providerUserId,
      targetRole: 'provider',
      bookingId,
      requestId: booking.requestId ?? null,
      rating,
      text,
      authorName: null,
    });

    await this.providers.applyRating(booking.providerUserId, rating);

    const saved = await this.reviewModel.findById(review._id).exec();
    return saved ?? review;
  }

  async createPlatformReview(
    input: { rating: number; text?: string; authorName?: string | null },
    actor?: { userId?: string | null; fallbackName?: string | null },
  ): Promise<ReviewDocument> {
    const rating = this.normalizeRating(input.rating);
    const text = this.normalizeText(input.text);
    const userId = String(actor?.userId ?? '').trim();
    const resolvedAuthorName =
      this.normalizeAuthorName(actor?.fallbackName) ??
      this.normalizeAuthorName(input.authorName) ??
      'Anonymous';

    const review = await this.reviewModel.create({
      authorUserId: userId || null,
      authorName: resolvedAuthorName,
      targetUserId: null,
      targetRole: 'platform',
      bookingId: null,
      requestId: null,
      rating,
      text,
    });

    const saved = await this.reviewModel.findById(review._id).exec();
    return saved ?? review;
  }

  async getOverviewByTarget(
    targetUserId: string,
    targetRole?: 'client' | 'provider' | 'platform',
    limit?: number,
    offset?: number,
    sort: ReviewListSort = 'created_desc',
    options?: {
      createdFrom?: Date | null;
    },
  ): Promise<ReviewOverviewResult> {
    const id = String(targetUserId ?? '').trim();
    if (!id && targetRole !== 'platform') {
      throw new BadRequestException('targetUserId is required');
    }

    const q: Record<string, unknown> =
      targetRole === 'platform'
        ? { targetRole: 'platform' }
        : { targetUserId: id };
    if (targetRole && targetRole !== 'platform') q.targetRole = targetRole;
    if (options?.createdFrom) {
      q.createdAt = { $gte: options.createdFrom };
    }

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

  async getPlatformOverview(
    limit?: number,
    offset?: number,
    sort: ReviewListSort = 'created_desc',
    range?: PlatformReviewRange,
  ): Promise<ReviewOverviewResult> {
    return this.getOverviewByTarget('', 'platform', limit, offset, sort, {
      createdFrom: this.resolveRangeStart(range),
    });
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
}
