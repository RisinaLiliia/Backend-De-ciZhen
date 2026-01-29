// src/modules/availability/dto/update-availability.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WeeklyDayDto } from './weekly-day.dto';

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({ example: 'Europe/Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;

  @ApiPropertyOptional({ example: 60, description: 'Slot duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  slotDurationMin?: number;

  @ApiPropertyOptional({ example: 0, description: 'Buffer between slots in minutes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  bufferMin?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: WeeklyDayDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyDayDto)
  weekly?: WeeklyDayDto[];
}
