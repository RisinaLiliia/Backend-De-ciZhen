// src/modules/availability/dto/weekly-day.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TimeRangeDto } from './time-range.dto';

export class WeeklyDayDto {
  @ApiProperty({ example: 1, description: '0=Sun ... 6=Sat' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ type: TimeRangeDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  ranges: TimeRangeDto[];
}
