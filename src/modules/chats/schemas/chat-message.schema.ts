// src/modules/chats/schemas/chat-message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

@Schema({ timestamps: true, collection: 'chat_messages' })
export class ChatMessage {
  @Prop({ type: String, required: true, index: true })
  threadId: string;

  @Prop({ type: String, required: true, index: true })
  senderId: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  text: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ threadId: 1, createdAt: -1 });
