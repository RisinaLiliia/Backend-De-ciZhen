// src/modules/chats/schemas/chat.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true, collection: 'chats' })
export class Chat {
  @Prop({ type: String, required: true, index: true })
  requestId: string;

  @Prop({ type: String, required: true, index: true })
  clientId: string;

  @Prop({ type: String, required: true, index: true })
  providerUserId: string;

  @Prop({ type: [String], required: true, index: true })
  participants: string[];

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

ChatSchema.index({ requestId: 1, clientId: 1, providerUserId: 1 }, { unique: true });
