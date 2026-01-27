// src/modules/providers/schemas/provider-profile.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ProviderProfileDocument = ProviderProfile & Document;

export type ProviderStatus = 'draft' | 'active' | 'suspended';

@Schema({ timestamps: true, collection: 'provider_profiles' })
export class ProviderProfile {
  @Prop({ type: String, required: true, unique: true, index: true })
  userId: string;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  displayName: string | null;

  @Prop({ type: String, trim: true, maxlength: 2000, default: null })
  bio: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  companyName: string | null;

  @Prop({ type: String, trim: true, maxlength: 50, default: null })
  vatId: string | null;

  @Prop({ type: String, default: null, index: true })
  cityId: string | null;

  @Prop({ type: [String], default: [], index: true })
  serviceKeys: string[];

  @Prop({ type: Number, default: null, min: 0 })
  basePrice: number | null;

  @Prop({
    type: String,
    enum: ['draft', 'active', 'suspended'],
    default: 'draft',
    index: true,
  })
  status: ProviderStatus;

  @Prop({ type: Boolean, default: false, index: true })
  isBlocked: boolean;

  @Prop({ type: Date, default: null })
  blockedAt: Date | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const ProviderProfileSchema = SchemaFactory.createForClass(ProviderProfile);

ProviderProfileSchema.index({ cityId: 1, status: 1, isBlocked: 1 });
ProviderProfileSchema.index({ serviceKeys: 1, status: 1, isBlocked: 1 });
