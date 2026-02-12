import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  requestId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  clientId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c9' })
  providerUserId: string;

  @ApiProperty({ isArray: true, example: ['64f0c1a2b3c4d5e6f7a8b9c0', '64f0c1a2b3c4d5e6f7a8b9c9'] })
  participants: string[];

  @ApiPropertyOptional({ example: '2026-02-12T10:00:00.000Z', nullable: true })
  lastMessageAt: Date | null;

  @ApiProperty({ example: '2026-02-12T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-12T10:00:00.000Z' })
  updatedAt: Date;
}
