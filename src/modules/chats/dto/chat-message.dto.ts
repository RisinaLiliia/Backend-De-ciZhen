import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatAttachmentInputDto } from './create-message.dto';

export class ChatMessageDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  conversationId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  senderId: string;

  @ApiProperty({ enum: ['text', 'attachment', 'system'], example: 'text' })
  type: 'text' | 'attachment' | 'system';

  @ApiPropertyOptional({ example: 'Hello!' })
  text?: string | null;

  @ApiPropertyOptional({ type: [ChatAttachmentInputDto] })
  attachments?: ChatAttachmentInputDto[];

  @ApiProperty({ enum: ['sent', 'delivered', 'read'], example: 'read' })
  deliveryStatus: 'sent' | 'delivered' | 'read';

  @ApiProperty({ example: '2026-03-31T17:00:00.000Z' })
  createdAt: Date;
}

export class ChatMessagesResponseDto {
  @ApiProperty({ type: [ChatMessageDto] })
  items: ChatMessageDto[];

  @ApiPropertyOptional({ example: 'eyJ2YWx1ZSI6IjIwMjYtMDMtMzFUMTc6MDA6MDAuMDAwWiIsImlkIjoiNjZmMGMxYTIifQ', nullable: true })
  nextCursor?: string;
}
