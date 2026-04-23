import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteMyRequestResponseDto {
  @ApiProperty({ example: true })
  ok: true;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  deletedRequestId: string;

  @ApiProperty({ enum: ['deleted', 'cancelled'], example: 'cancelled' })
  result: 'deleted' | 'cancelled';

  @ApiProperty({ example: true })
  removedFromPublicFeed: boolean;

  @ApiProperty({ example: true })
  retainedForParticipants: boolean;

  @ApiPropertyOptional({ example: '2026-04-29T18:20:30.123Z', nullable: true })
  purgeAt?: Date | null;
}
