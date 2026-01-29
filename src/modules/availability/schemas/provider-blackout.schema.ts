// src/modules/availability/schemas/provider-blackout.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ProviderBlackoutDocument = ProviderBlackout & Document;

@Schema({ timestamps: true, collection: 'provider_blackouts' })
export class ProviderBlackout {
  @Prop({ type: String, required: true, index: true })
  providerUserId: string;

  @Prop({ type: Date, required: true, index: true })
  startAt: Date;

  @Prop({ type: Date, required: true, index: true })
  endAt: Date;

  @Prop({ type: String, trim: true, maxlength: 200, default: null })
  reason: string | null;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;
}

export const ProviderBlackoutSchema = SchemaFactory.createForClass(ProviderBlackout);

ProviderBlackoutSchema.index({ providerUserId: 1, startAt: 1, endAt: 1 });
ProviderBlackoutSchema.index({ providerUserId: 1, isActive: 1, startAt: 1 });
