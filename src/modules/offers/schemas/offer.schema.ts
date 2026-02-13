import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type OfferDocument = Offer & Document;

export type OfferStatus = 'sent' | 'accepted' | 'declined' | 'withdrawn';

@Schema({ timestamps: true, collection: 'offers' })
export class Offer {
  @Prop({ type: String, required: true, index: true })
  requestId: string;

  @Prop({ type: String, required: true, index: true })
  providerUserId: string;

  @Prop({ type: String, required: true, index: true })
  clientUserId: string;

  @Prop({
    type: String,
    enum: ['sent', 'accepted', 'declined', 'withdrawn'],
    default: 'sent',
    index: true,
  })
  status: OfferStatus;

  @Prop({ type: String, maxlength: 2000, default: null })
  message: string | null;

  @Prop({ type: Object, default: null })
  pricing: { amount?: number; type?: 'fixed' | 'estimate' | 'hourly'; details?: string } | null;

  @Prop({ type: Object, default: null })
  availability: { date?: string; note?: string } | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);

OfferSchema.index({ requestId: 1, providerUserId: 1 }, { unique: true });
OfferSchema.index({ providerUserId: 1, createdAt: -1 });
OfferSchema.index({ clientUserId: 1, createdAt: -1 });
