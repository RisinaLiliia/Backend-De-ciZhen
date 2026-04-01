import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatParticipantDto {
  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  userId: string;

  @ApiProperty({ enum: ['customer', 'provider'], example: 'provider' })
  role: 'customer' | 'provider';

  @ApiPropertyOptional({ example: 'Provider Chat', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ example: 'Provider Chat', nullable: true })
  displayName?: string | null;

  @ApiPropertyOptional({ example: '/avatars/default.png', nullable: true })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: false, nullable: true })
  isOnline?: boolean | null;

  @ApiPropertyOptional({ example: '2026-03-31T17:00:00.000Z', nullable: true })
  lastSeenAt?: Date | null;
}
