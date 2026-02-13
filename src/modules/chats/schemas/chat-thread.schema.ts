// src/modules/chats/schemas/chat-thread.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ChatThreadDocument = ChatThread & Document;

export type ChatThreadStatus = 'active' | 'archived' | 'blocked';

@Schema({ timestamps: true, collection: 'chat_threads' })
export class ChatThread {
  @Prop({ type: String, required: true, index: true })
  requestId: string;

  @Prop({ type: String, required: true, index: true })
  clientId: string;

  @Prop({ type: String, required: true, index: true })
  providerUserId: string;

  @Prop({ type: String, default: null, index: true })
  offerId: string | null;

  @Prop({ type: String, default: null, index: true })
  contractId: string | null;

  @Prop({ type: [String], required: true, index: true })
  participants: string[];

  @Prop({
    type: String,
    enum: ['active', 'archived', 'blocked'],
    default: 'active',
    index: true,
  })
  status: ChatThreadStatus;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;

  @Prop({ type: String, trim: true, maxlength: 200, default: null })
  lastMessagePreview: string | null;

  @Prop({ type: Number, default: 0, min: 0 })
  unreadClientCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  unreadProviderCount: number;
}

export const ChatThreadSchema = SchemaFactory.createForClass(ChatThread);

ChatThreadSchema.index({ requestId: 1, clientId: 1, providerUserId: 1 }, { unique: true });
ChatThreadSchema.index({ clientId: 1, lastMessageAt: -1 });
ChatThreadSchema.index({ providerUserId: 1, lastMessageAt: -1 });
