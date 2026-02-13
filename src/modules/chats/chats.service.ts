// src/modules/chats/chats.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import { ChatThread, ChatThreadDocument } from './schemas/chat-thread.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { Request, RequestDocument } from '../requests/schemas/request.schema';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(ChatThread.name) private readonly threadModel: Model<ChatThreadDocument>,
    @InjectModel(ChatMessage.name) private readonly messageModel: Model<ChatMessageDocument>,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
  ) {}

  private ensureObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${field} must be a valid ObjectId`);
    }
  }

  private normalizeId(v?: string): string {
    return String(v ?? '').trim();
  }

  async createOrGetThread(input: {
    requestId: string;
    providerUserId: string;
    offerId?: string;
    contractId?: string;
    actorUserId: string;
    actorRole: 'client' | 'provider' | 'admin';
  }): Promise<ChatThreadDocument> {
    const requestId = this.normalizeId(input.requestId);
    const providerUserId = this.normalizeId(input.providerUserId);
    const offerId = this.normalizeId(input.offerId);
    const contractId = this.normalizeId(input.contractId);

    if (!requestId) throw new BadRequestException('requestId is required');
    if (!providerUserId) throw new BadRequestException('providerUserId is required');
    this.ensureObjectId(requestId, 'requestId');
    this.ensureObjectId(providerUserId, 'providerUserId');
    if (offerId) this.ensureObjectId(offerId, 'offerId');
    if (contractId) this.ensureObjectId(contractId, 'contractId');

    const req = await this.requestModel.findById(requestId).exec();
    if (!req) throw new NotFoundException('Request not found');
    const clientId = String(req.clientId ?? '').trim();
    if (!clientId) throw new BadRequestException('Request has no clientId');

    if (input.actorRole === 'client' && input.actorUserId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    if (input.actorRole === 'provider' && input.actorUserId !== providerUserId) {
      throw new ForbiddenException('Access denied');
    }

    const existing = await this.threadModel
      .findOne({ requestId, clientId, providerUserId })
      .exec();
    if (existing) return existing;

    const created = await this.threadModel.create({
      requestId,
      clientId,
      providerUserId,
      offerId: offerId || null,
      contractId: contractId || null,
      participants: [clientId, providerUserId],
      status: 'active',
      lastMessageAt: null,
      lastMessagePreview: null,
      unreadClientCount: 0,
      unreadProviderCount: 0,
    });

    return created;
  }

  async listInbox(
    userId: string,
    role: 'client' | 'provider' | 'all',
  ): Promise<ChatThreadDocument[]> {
    const uid = this.normalizeId(userId);
    if (!uid) throw new BadRequestException('userId is required');

    const q: Record<string, any> = {};
    if (role === 'client') q.clientId = uid;
    if (role === 'provider') q.providerUserId = uid;
    if (role === 'all') q.participants = uid;

    return this.threadModel.find(q).sort({ lastMessageAt: -1, updatedAt: -1 }).exec();
  }

  async getThreadById(id: string, userId: string): Promise<ChatThreadDocument> {
    const tid = this.normalizeId(id);
    if (!tid) throw new BadRequestException('id is required');
    this.ensureObjectId(tid, 'id');

    const thread = await this.threadModel.findById(tid).exec();
    if (!thread) throw new NotFoundException('Thread not found');
    if (!thread.participants?.includes(userId)) throw new ForbiddenException('Access denied');
    return thread;
  }

  async listMessages(
    threadId: string,
    userId: string,
    filters?: { limit?: number; offset?: number },
  ): Promise<ChatMessageDocument[]> {
    const tid = this.normalizeId(threadId);
    if (!tid) throw new BadRequestException('threadId is required');
    this.ensureObjectId(tid, 'threadId');

    const thread = await this.getThreadById(tid, userId);
    if (!thread) throw new NotFoundException('Thread not found');

    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const offset = Math.max(filters?.offset ?? 0, 0);

    return this.messageModel
      .find({ threadId: tid })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async sendMessage(threadId: string, senderId: string, text: string): Promise<ChatMessageDocument> {
    const tid = this.normalizeId(threadId);
    if (!tid) throw new BadRequestException('threadId is required');
    this.ensureObjectId(tid, 'threadId');

    const cleanText = String(text ?? '').trim();
    if (!cleanText) throw new BadRequestException('text is required');

    const thread = await this.getThreadById(tid, senderId);

    const msg = await this.messageModel.create({
      threadId: tid,
      senderId,
      text: cleanText,
    });

    const isClient = thread.clientId === senderId;
    const isProvider = thread.providerUserId === senderId;

    const preview = cleanText.length > 200 ? `${cleanText.slice(0, 197)}...` : cleanText;
    const createdAt = (msg as any).createdAt ?? new Date();
    const update: Record<string, any> = {
      lastMessageAt: createdAt,
      lastMessagePreview: preview,
    };
    if (isClient) {
      update.unreadProviderCount = (thread.unreadProviderCount ?? 0) + 1;
      update.unreadClientCount = 0;
    } else if (isProvider) {
      update.unreadClientCount = (thread.unreadClientCount ?? 0) + 1;
      update.unreadProviderCount = 0;
    }

    await this.threadModel.updateOne({ _id: thread._id }, { $set: update }).exec();

    return msg;
  }

  async markRead(threadId: string, userId: string): Promise<void> {
    const thread = await this.getThreadById(threadId, userId);
    const update: Record<string, any> = {};

    if (thread.clientId === userId) update.unreadClientCount = 0;
    if (thread.providerUserId === userId) update.unreadProviderCount = 0;

    if (Object.keys(update).length > 0) {
      await this.threadModel.updateOne({ _id: thread._id }, { $set: update }).exec();
    }
  }
}
