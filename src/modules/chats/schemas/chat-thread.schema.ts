// src/modules/chats/schemas/chat-thread.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ChatThreadDocument = ChatThread & Document;

export type ChatThreadStatus = 'active' | 'archived' | 'closed';
export type ChatParticipantRole = 'customer' | 'provider';
export type ChatRelatedEntityType = 'request' | 'offer' | 'order';

@Schema({ _id: false })
export class ChatParticipantEntry {
  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({ type: String, enum: ['customer', 'provider'], required: true })
  role: ChatParticipantRole;
}

export const ChatParticipantEntrySchema = SchemaFactory.createForClass(ChatParticipantEntry);

@Schema({ _id: false })
export class ChatRelatedEntitySnapshot {
  @Prop({ type: String, enum: ['request', 'offer', 'order'], required: true })
  type: ChatRelatedEntityType;

  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, default: null })
  requestId: string | null;

  @Prop({ type: String, default: null })
  offerId: string | null;

  @Prop({ type: String, default: null })
  orderId: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 160 })
  title: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 240 })
  subtitle: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 64 })
  status: string | null;

  @Prop({ type: Number, default: null })
  amount: number | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 64 })
  amountLabel: string | null;
}

export const ChatRelatedEntitySnapshotSchema =
  SchemaFactory.createForClass(ChatRelatedEntitySnapshot);

@Schema({ _id: false })
export class ChatLastMessageSnapshot {
  @Prop({ type: String, required: true })
  messageId: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  text: string;

  @Prop({ type: Date, required: true })
  createdAt: Date;

  @Prop({ type: String, required: true })
  senderId: string;
}

export const ChatLastMessageSnapshotSchema =
  SchemaFactory.createForClass(ChatLastMessageSnapshot);

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

  // Legacy compatibility list of user ids.
  @Prop({ type: [String], required: true, index: true })
  participants: string[];

  @Prop({ type: [ChatParticipantEntrySchema], default: [] })
  participantEntries: ChatParticipantEntry[];

  @Prop({ type: ChatRelatedEntitySnapshotSchema, required: true })
  relatedEntity: ChatRelatedEntitySnapshot;

  @Prop({ type: ChatLastMessageSnapshotSchema, default: null })
  lastMessage: ChatLastMessageSnapshot | null;

  @Prop({
    type: String,
    enum: ['active', 'archived', 'closed'],
    default: 'active',
    index: true,
  })
  status: ChatThreadStatus;

  @Prop({ type: Map, of: Number, default: {} })
  unreadCount: Record<string, number>;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;

  @Prop({ type: String, trim: true, maxlength: 200, default: null })
  lastMessagePreview: string | null;

  @Prop({ type: Number, default: 0, min: 0 })
  unreadClientCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  unreadProviderCount: number;

  @Prop({ type: String, default: null, trim: true, maxlength: 2000 })
  searchText: string | null;
}

export const ChatThreadSchema = SchemaFactory.createForClass(ChatThread);

ChatThreadSchema.index({ requestId: 1, clientId: 1, providerUserId: 1 }, { unique: true });
ChatThreadSchema.index({ clientId: 1, lastMessageAt: -1 });
ChatThreadSchema.index({ providerUserId: 1, lastMessageAt: -1 });
ChatThreadSchema.index({ status: 1, updatedAt: -1 });
ChatThreadSchema.index({ searchText: 'text' });
