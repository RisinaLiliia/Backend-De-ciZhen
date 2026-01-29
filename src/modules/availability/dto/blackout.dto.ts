// src/modules/availability/dto/blackout.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlackoutDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '2026-03-28T10:00:00.000Z' })
  startAt: string;

  @ApiProperty({ example: '2026-03-28T16:00:00.000Z' })
  endAt: string;

  @ApiPropertyOptional({ example: 'Vacation', nullable: true })
  reason: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;
}
