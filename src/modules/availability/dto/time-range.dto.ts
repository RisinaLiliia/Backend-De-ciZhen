// src/modules/availability/dto/time-range.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class TimeRangeDto {
  @ApiProperty({ example: '09:00' })
  @Matches(/^\d{2}:\d{2}$/)
  start: string;

  @ApiProperty({ example: '13:00' })
  @Matches(/^\d{2}:\d{2}$/)
  end: string;
}
