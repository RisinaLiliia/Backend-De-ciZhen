// src/modules/requests/dto/requests-my-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

export class RequestsMyQueryDto {
  @ApiPropertyOptional({
    enum: ['draft', 'published', 'paused', 'matched', 'closed', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'published', 'paused', 'matched', 'closed', 'cancelled'])
  status?: 'draft' | 'published' | 'paused' | 'matched' | 'closed' | 'cancelled';

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'ISO8601 UTC (inclusive). Filter by createdAt >= from',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-02-01T00:00:00.000Z',
    description: 'ISO8601 UTC (exclusive). Filter by createdAt < to',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 20, description: 'Page size (1..100). Default 20' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 0, description: 'Offset for pagination. Default 0' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
