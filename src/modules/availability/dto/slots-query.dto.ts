// src/modules/availability/dto/slots-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SlotsQueryDto {
  @ApiPropertyOptional({ example: '2026-01-29', description: 'YYYY-MM-DD (local date in tz)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2026-02-05', description: 'YYYY-MM-DD (local date in tz)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ example: 'Europe/Berlin', description: 'IANA time zone override for UI' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}
