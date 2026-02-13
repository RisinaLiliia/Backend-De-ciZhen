import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';

import { ChatsService } from './chats.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatThreadDto } from './dto/chat-thread.dto';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatInboxQueryDto } from './dto/chat-inbox-query.dto';
import { ChatMessagesQueryDto } from './dto/chat-messages-query.dto';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('chat')
@Controller('chat')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  private toThreadDto(t: any): ChatThreadDto {
    return {
      id: t._id.toString(),
      requestId: t.requestId,
      clientId: t.clientId,
      providerUserId: t.providerUserId,
      offerId: t.offerId ?? null,
      contractId: t.contractId ?? null,
      participants: t.participants ?? [],
      status: t.status ?? 'active',
      lastMessageAt: t.lastMessageAt ?? null,
      lastMessagePreview: t.lastMessagePreview ?? null,
      unreadClientCount: t.unreadClientCount ?? 0,
      unreadProviderCount: t.unreadProviderCount ?? 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private toMessageDto(m: any): ChatMessageDto {
    return {
      id: m._id.toString(),
      threadId: m.threadId,
      senderId: m.senderId,
      text: m.text,
      createdAt: m.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('threads')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create or get thread by requestId + providerUserId' })
  @ApiCreatedResponse({ type: ChatThreadDto })
  @ApiErrors({ conflict: false })
  async createThread(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateThreadDto,
  ): Promise<ChatThreadDto> {
    const thread = await this.chats.createOrGetThread({
      requestId: dto.requestId,
      providerUserId: dto.providerUserId,
      offerId: dto.offerId,
      contractId: dto.contractId,
      actorUserId: user.userId,
      actorRole: user.role as any,
    });
    return this.toThreadDto(thread);
  }

  @UseGuards(JwtAuthGuard)
  @Get('inbox')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my chat threads' })
  @ApiOkResponse({ type: ChatThreadDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async inbox(
    @CurrentUser() user: CurrentUserPayload,
    @Query() q: ChatInboxQueryDto,
  ): Promise<ChatThreadDto[]> {
    const role = q.role ?? 'all';
    const items = await this.chats.listInbox(user.userId, role);
    return items.map((t) => this.toThreadDto(t));
  }

  @UseGuards(JwtAuthGuard)
  @Get('threads/:id/messages')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List messages for a thread' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: ChatMessageDto, isArray: true })
  @ApiErrors({ conflict: false })
  async listMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') threadId: string,
    @Query() q: ChatMessagesQueryDto,
  ): Promise<ChatMessageDto[]> {
    const items = await this.chats.listMessages(threadId, user.userId, {
      limit: q.limit,
      offset: q.offset,
    });
    return items.map((m) => this.toMessageDto(m));
  }

  @UseGuards(JwtAuthGuard)
  @Post('threads/:id/messages')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send message to thread' })
  @ApiParam({ name: 'id', required: true })
  @ApiCreatedResponse({ type: ChatMessageDto })
  @ApiErrors({ conflict: false })
  async sendMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') threadId: string,
    @Body() dto: CreateMessageDto,
  ): Promise<ChatMessageDto> {
    const msg = await this.chats.sendMessage(threadId, user.userId, dto.text);
    return this.toMessageDto(msg);
  }

  @UseGuards(JwtAuthGuard)
  @Post('threads/:id/read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark thread as read for current user' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiErrors({ conflict: false })
  async markRead(@CurrentUser() user: CurrentUserPayload, @Param('id') threadId: string) {
    await this.chats.markRead(threadId, user.userId);
    return { ok: true };
  }
}
