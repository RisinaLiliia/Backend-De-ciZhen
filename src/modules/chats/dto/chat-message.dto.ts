import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  threadId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  senderId: string;

  @ApiProperty({ example: 'Hello!' })
  text: string;

  @ApiProperty({ example: '2026-02-12T10:00:00.000Z' })
  createdAt: Date;
}
