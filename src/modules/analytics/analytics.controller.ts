import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AnalyticsService, PlatformActivityResponse, PlatformLiveFeedResponse } from './analytics.service';
import { ApiPublicErrors } from '../../common/swagger/api-errors.decorator';

class PlatformActivityQueryDto {
  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '7d' })
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  range?: '24h' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ enum: ['hour', 'day'], example: 'day' })
  @IsOptional()
  @IsIn(['hour', 'day'])
  interval?: 'hour' | 'day';
}

class PlatformLiveFeedQueryDto {
  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

class PlatformActivityPointDto {
  @ApiProperty({ example: '2026-03-02T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 12 })
  requests: number;

  @ApiProperty({ example: 9 })
  offers: number;
}

class PlatformActivityResponseDto {
  @ApiProperty({ enum: ['24h', '7d', '30d', '90d'], example: '7d' })
  range: '24h' | '7d' | '30d' | '90d';

  @ApiProperty({ enum: ['hour', 'day'], example: 'day' })
  interval: 'hour' | 'day';

  @ApiProperty({ enum: ['real'], example: 'real' })
  source: 'real';

  @ApiProperty({ type: PlatformActivityPointDto, isArray: true })
  data: PlatformActivityPointDto[];

  @ApiProperty({ example: '2026-03-02T12:00:00.000Z' })
  updatedAt: string;
}

class PlatformLiveFeedItemDto {
  @ApiProperty({ example: 'req-123' })
  id: string;

  @ApiProperty({ example: 'Neue Anfrage in Berlin' })
  text: string;

  @ApiProperty({ example: 5 })
  minutesAgo: number;
}

class PlatformLiveFeedResponseDto {
  @ApiProperty({ enum: ['real'], example: 'real' })
  source: 'real';

  @ApiProperty({ example: '2026-03-02T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: PlatformLiveFeedItemDto, isArray: true })
  data: PlatformLiveFeedItemDto[];
}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('platform-activity')
  @ApiOperation({ summary: 'Platform requests/offers timeline for home dashboard' })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: PlatformActivityResponseDto })
  @ApiPublicErrors()
  async platformActivity(@Query() q: PlatformActivityQueryDto): Promise<PlatformActivityResponse> {
    const range = q.range ?? '7d';
    return this.analytics.getPlatformActivity(range);
  }

  @Get('platform-live-feed')
  @ApiOperation({ summary: 'Recent platform activity feed for home dashboard' })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: PlatformLiveFeedResponseDto })
  @ApiPublicErrors()
  async platformLiveFeed(@Query() q: PlatformLiveFeedQueryDto): Promise<PlatformLiveFeedResponse> {
    return this.analytics.getPlatformLiveFeed(q.limit ?? 4);
  }
}
