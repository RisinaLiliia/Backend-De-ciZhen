// src/modules/chats/schemas/chat-message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;
export type ChatMessageType = 'text' | 'attachment' | 'system';
export type ChatDeliveryStatus = 'sent' | 'delivered' | 'read';

@Schema({ _id: false })
export class ChatMessageAttachment {
  @Prop({ type: String, required: true, trim: true, maxlength: 1000 })
  url: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  name: string;

  @Prop({ type: Number, required: true, min: 0 })
  size: number;

  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  mimeType: string;
}

export const ChatMessageAttachmentSchema =
  SchemaFactory.createForClass(ChatMessageAttachment);

@Schema({ timestamps: true, collection: 'chat_messages' })
export class ChatMessage {
  @Prop({ type: String, required: true, index: true })
  conversationId: string;

  // Legacy compatibility alias for previous thread-based endpoints.
  @Prop({ type: String, required: true, index: true })
  threadId: string;

  @Prop({ type: String, required: true, index: true })
  senderId: string;

  @Prop({
    type: String,
    enum: ['text', 'attachment', 'system'],
    default: 'text',
    index: true,
  })
  type: ChatMessageType;

  @Prop({ type: String, trim: true, maxlength: 2000, default: null })
  text: string | null;

  @Prop({ type: [ChatMessageAttachmentSchema], default: [] })
  attachments: ChatMessageAttachment[];

  @Prop({
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
    index: true,
  })
  deliveryStatus: ChatDeliveryStatus;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
ChatMessageSchema.index({ threadId: 1, createdAt: -1, _id: -1 });
