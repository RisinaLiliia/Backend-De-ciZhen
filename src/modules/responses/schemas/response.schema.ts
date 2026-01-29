import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ResponseDocument = Response & Document;

export type ResponseStatus = 'pending' | 'accepted' | 'rejected';

@Schema({ timestamps: true, collection: 'responses' })
export class Response {
  @Prop({ type: String, required: true, index: true })
  requestId: string;

  @Prop({ type: String, required: true, index: true })
  providerUserId: string;

  @Prop({ type: String, required: true, index: true })
  clientUserId: string;

  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true,
  })
  status: ResponseStatus;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const ResponseSchema = SchemaFactory.createForClass(Response);

ResponseSchema.index({ requestId: 1, providerUserId: 1 }, { unique: true });
ResponseSchema.index({ providerUserId: 1, createdAt: -1 });
ResponseSchema.index({ clientUserId: 1, createdAt: -1 });
