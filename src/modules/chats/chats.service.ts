import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Request, RequestDocument } from '../requests/schemas/request.schema';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
  ) {}

  private ensureObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${field} must be a valid ObjectId`);
    }
  }

  async createOrGet(input: { requestId: string; clientId: string; providerUserId: string }): Promise<ChatDocument> {
    const requestId = String(input.requestId ?? '').trim();
    const clientId = String(input.clientId ?? '').trim();
    const providerUserId = String(input.providerUserId ?? '').trim();

    if (!requestId) throw new BadRequestException('requestId is required');
    if (!clientId) throw new BadRequestException('clientId is required');
    if (!providerUserId) throw new BadRequestException('providerUserId is required');

    this.ensureObjectId(requestId, 'requestId');
    this.ensureObjectId(clientId, 'clientId');
    this.ensureObjectId(providerUserId, 'providerUserId');

    const existing = await this.chatModel
      .findOne({ requestId, clientId, providerUserId })
      .exec();
    if (existing) return existing;

    const req = await this.requestModel.findById(requestId).exec();
    if (!req) throw new NotFoundException('Request not found');
    if (req.clientId && String(req.clientId) !== clientId) {
      throw new BadRequestException('clientId does not match request');
    }

    const created = await this.chatModel.create({
      requestId,
      clientId,
      providerUserId,
      participants: [clientId, providerUserId],
      lastMessageAt: null,
    });

    return created;
  }

  async getMyChats(userId: string): Promise<ChatDocument[]> {
    const id = String(userId ?? '').trim();
    if (!id) throw new BadRequestException('userId is required');
    return this.chatModel
      .find({ participants: id })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async getById(id: string): Promise<ChatDocument> {
    const cid = String(id ?? '').trim();
    if (!cid) throw new BadRequestException('id is required');
    this.ensureObjectId(cid, 'id');

    const chat = await this.chatModel.findById(cid).exec();
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }
}
