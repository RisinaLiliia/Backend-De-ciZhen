import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatThreadDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  requestId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  clientId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c9' })
  providerUserId: string;

  @ApiPropertyOptional({ nullable: true })
  offerId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  contractId?: string | null;

  @ApiProperty({ example: ['64f0c1a2b3c4d5e6f7a8b9c0', '64f0c1a2b3c4d5e6f7a8b9c9'] })
  participants: string[];

  @ApiProperty({ enum: ['active', 'archived', 'blocked'], example: 'active' })
  status: 'active' | 'archived' | 'blocked';

  @ApiPropertyOptional({ example: '2026-02-12T10:00:00.000Z', nullable: true })
  lastMessageAt: Date | null;

  @ApiPropertyOptional({ example: 'Hi, can we reschedule?', nullable: true })
  lastMessagePreview: string | null;

  @ApiProperty({ example: 0 })
  unreadClientCount: number;

  @ApiProperty({ example: 0 })
  unreadProviderCount: number;

  @ApiProperty({ example: '2026-02-12T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-12T10:00:00.000Z' })
  updatedAt: Date;
}
