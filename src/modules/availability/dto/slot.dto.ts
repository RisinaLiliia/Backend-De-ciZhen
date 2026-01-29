// src/modules/availability/dto/slot.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class SlotDto {
  @ApiProperty({ example: '2026-01-29T09:00:00.000Z' })
  startAt: string;

  @ApiProperty({ example: '2026-01-29T10:00:00.000Z' })
  endAt: string;
}
