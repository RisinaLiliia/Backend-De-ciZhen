import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ContractDocument = Contract & Document;

export type ContractStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

@Schema({ timestamps: true, collection: 'contracts' })
export class Contract {
  @Prop({ type: String, required: true, index: true })
  requestId: string;

  @Prop({ type: String, required: true, index: true })
  offerId: string;

  @Prop({ type: String, required: true, index: true })
  clientId: string;

  @Prop({ type: String, required: true, index: true })
  providerUserId: string;

  @Prop({
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: ContractStatus;

  @Prop({ type: Number, default: null })
  priceAmount: number | null;

  @Prop({ type: String, enum: ['fixed', 'estimate', 'hourly'], default: null })
  priceType: 'fixed' | 'estimate' | 'hourly' | null;

  @Prop({ type: String, maxlength: 500, default: null })
  priceDetails: string | null;

  @Prop({ type: Date, default: null })
  confirmedAt: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({ type: String, maxlength: 300, default: null })
  cancelReason: string | null;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);

ContractSchema.index({ offerId: 1 }, { unique: true, name: 'uniq_offer_contract' });
ContractSchema.index({ requestId: 1, createdAt: -1 }, { name: 'idx_request_contracts' });
ContractSchema.index({ clientId: 1, createdAt: -1 }, { name: 'idx_client_contracts' });
ContractSchema.index({ providerUserId: 1, createdAt: -1 }, { name: 'idx_provider_contracts' });
