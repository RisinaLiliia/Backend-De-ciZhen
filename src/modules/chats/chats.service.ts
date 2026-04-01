// src/modules/chats/chats.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import { ChatThread, type ChatThreadDocument } from './schemas/chat-thread.schema';
import {
  ChatMessage,
  type ChatDeliveryStatus,
  type ChatMessageDocument,
  type ChatMessageType,
} from './schemas/chat-message.schema';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { ChatsGateway } from './chats.gateway';
import type { CreateConversationDto } from './dto/create-conversation.dto';
import type { ChatAttachmentInputDto, CreateMessageDto } from './dto/create-message.dto';

type ConversationCursor = {
  value: string;
  id: string;
};

type ListConversationsFilters = {
  role?: 'customer' | 'provider';
  state?: 'active' | 'archived';
  search?: string;
  limit?: number;
  cursor?: string;
};

type ListMessagesFilters = {
  limit?: number;
  cursor?: string;
  offset?: number;
};

type CreateOrGetConversationInput = CreateConversationDto & {
  actorUserId: string;
  actorRole: 'client' | 'provider' | 'admin';
};

type SendMessageInput = Pick<CreateMessageDto, 'text' | 'attachments'>;

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(ChatThread.name) private readonly threadModel: Model<ChatThreadDocument>,
    @InjectModel(ChatMessage.name) private readonly messageModel: Model<ChatMessageDocument>,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly gateway: ChatsGateway,
  ) {}

  private ensureObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${field} must be a valid ObjectId`);
    }
  }

  private normalizeId(v?: string | null): string {
    return String(v ?? '').trim();
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private sanitizeText(value?: string | null) {
    const withoutControlChars = Array.from(String(value ?? ''))
      .map((char) => {
        const code = char.charCodeAt(0);
        return code < 32 || code === 127 ? ' ' : char;
      })
      .join('');

    return withoutControlChars
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeAttachments(items?: ChatAttachmentInputDto[]) {
    const normalized = (items ?? [])
      .map((item) => ({
        url: String(item.url ?? '').trim(),
        name: String(item.name ?? '').trim(),
        size: Number(item.size ?? 0),
        mimeType: String(item.mimeType ?? '').trim(),
      }))
      .filter((item) => item.url && item.name && item.mimeType);

    if (normalized.length > 5) {
      throw new BadRequestException('attachments limit exceeded');
    }

    return normalized;
  }

  private encodeCursor(date: Date | null | undefined, id: string) {
    if (!date) return undefined;
    return Buffer.from(JSON.stringify({ value: date.toISOString(), id }), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor?: string | null): ConversationCursor | null {
    const raw = String(cursor ?? '').trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as ConversationCursor;
      if (!parsed?.value || !parsed?.id) return null;
      return parsed;
    } catch {
      throw new BadRequestException('cursor is invalid');
    }
  }

  private buildCursorQuery(field: 'updatedAt' | 'createdAt', cursor?: string | null) {
    const parsed = this.decodeCursor(cursor);
    if (!parsed) return {};
    const valueDate = new Date(parsed.value);
    if (!Number.isFinite(valueDate.getTime())) {
      throw new BadRequestException('cursor date is invalid');
    }

    const id =
      Types.ObjectId.isValid(parsed.id) ? new Types.ObjectId(parsed.id) : null;

    if (!id) {
      return { [field]: { $lt: valueDate } };
    }

    return {
      $or: [
        { [field]: { $lt: valueDate } },
        { [field]: valueDate, _id: { $lt: id } },
      ],
    };
  }

  private isUserOnline(lastSeenAt?: Date | null) {
    if (!lastSeenAt) return false;
    return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
  }

  private formatAmountLabel(amount: number | null | undefined) {
    if (amount == null || !Number.isFinite(amount)) return null;
    return `EUR ${Math.round(amount)}`;
  }

  private readUnreadValue(source: Record<string, number> | Map<string, number> | null | undefined, key: string) {
    if (!source) return 0;
    if (source instanceof Map) {
      return Math.max(Number(source.get(key) ?? 0), 0);
    }
    if (typeof (source as { get?: unknown }).get === 'function') {
      return Math.max(Number((source as unknown as Map<string, number>).get(key) ?? 0), 0);
    }
    return Math.max(Number((source as Record<string, number>)[key] ?? 0), 0);
  }

  private buildUnreadCountRecord(
    clientId: string,
    providerUserId: string,
    source?: Record<string, number> | Map<string, number> | null,
  ) {
    const record = {
      [clientId]: this.readUnreadValue(source, clientId),
      [providerUserId]: this.readUnreadValue(source, providerUserId),
    };
    return record;
  }

  private buildLegacyUnreadCounts(
    unreadCount: Record<string, number>,
    clientId: string,
    providerUserId: string,
  ) {
    return {
      unreadClientCount: unreadCount[clientId] ?? 0,
      unreadProviderCount: unreadCount[providerUserId] ?? 0,
    };
  }

  private buildParticipantEntries(clientId: string, providerUserId: string) {
    return [
      { userId: clientId, role: 'customer' as const },
      { userId: providerUserId, role: 'provider' as const },
    ];
  }

  private resolveCounterpartForViewer(
    viewerUserId: string | null | undefined,
    customerUser: any,
    providerUser: any,
    clientId: string,
    providerUserId: string,
  ) {
    if (viewerUserId === providerUserId) {
      return {
        userId: clientId,
        role: 'customer' as const,
        displayName: customerUser?.name ?? clientId,
        avatarUrl: customerUser?.avatar?.url ?? null,
        isOnline: this.isUserOnline(customerUser?.lastSeenAt ?? null),
        lastSeenAt: customerUser?.lastSeenAt ?? null,
      };
    }

    return {
      userId: providerUserId,
      role: 'provider' as const,
      displayName: providerUser?.name ?? providerUserId,
      avatarUrl: providerUser?.avatar?.url ?? null,
      isOnline: this.isUserOnline(providerUser?.lastSeenAt ?? null),
      lastSeenAt: providerUser?.lastSeenAt ?? null,
    };
  }

  private determineActorConversationRole(userId: string, clientId: string, providerUserId: string) {
    if (userId === clientId) return 'customer' as const;
    if (userId === providerUserId) return 'provider' as const;
    return null;
  }

  private buildSearchText(parts: Array<string | null | undefined>) {
    const text = parts
      .map((part) => this.sanitizeText(part))
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text || null;
  }

  private async buildConversationContext(input: CreateOrGetConversationInput) {
    const explicitRequestId = this.normalizeId(input.requestId);
    const explicitProviderUserId =
      this.normalizeId(input.providerUserId) || this.normalizeId(input.participantUserId);
    const explicitOfferId =
      this.normalizeId(input.offerId)
      || (input.relatedEntity?.type === 'offer' ? this.normalizeId(input.relatedEntity.id) : '');
    const explicitOrderId =
      this.normalizeId(input.orderId)
      || this.normalizeId(input.contractId)
      || (input.relatedEntity?.type === 'order' ? this.normalizeId(input.relatedEntity.id) : '');

    let request: RequestDocument | null = null;
    let offer: OfferDocument | null = null;
    let contract: ContractDocument | null = null;

    if (explicitOrderId) {
      this.ensureObjectId(explicitOrderId, 'orderId');
      contract = await this.contractModel.findById(explicitOrderId).exec();
      if (!contract) throw new NotFoundException('Contract not found');
    }

    if (contract?.offerId || explicitOfferId) {
      const offerId = this.normalizeId(contract?.offerId ?? explicitOfferId);
      this.ensureObjectId(offerId, 'offerId');
      offer = await this.offerModel.findById(offerId).exec();
      if (!offer) throw new NotFoundException('Offer not found');
    }

    const requestId = this.normalizeId(
      explicitRequestId || contract?.requestId || offer?.requestId || (input.relatedEntity?.type === 'request' ? input.relatedEntity.id : ''),
    );
    if (!requestId) throw new BadRequestException('requestId is required');
    this.ensureObjectId(requestId, 'requestId');

    request = await this.requestModel.findById(requestId).exec();
    if (!request) throw new NotFoundException('Request not found');

    const clientId = this.normalizeId(offer?.clientUserId ?? contract?.clientId ?? request.clientId);
    if (!clientId) throw new BadRequestException('Request has no clientId');

    const providerUserId = this.normalizeId(
      explicitProviderUserId || offer?.providerUserId || contract?.providerUserId,
    );
    if (!providerUserId) throw new BadRequestException('providerUserId is required');

    this.ensureObjectId(clientId, 'clientId');
    this.ensureObjectId(providerUserId, 'providerUserId');

    if (input.actorRole === 'client' && input.actorUserId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    if (input.actorRole === 'provider' && input.actorUserId !== providerUserId) {
      throw new ForbiddenException('Access denied');
    }

    const relatedType = contract
      ? 'order'
      : offer
        ? 'offer'
        : 'request';
    const relatedId = this.normalizeId(
      contract?._id?.toString()
      ?? offer?._id?.toString()
      ?? request._id?.toString(),
    );

    const users = await this.userModel
      .find({ _id: { $in: [clientId, providerUserId] } })
      .select('_id name avatar lastSeenAt')
      .lean()
      .exec();
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const relatedEntity = {
      type: relatedType,
      id: relatedId,
      requestId,
      offerId: offer?._id?.toString() ?? null,
      orderId: contract?._id?.toString() ?? null,
      title: request.title ?? null,
      subtitle: request.cityName ?? null,
      status: contract?.status ?? offer?.status ?? request.status ?? null,
      amount: contract?.priceAmount ?? offer?.pricing?.amount ?? request.price ?? null,
      amountLabel: this.formatAmountLabel(contract?.priceAmount ?? offer?.pricing?.amount ?? request.price),
    };

    return {
      requestId,
      clientId,
      providerUserId,
      offerId: offer?._id?.toString() ?? null,
      orderId: contract?._id?.toString() ?? null,
      participants: [clientId, providerUserId],
      participantEntries: this.buildParticipantEntries(clientId, providerUserId),
      relatedEntity,
      searchText: this.buildSearchText([
        request.title,
        request.cityName,
        userMap.get(clientId)?.name as string | undefined,
        userMap.get(providerUserId)?.name as string | undefined,
        requestId,
        offer?._id?.toString(),
        contract?._id?.toString(),
      ]),
    };
  }

  async createOrGetConversation(input: CreateOrGetConversationInput): Promise<ChatThreadDocument> {
    const context = await this.buildConversationContext(input);

    const existing = await this.threadModel
      .findOne({
        requestId: context.requestId,
        clientId: context.clientId,
        providerUserId: context.providerUserId,
      })
      .exec();

    if (existing) {
      await this.threadModel
        .updateOne(
          { _id: existing._id },
          {
            $set: {
              offerId: context.offerId,
              contractId: context.orderId,
              participantEntries: context.participantEntries,
              relatedEntity: context.relatedEntity,
              searchText: this.buildSearchText([
                existing.searchText,
                context.searchText,
                existing.lastMessagePreview,
              ]),
            },
          },
        )
        .exec();

      return (await this.threadModel.findById(existing._id).exec()) ?? existing;
    }

    const unreadCount = this.buildUnreadCountRecord(context.clientId, context.providerUserId);
    const created = await this.threadModel.create({
      requestId: context.requestId,
      clientId: context.clientId,
      providerUserId: context.providerUserId,
      offerId: context.offerId,
      contractId: context.orderId,
      participants: context.participants,
      participantEntries: context.participantEntries,
      relatedEntity: context.relatedEntity,
      lastMessage: null,
      status: 'active',
      unreadCount,
      ...this.buildLegacyUnreadCounts(unreadCount, context.clientId, context.providerUserId),
      lastMessageAt: null,
      lastMessagePreview: null,
      searchText: context.searchText,
    });

    return created;
  }

  async listConversations(userId: string, filters: ListConversationsFilters = {}) {
    const uid = this.normalizeId(userId);
    if (!uid) throw new BadRequestException('userId is required');

    const query: Record<string, unknown> = {};
    if (filters.role === 'customer') query.clientId = uid;
    if (filters.role === 'provider') query.providerUserId = uid;
    if (!filters.role) query.participants = uid;
    if (filters.state) query.status = filters.state;

    const search = this.sanitizeText(filters.search);
    if (search) {
      query.searchText = { $regex: this.escapeRegex(search.toLowerCase()), $options: 'i' };
    }

    Object.assign(query, this.buildCursorQuery('updatedAt', filters.cursor));

    const limit = Math.min(Math.max(filters.limit ?? 24, 1), 100);
    const docs = await this.threadModel
      .find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const last = items.at(-1);

    return {
      items,
      nextCursor: hasMore && last ? this.encodeCursor((last as any).updatedAt ?? last.lastMessageAt, String((last as any)._id)) : undefined,
    };
  }

  async listInbox(
    userId: string,
    role: 'client' | 'provider' | 'all',
  ): Promise<ChatThreadDocument[]> {
    const mappedRole =
      role === 'client' ? 'customer' : role === 'provider' ? 'provider' : undefined;
    const result = await this.listConversations(userId, { role: mappedRole, limit: 200 });
    return result.items;
  }

  async getConversationById(id: string, userId: string): Promise<ChatThreadDocument> {
    const tid = this.normalizeId(id);
    if (!tid) throw new BadRequestException('id is required');
    this.ensureObjectId(tid, 'id');

    const thread = await this.threadModel.findById(tid).exec();
    if (!thread) throw new NotFoundException('Conversation not found');
    if (!thread.participants?.includes(userId)) throw new ForbiddenException('Access denied');
    return thread;
  }

  async getThreadById(id: string, userId: string): Promise<ChatThreadDocument> {
    return this.getConversationById(id, userId);
  }

  async serializeConversation(
    doc: ChatThreadDocument,
    viewerUserId?: string | null,
  ) {
    const [serialized] = await this.serializeConversations([doc], viewerUserId);
    return serialized;
  }

  async listMessages(
    conversationId: string,
    userId: string,
    filters: ListMessagesFilters = {},
  ) {
    const thread = await this.getConversationById(conversationId, userId);

    const deliveredStatuses: ChatDeliveryStatus[] = ['sent', 'delivered'];
    await this.messageModel
      .updateMany(
        {
          conversationId: String((thread as any)._id),
          senderId: { $ne: userId },
          deliveryStatus: { $in: deliveredStatuses },
        },
        { $set: { deliveryStatus: 'delivered' } },
      )
      .exec();

    const limit = Math.min(Math.max(filters.limit ?? 24, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const query: Record<string, unknown> = {
      conversationId: String((thread as any)._id),
    };

    if (filters.cursor) {
      Object.assign(query, this.buildCursorQuery('createdAt', filters.cursor));
    }

    let builder = this.messageModel
      .find(query)
      .sort({ createdAt: -1, _id: -1 });

    if (!filters.cursor && offset > 0) {
      builder = builder.skip(offset);
    }

    const docs = await builder.limit(limit + 1).exec();
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const last = items.at(-1);

    return {
      items,
      nextCursor: hasMore && last ? this.encodeCursor((last as any).createdAt, String((last as any)._id)) : undefined,
    };
  }

  private async refreshConversationSearchText(thread: ChatThreadDocument, preview: string) {
    const users = await this.userModel
      .find({ _id: { $in: [thread.clientId, thread.providerUserId] } })
      .select('_id name')
      .lean()
      .exec();
    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const request = await this.requestModel.findById(thread.requestId).select('title cityName').lean().exec();

    return this.buildSearchText([
      request?.title,
      request?.cityName,
      userMap.get(thread.clientId)?.name as string | undefined,
      userMap.get(thread.providerUserId)?.name as string | undefined,
      thread.requestId,
      thread.offerId,
      thread.contractId,
      preview,
    ]);
  }

  async sendMessage(conversationId: string, senderId: string, payload: SendMessageInput): Promise<ChatMessageDocument> {
    const thread = await this.getConversationById(conversationId, senderId);

    const text = this.sanitizeText(payload.text);
    const attachments = this.normalizeAttachments(payload.attachments);
    if (!text && attachments.length === 0) {
      throw new BadRequestException('text or attachments is required');
    }

    const type: ChatMessageType =
      attachments.length > 0 && !text ? 'attachment' : 'text';

    const created = await this.messageModel.create({
      conversationId: String((thread as any)._id),
      threadId: String((thread as any)._id),
      senderId,
      type,
      text: text || null,
      attachments,
      deliveryStatus: 'sent',
    });

    const preview = text
      || (attachments.length === 1 ? attachments[0].name : `${attachments.length} attachments`);

    const unreadCount = this.buildUnreadCountRecord(
      thread.clientId,
      thread.providerUserId,
      (thread.unreadCount as Record<string, number>) ?? null,
    );
    const actorRole = this.determineActorConversationRole(senderId, thread.clientId, thread.providerUserId);
    if (!actorRole) {
      throw new ForbiddenException('Access denied');
    }
    const recipientId = actorRole === 'customer' ? thread.providerUserId : thread.clientId;
    unreadCount[senderId] = 0;
    unreadCount[recipientId] = (unreadCount[recipientId] ?? 0) + 1;

    const searchText = await this.refreshConversationSearchText(thread, preview);

    await this.threadModel
      .updateOne(
        { _id: (thread as any)._id },
        {
          $set: {
            lastMessage: {
              messageId: String((created as any)._id),
              text: preview.length > 200 ? `${preview.slice(0, 197)}...` : preview,
              createdAt: (created as any).createdAt ?? new Date(),
              senderId,
            },
            lastMessageAt: (created as any).createdAt ?? new Date(),
            lastMessagePreview: preview.length > 200 ? `${preview.slice(0, 197)}...` : preview,
            unreadCount,
            ...this.buildLegacyUnreadCounts(unreadCount, thread.clientId, thread.providerUserId),
            searchText,
          },
        },
      )
      .exec();

    const updatedThread = await this.getConversationById(String((thread as any)._id), senderId);
    const conversationPayloads = await Promise.all(
      (updatedThread.participants ?? []).map(async (participantUserId) => ({
        participantUserId,
        dto: await this.serializeConversation(updatedThread, participantUserId),
      })),
    );
    const messageDto = this.serializeMessage(created);
    this.gateway.emitMessageCreated(updatedThread.participants ?? [], messageDto);
    conversationPayloads.forEach(({ participantUserId, dto }) => {
      this.gateway.emitConversationUpdated([participantUserId], dto);
    });

    return created;
  }

  async markRead(conversationId: string, userId: string): Promise<ChatThreadDocument> {
    const thread = await this.getConversationById(conversationId, userId);
    const unreadCount = this.buildUnreadCountRecord(
      thread.clientId,
      thread.providerUserId,
      (thread.unreadCount as Record<string, number>) ?? null,
    );
    unreadCount[userId] = 0;

    await this.messageModel
      .updateMany(
        {
          conversationId: String((thread as any)._id),
          senderId: { $ne: userId },
          deliveryStatus: { $ne: 'read' },
        },
        { $set: { deliveryStatus: 'read' } },
      )
      .exec();

    await this.threadModel
      .updateOne(
        { _id: (thread as any)._id },
        {
          $set: {
            unreadCount,
            ...this.buildLegacyUnreadCounts(unreadCount, thread.clientId, thread.providerUserId),
          },
        },
      )
      .exec();

    const updatedThread = await this.getConversationById(String((thread as any)._id), userId);
    const conversationPayloads = await Promise.all(
      (updatedThread.participants ?? []).map(async (participantUserId) => ({
        participantUserId,
        dto: await this.serializeConversation(updatedThread, participantUserId),
      })),
    );
    this.gateway.emitMessageRead(updatedThread.participants ?? [], {
      conversationId: String((updatedThread as any)._id),
      userId,
      readAt: new Date(),
    });
    conversationPayloads.forEach(({ participantUserId, dto }) => {
      this.gateway.emitConversationUpdated([participantUserId], dto);
    });

    return updatedThread;
  }

  private async loadUsers(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, any>();
    const items = await this.userModel
      .find({ _id: { $in: [...new Set(userIds)] } })
      .select('_id name avatar lastSeenAt')
      .lean()
      .exec();
    return new Map(items.map((item) => [String(item._id), item]));
  }

  private async loadRequests(requestIds: string[]) {
    if (requestIds.length === 0) return new Map<string, any>();
    const items = await this.requestModel
      .find({ _id: { $in: [...new Set(requestIds)] } })
      .select('_id title cityName status price preferredDate')
      .lean()
      .exec();
    return new Map(items.map((item) => [String(item._id), item]));
  }

  private async loadOffers(offerIds: string[]) {
    const ids = [...new Set(offerIds.filter(Boolean))];
    if (ids.length === 0) return new Map<string, any>();
    const items = await this.offerModel
      .find({ _id: { $in: ids } })
      .select('_id status pricing providerUserId requestId')
      .lean()
      .exec();
    return new Map(items.map((item) => [String(item._id), item]));
  }

  private async loadContracts(contractIds: string[]) {
    const ids = [...new Set(contractIds.filter(Boolean))];
    if (ids.length === 0) return new Map<string, any>();
    const items = await this.contractModel
      .find({ _id: { $in: ids } })
      .select('_id status priceAmount providerUserId requestId offerId')
      .lean()
      .exec();
    return new Map(items.map((item) => [String(item._id), item]));
  }

  serializeMessage(message: ChatMessageDocument) {
    return {
      id: String((message as any)._id),
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type,
      text: message.text,
      attachments: (message.attachments ?? []).map((attachment) => ({
        url: attachment.url,
        name: attachment.name,
        size: attachment.size,
        mimeType: attachment.mimeType,
      })),
      deliveryStatus: message.deliveryStatus,
      createdAt: (message as any).createdAt,
    };
  }

  async serializeConversations(docs: ChatThreadDocument[], viewerUserId?: string | null) {
    const requestIds = docs.map((doc) => doc.requestId);
    const offerIds = docs.map((doc) => doc.offerId ?? doc.relatedEntity?.offerId ?? '').filter(Boolean);
    const contractIds = docs.map((doc) => doc.contractId ?? doc.relatedEntity?.orderId ?? '').filter(Boolean);
    const userIds = docs.flatMap((doc) => [doc.clientId, doc.providerUserId]);

    const [requestMap, offerMap, contractMap, userMap] = await Promise.all([
      this.loadRequests(requestIds),
      this.loadOffers(offerIds),
      this.loadContracts(contractIds),
      this.loadUsers(userIds),
    ]);

    return docs.map((doc) => {
      const request = requestMap.get(doc.requestId);
      const offer = offerMap.get(doc.offerId ?? doc.relatedEntity?.offerId ?? '');
      const contract = contractMap.get(doc.contractId ?? doc.relatedEntity?.orderId ?? '');
      const customerUser = userMap.get(doc.clientId);
      const providerUser = userMap.get(doc.providerUserId);
      const unreadCount = this.buildUnreadCountRecord(
        doc.clientId,
        doc.providerUserId,
        (doc.unreadCount as Record<string, number>) ?? null,
      );

      return {
        id: String((doc as any)._id),
        participants: [
          {
            userId: doc.clientId,
            role: 'customer' as const,
            name: customerUser?.name ?? null,
            displayName: customerUser?.name ?? null,
            avatarUrl: customerUser?.avatar?.url ?? null,
            isOnline: this.isUserOnline(customerUser?.lastSeenAt ?? null),
            lastSeenAt: customerUser?.lastSeenAt ?? null,
          },
          {
            userId: doc.providerUserId,
            role: 'provider' as const,
            name: providerUser?.name ?? null,
            displayName: providerUser?.name ?? null,
            avatarUrl: providerUser?.avatar?.url ?? null,
            isOnline: this.isUserOnline(providerUser?.lastSeenAt ?? null),
            lastSeenAt: providerUser?.lastSeenAt ?? null,
          },
        ],
        relatedEntity: {
          type: doc.relatedEntity?.type ?? (doc.contractId ? 'order' : doc.offerId ? 'offer' : 'request'),
          id: doc.relatedEntity?.id ?? doc.contractId ?? doc.offerId ?? doc.requestId,
          requestId: doc.relatedEntity?.requestId ?? doc.requestId,
          offerId: doc.relatedEntity?.offerId ?? doc.offerId ?? null,
          orderId: doc.relatedEntity?.orderId ?? doc.contractId ?? null,
          title: doc.relatedEntity?.title ?? request?.title ?? null,
          subtitle: doc.relatedEntity?.subtitle ?? request?.cityName ?? null,
          status: doc.relatedEntity?.status ?? contract?.status ?? offer?.status ?? request?.status ?? null,
          amount: doc.relatedEntity?.amount ?? contract?.priceAmount ?? offer?.pricing?.amount ?? request?.price ?? null,
          amountLabel:
            doc.relatedEntity?.amountLabel
            ?? this.formatAmountLabel(contract?.priceAmount ?? offer?.pricing?.amount ?? request?.price),
        },
        lastMessage: doc.lastMessage
          ? {
              messageId: doc.lastMessage.messageId,
              text: doc.lastMessage.text,
              createdAt: doc.lastMessage.createdAt,
              senderId: doc.lastMessage.senderId,
            }
          : null,
        counterpart: this.resolveCounterpartForViewer(
          viewerUserId ?? null,
          customerUser,
          providerUser,
          doc.clientId,
          doc.providerUserId,
        ),
        unreadCount,
        unread:
          viewerUserId && unreadCount[viewerUserId] != null
            ? unreadCount[viewerUserId]
            : unreadCount[doc.clientId] + unreadCount[doc.providerUserId],
        lastMessagePreview: doc.lastMessage?.text ?? doc.lastMessagePreview ?? null,
        state: doc.status,
        createdAt: (doc as any).createdAt,
        updatedAt: (doc as any).updatedAt,
      };
    });
  }
}
