// src/modules/reviews/reviews.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { ClientProfilesService } from '../users/client-profiles.service';
import { ProvidersService } from '../providers/providers.service';

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

    return review;
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

    return review;
  }

  async listByTarget(
    targetUserId: string,
    targetRole?: 'client' | 'provider',
    limit?: number,
    offset?: number,
  ): Promise<ReviewDocument[]> {
    const id = String(targetUserId ?? '').trim();
    if (!id) throw new BadRequestException('targetUserId is required');

    const q: Record<string, unknown> = { targetUserId: id };
    if (targetRole) q.targetRole = targetRole;

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
