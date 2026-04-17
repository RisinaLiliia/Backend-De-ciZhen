import { ApiProperty } from '@nestjs/swagger';

export class ArchiveMyRequestResponseDto {
  @ApiProperty({ example: true })
  ok: true;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  archivedRequestId: string;

  @ApiProperty({ example: '2026-04-17T10:20:30.123Z' })
  archivedAt: Date;
}
