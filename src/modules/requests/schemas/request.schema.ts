// src/modules/requests/schemas/request.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type RequestDocument = Request & Document;

export type RequestStatus = 'draft' | 'published' | 'matched' | 'closed' | 'cancelled';
export type PropertyType = 'apartment' | 'house';
export type GeoPoint = { type: 'Point'; coordinates: [number, number] };

@Schema({ timestamps: true, collection: 'requests' })
export class Request {
  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ type: String, index: true, default: null })
  clientId: string | null;

  @Prop({ type: String, required: true, trim: true, lowercase: true, maxlength: 80, index: true })
  serviceKey: string;

  @Prop({ type: String, trim: true, maxlength: 64, index: true, default: null })
  cityId: string | null;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  cityName: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: { type: [Number] },
    _id: false,
  })
  location?: GeoPoint;

  @Prop({ type: String, enum: ['apartment', 'house'], required: true })
  propertyType: PropertyType;

  @Prop({ type: Number, required: true, min: 10 })
  area: number;

  @Prop({ type: Number, min: 0, default: null })
  price: number | null;

  @Prop({ type: Date, required: true })
  preferredDate: Date;

  @Prop({ type: Boolean, default: false })
  isRecurring: boolean;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  comment: string | null;

  @Prop({ type: String, trim: true, maxlength: 2000, default: null })
  description: string | null;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  imageUrl: string | null;

  @Prop({ type: String, trim: true, lowercase: true, maxlength: 50 })
  categoryKey: string;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  categoryName: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  subcategoryName: string | null;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, default: null })
  searchText: string | null;

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
RequestSchema.index({ location: '2dsphere' });
RequestSchema.index({ createdAt: -1 });
RequestSchema.index({ clientId: 1, status: 1, createdAt: -1 });
RequestSchema.index({ matchedProviderUserId: 1, createdAt: -1 });
RequestSchema.index({ searchText: 'text' });
