// src/modules/requests/schemas/request.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type RequestDocument = Request & Document;

export type RequestStatus = 'draft' | 'published' | 'matched' | 'closed' | 'cancelled';
export type PropertyType = 'apartment' | 'house';

@Schema({ timestamps: true, collection: 'requests' })
export class Request {
  @Prop({ type: String, required: true, index: true })
  clientId: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true, maxlength: 80, index: true })
  serviceKey: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 64, index: true })
  cityId: string;

  @Prop({ type: String, enum: ['apartment', 'house'], required: true })
  propertyType: PropertyType;

  @Prop({ type: Number, required: true, min: 10 })
  area: number;

  @Prop({ type: Date, required: true })
  preferredDate: Date;

  @Prop({ type: Boolean, default: false })
  isRecurring: boolean;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  comment: string | null;

  @Prop({
    type: String,
    enum: ['draft', 'published', 'matched', 'closed', 'cancelled'],
    default: 'published',
    index: true,
  })
  status: RequestStatus;

  @Prop({ type: String, default: null, index: true })
  matchedProviderUserId: string | null;

  @Prop({ type: Date, default: null })
  matchedAt: Date | null;
}

export const RequestSchema = SchemaFactory.createForClass(Request);

RequestSchema.index({ status: 1, cityId: 1, serviceKey: 1, preferredDate: 1 });
RequestSchema.index({ createdAt: -1 });
RequestSchema.index({ clientId: 1, status: 1, createdAt: -1 });
RequestSchema.index({ matchedProviderUserId: 1, createdAt: -1 });
