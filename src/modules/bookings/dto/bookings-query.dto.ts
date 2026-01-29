// src/modules/bookings/dto/bookings-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

export class BookingsQueryDto {
  @ApiPropertyOptional({ enum: ['confirmed', 'cancelled', 'completed'] })
  @IsOptional()
  @IsString()
  @IsIn(['confirmed', 'cancelled', 'completed'])
  status?: 'confirmed' | 'cancelled' | 'completed';

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'ISO8601 UTC (inclusive). Filter by startAt >= from',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-02-01T00:00:00.000Z',
    description: 'ISO8601 UTC (exclusive). Filter by startAt < to',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 20, description: 'Page size (1..100). Default 20' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 0, description: 'Offset for pagination. Default 0' })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
