import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';

import { ChatsService } from './chats.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatThreadDto } from './dto/chat-thread.dto';
import { ChatLegacyMessageDto } from './dto/chat-legacy-message.dto';
import { ChatInboxQueryDto } from './dto/chat-inbox-query.dto';
import { ChatMessagesQueryDto } from './dto/chat-messages-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  ChatConversationDto,
  ChatConversationsResponseDto,
} from './dto/chat-conversation.dto';
import {
  ChatMessageDto,
  ChatMessagesResponseDto,
} from './dto/chat-message.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('chat')
@Controller('chat')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  private toLegacyThreadDto(thread: any): ChatThreadDto {
    const unreadCount = thread.unreadCount ?? {};

    return {
      id: String(thread._id),
      requestId: thread.requestId,
      clientId: thread.clientId,
      providerUserId: thread.providerUserId,
      offerId: thread.offerId ?? thread.relatedEntity?.offerId ?? null,
      contractId: thread.contractId ?? thread.relatedEntity?.orderId ?? null,
      participants: thread.participants ?? [thread.clientId, thread.providerUserId],
      status: thread.status === 'closed' ? 'blocked' : (thread.status ?? 'active'),
      lastMessageAt: thread.lastMessageAt ?? thread.lastMessage?.createdAt ?? null,
      lastMessagePreview: thread.lastMessagePreview ?? thread.lastMessage?.text ?? null,
      unreadClientCount: thread.unreadClientCount ?? unreadCount[thread.clientId] ?? 0,
      unreadProviderCount: thread.unreadProviderCount ?? unreadCount[thread.providerUserId] ?? 0,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  private toLegacyMessageDto(message: any): ChatLegacyMessageDto {
    return {
      id: String(message._id),
      threadId: message.threadId ?? message.conversationId,
      senderId: message.senderId,
      text: message.text ?? '',
      createdAt: message.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create or get a conversation with related request/offer/order context' })
  @ApiCreatedResponse({ type: ChatConversationDto })
  @ApiErrors({ conflict: false })
  async createConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateConversationDto,
  ): Promise<ChatConversationDto> {
    const conversation = await this.chats.createOrGetConversation({
      ...dto,
      actorUserId: user.userId,
      actorRole: user.role as 'client' | 'provider' | 'admin',
    });
    const [serialized] = await this.chats.serializeConversations([conversation], user.userId);
    return serialized;
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my chat conversations with filters, search, and cursor pagination' })
  @ApiOkResponse({ type: ChatConversationsResponseDto })
  @ApiErrors({ conflict: false, notFound: false })
  async listConversations(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: GetConversationsDto,
  ): Promise<ChatConversationsResponseDto> {
    const result = await this.chats.listConversations(user.userId, query);
    const items = await this.chats.serializeConversations(result.items, user.userId);
    return {
      items,
      nextCursor: result.nextCursor,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single conversation payload for thread header/info drawer' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: ChatConversationDto })
  @ApiErrors({ conflict: false })
  async getConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ChatConversationDto> {
    const conversation = await this.chats.getConversationById(id, user.userId);
    return this.chats.serializeConversation(conversation, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id/messages')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List conversation messages with cursor pagination' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: ChatMessagesResponseDto })
  @ApiErrors({ conflict: false })
  async listConversationMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query() query: GetMessagesDto,
  ): Promise<ChatMessagesResponseDto> {
    const result = await this.chats.listMessages(id, user.userId, query);
    return {
      items: result.items.map((message) => this.chats.serializeMessage(message)),
      nextCursor: result.nextCursor,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 25, ttl: 60_000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send a message to a conversation using the path param' })
  @ApiParam({ name: 'id', required: true })
  @ApiCreatedResponse({ type: ChatMessageDto })
  @ApiErrors({ conflict: false })
  async createConversationMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<ChatMessageDto> {
    const message = await this.chats.sendMessage(id, user.userId, dto);
    return this.chats.serializeMessage(message);
  }

  @UseGuards(JwtAuthGuard)
  @Post('messages')
  @Throttle({ default: { limit: 25, ttl: 60_000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send a message using conversationId in the request body' })
  @ApiCreatedResponse({ type: ChatMessageDto })
  @ApiErrors({ conflict: false })
  async createMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateMessageDto,
  ): Promise<ChatMessageDto> {
    if (!dto.conversationId) {
      throw new BadRequestException('conversationId is required');
    }
    const message = await this.chats.sendMessage(dto.conversationId, user.userId, dto);
    return this.chats.serializeMessage(message);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark a conversation as read for the current user' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiErrors({ conflict: false })
  async markConversationRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.chats.markRead(id, user.userId);
    return { ok: true };
  }

  // Legacy compatibility endpoints kept for the current frontend/backward compatibility.
  @UseGuards(JwtAuthGuard)
  @Post('threads')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: create or get thread by requestId + providerUserId' })
  @ApiCreatedResponse({ type: ChatThreadDto })
  @ApiErrors({ conflict: false })
  async createThread(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateThreadDto,
  ): Promise<ChatThreadDto> {
    const conversation = await this.chats.createOrGetConversation({
      relatedEntity: {
        type: dto.contractId ? 'order' : dto.offerId ? 'offer' : 'request',
        id: dto.contractId ?? dto.offerId ?? dto.requestId,
      },
      requestId: dto.requestId,
      providerUserId: dto.providerUserId,
      participantUserId: dto.providerUserId,
      participantRole: 'provider',
      offerId: dto.offerId,
      contractId: dto.contractId,
      orderId: dto.contractId,
      actorUserId: user.userId,
      actorRole: user.role as 'client' | 'provider' | 'admin',
    });
    return this.toLegacyThreadDto(conversation);
  }

  @UseGuards(JwtAuthGuard)
  @Get('inbox')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: list my chat threads' })
  @ApiOkResponse({ type: ChatThreadDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async inbox(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ChatInboxQueryDto,
  ): Promise<ChatThreadDto[]> {
    const role = query.role ?? 'all';
    const items = await this.chats.listInbox(user.userId, role);
    return items.map((thread) => this.toLegacyThreadDto(thread));
  }

  @UseGuards(JwtAuthGuard)
  @Get('threads/:id/messages')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: list messages for a thread' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: ChatLegacyMessageDto, isArray: true })
  @ApiErrors({ conflict: false })
  async listThreadMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query() query: ChatMessagesQueryDto,
  ): Promise<ChatLegacyMessageDto[]> {
    const result = await this.chats.listMessages(id, user.userId, {
      limit: query.limit,
      offset: query.offset,
    });
    return result.items.map((message) => this.toLegacyMessageDto(message));
  }

  @UseGuards(JwtAuthGuard)
  @Post('threads/:id/messages')
  @Throttle({ default: { limit: 25, ttl: 60_000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: send message to thread' })
  @ApiParam({ name: 'id', required: true })
  @ApiCreatedResponse({ type: ChatLegacyMessageDto })
  @ApiErrors({ conflict: false })
  async sendLegacyMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<ChatLegacyMessageDto> {
    const message = await this.chats.sendMessage(id, user.userId, dto);
    return this.toLegacyMessageDto(message);
  }

  @UseGuards(JwtAuthGuard)
  @Post('threads/:id/read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: mark thread as read for current user' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiErrors({ conflict: false })
  async markLegacyRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.chats.markRead(id, user.userId);
    return { ok: true };
  }
}
