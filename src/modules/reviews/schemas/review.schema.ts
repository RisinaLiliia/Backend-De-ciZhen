// src/modules/reviews/schemas/review.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ReviewDocument = Review & Document & { createdAt: Date; updatedAt: Date };
export type ReviewTargetRole = 'client' | 'provider' | 'platform';

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Prop({ type: String, default: null, index: true })
  authorUserId: string | null;

  @Prop({ type: String, default: null, index: true })
  targetUserId: string | null;

  @Prop({ type: String, enum: ['client', 'provider', 'platform'], required: true, index: true })
  targetRole: ReviewTargetRole;

  @Prop({ type: String, default: null, index: true })
  bookingId: string | null;

  @Prop({ type: String, default: null })
  requestId: string | null;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  text: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  authorName: string | null;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index(
  { bookingId: 1, targetRole: 1 },
  {
    unique: true,
    partialFilterExpression: {
      bookingId: { $type: 'string' },
      targetRole: { $in: ['client', 'provider'] },
    },
  },
);
ReviewSchema.index({ targetUserId: 1, targetRole: 1, createdAt: -1 });
ReviewSchema.index({ targetRole: 1, createdAt: -1 });
