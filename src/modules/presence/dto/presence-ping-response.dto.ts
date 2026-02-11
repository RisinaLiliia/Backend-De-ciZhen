import { ApiProperty } from '@nestjs/swagger';

export class PresencePingResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: '2026-02-11T10:00:00.000Z' })
  lastSeenAt: Date;
}
