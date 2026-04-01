import { ApiProperty } from '@nestjs/swagger';

export class ChatLegacyMessageDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  threadId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  senderId: string;

  @ApiProperty({ example: 'Hello!' })
  text: string;

  @ApiProperty({ example: '2026-03-31T17:00:00.000Z' })
  createdAt: Date;
}
