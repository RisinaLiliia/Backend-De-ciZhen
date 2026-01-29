// src/modules/bookings/schemas/booking.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type BookingDocument = Booking & Document;

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';
export type BookingCancelledBy = 'client' | 'provider' | 'admin';

@Schema({ timestamps: true, collection: 'bookings' })
export class Booking {
  @Prop({ type: String, required: true })
  requestId: string;

  @Prop({ type: String, required: true })
  responseId: string;

  @Prop({ type: String, required: true })
  providerUserId: string;

  @Prop({ type: String, required: true })
  clientId: string;

  @Prop({ type: Date, required: true })
  startAt: Date;

  @Prop({ type: Number, default: 60, min: 15, max: 24 * 60 })
  durationMin: number;

  @Prop({ type: Date, required: true })
  endAt: Date;

  @Prop({
    type: String,
    enum: ['confirmed', 'cancelled', 'completed'],
    default: 'confirmed',
  })
  status: BookingStatus;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({
    type: String,
    enum: ['client', 'provider', 'admin'],
    default: null,
  })
  cancelledBy: BookingCancelledBy | null;

  @Prop({ type: String, trim: true, maxlength: 300, default: null })
  cancelReason: string | null;

  @Prop({ type: String, default: null })
  rescheduledFromId: string | null;

  @Prop({ type: String, default: null })
  rescheduledToId: string | null;

  @Prop({ type: Date, default: null })
  rescheduledAt: Date | null;

  @Prop({ type: String, trim: true, maxlength: 300, default: null })
  rescheduleReason: string | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

BookingSchema.index(
  { requestId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['confirmed', 'completed'] } },
    name: 'uniq_active_booking_per_request',
  },
);

BookingSchema.index(
  { requestId: 1, responseId: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['confirmed', 'completed'] } },
    name: 'uniq_active_booking_same_slot',
  },
);

BookingSchema.index({ clientId: 1, status: 1, startAt: -1 }, { name: 'idx_client_my' });
BookingSchema.index({ providerUserId: 1, status: 1, startAt: -1 }, { name: 'idx_provider_my' });

BookingSchema.index(
  { providerUserId: 1, status: 1, startAt: 1, endAt: 1 },
  { name: 'idx_provider_overlap' },
);

BookingSchema.index(
  { requestId: 1, responseId: 1, providerUserId: 1, clientId: 1 },
  { name: 'idx_booking_chain' },
);

BookingSchema.index(
  { rescheduledFromId: 1 },
  { name: 'uniq_rescheduled_from', unique: true, sparse: true },
);
BookingSchema.index(
  { rescheduledToId: 1 },
  { name: 'idx_rescheduled_to', sparse: true },
);

BookingSchema.index({ status: 1, endAt: 1 }, { name: 'idx_status_endAt' });
