// src/modules/reviews/schemas/review.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ReviewDocument = Review & Document;
export type ReviewTargetRole = 'client' | 'provider';

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Prop({ type: String, required: true, index: true })
  authorUserId: string;

  @Prop({ type: String, required: true, index: true })
  targetUserId: string;

  @Prop({ type: String, enum: ['client', 'provider'], required: true, index: true })
  targetRole: ReviewTargetRole;

  @Prop({ type: String, required: true, index: true })
  bookingId: string;

  @Prop({ type: String, default: null })
  requestId: string | null;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  text: string | null;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ bookingId: 1, targetRole: 1 }, { unique: true });
ReviewSchema.index({ targetUserId: 1, targetRole: 1, createdAt: -1 });
