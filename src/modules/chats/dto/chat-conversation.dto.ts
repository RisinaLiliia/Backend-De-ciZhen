import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatParticipantDto } from './chat-participant.dto';
import { ChatRelatedEntityDto } from './chat-related-entity.dto';

export class ChatConversationCounterpartDto {
  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c9' })
  userId: string;

  @ApiProperty({ enum: ['customer', 'provider'], example: 'provider' })
  role: 'customer' | 'provider';

  @ApiProperty({ example: 'Provider Chat' })
  displayName: string;

  @ApiPropertyOptional({ example: '/avatars/default.png', nullable: true })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  isOnline?: boolean | null;

  @ApiPropertyOptional({ example: '2026-03-31T17:00:00.000Z', nullable: true })
  lastSeenAt?: Date | null;
}

export class ChatConversationLastMessageDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  messageId: string;

  @ApiProperty({ example: 'Hello! I can start tomorrow.' })
  text: string;

  @ApiProperty({ example: '2026-03-31T17:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  senderId: string;
}

export class ChatConversationDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  id: string;

  @ApiProperty({ type: [ChatParticipantDto] })
  participants: ChatParticipantDto[];

  @ApiProperty({ type: ChatRelatedEntityDto })
  relatedEntity: ChatRelatedEntityDto;

  @ApiPropertyOptional({ type: ChatConversationLastMessageDto, nullable: true })
  lastMessage?: ChatConversationLastMessageDto | null;

  @ApiPropertyOptional({ type: ChatConversationCounterpartDto, nullable: true })
  counterpart?: ChatConversationCounterpartDto | null;

  @ApiProperty({
    example: {
      '64f0c1a2b3c4d5e6f7a8b9c0': 0,
      '64f0c1a2b3c4d5e6f7a8b9c9': 2,
    },
    additionalProperties: { type: 'number' },
  })
  unreadCount: Record<string, number>;

  @ApiProperty({ example: 2 })
  unread: number;

  @ApiPropertyOptional({ example: 'Hello! I can start tomorrow.', nullable: true })
  lastMessagePreview?: string | null;

  @ApiProperty({ enum: ['active', 'archived', 'closed'], example: 'active' })
  state: 'active' | 'archived' | 'closed';

  @ApiProperty({ example: '2026-03-31T17:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-31T17:05:00.000Z' })
  updatedAt: Date;
}

export class ChatConversationsResponseDto {
  @ApiProperty({ type: [ChatConversationDto] })
  items: ChatConversationDto[];

  @ApiPropertyOptional({ example: 'eyJ2YWx1ZSI6IjIwMjYtMDMtMzFUMTc6MDU6MDAuMDAwWiIsImlkIjoiNjZmMGMxYTIifQ', nullable: true })
  nextCursor?: string;
}
