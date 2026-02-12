import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('chats')
@Controller('chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  private toDto(c: any): ChatResponseDto {
    return {
      id: c._id.toString(),
      requestId: c.requestId,
      clientId: c.clientId,
      providerUserId: c.providerUserId,
      participants: c.participants ?? [],
      lastMessageAt: c.lastMessageAt ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create or get chat by requestId + clientId + providerUserId' })
  @ApiCreatedResponse({ type: ChatResponseDto })
  @ApiErrors({ conflict: false })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateChatDto,
  ): Promise<ChatResponseDto> {
    if (user.role === 'client' && user.userId !== dto.clientId) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === 'provider' && user.userId !== dto.providerUserId) {
      throw new ForbiddenException('Access denied');
    }

    const chat = await this.chats.createOrGet(dto);
    return this.toDto(chat);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my chats' })
  @ApiOkResponse({ type: ChatResponseDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async my(@CurrentUser() user: CurrentUserPayload): Promise<ChatResponseDto[]> {
    const items = await this.chats.getMyChats(user.userId);
    return items.map((c) => this.toDto(c));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get chat by id' })
  @ApiParam({ name: 'id', required: true, example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  @ApiOkResponse({ type: ChatResponseDto })
  @ApiErrors({ conflict: false })
  async getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ChatResponseDto> {
    const chat = await this.chats.getById(id);
    if (user.role !== 'admin' && !chat.participants?.includes(user.userId)) {
      throw new ForbiddenException('Access denied');
    }
    return this.toDto(chat);
  }
}
