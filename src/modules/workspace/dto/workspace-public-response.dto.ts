import { ApiProperty } from '@nestjs/swagger';

import { RequestPublicDto } from '../../requests/dto/request-public.dto';
import type { PlatformActivityRange, PlatformActivityInterval } from '../../analytics/analytics.service';

export class WorkspacePublicCityActivityItemDto {
  @ApiProperty({ example: 'berlin' })
  citySlug: string;

  @ApiProperty({ example: 'Berlin' })
  cityName: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0', nullable: true })
  cityId: string | null;

  @ApiProperty({ example: 42 })
  requestCount: number;

  @ApiProperty({ example: 52.52, nullable: true })
  lat: number | null;

  @ApiProperty({ example: 13.405, nullable: true })
  lng: number | null;
}

export class WorkspacePublicCityActivityDto {
  @ApiProperty({ example: 8 })
  totalActiveCities: number;

  @ApiProperty({ example: 120 })
  totalActiveRequests: number;

  @ApiProperty({ type: WorkspacePublicCityActivityItemDto, isArray: true })
  items: WorkspacePublicCityActivityItemDto[];
}

export class WorkspacePublicActivityPointDto {
  @ApiProperty({ example: '2026-03-02T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 12 })
  requests: number;

  @ApiProperty({ example: 9 })
  offers: number;
}

export class WorkspacePublicActivityDto {
  @ApiProperty({ enum: ['24h', '7d', '30d'], example: '30d' })
  range: PlatformActivityRange;

  @ApiProperty({ enum: ['hour', 'day'], example: 'day' })
  interval: PlatformActivityInterval;

  @ApiProperty({ enum: ['real'], example: 'real' })
  source: 'real';

  @ApiProperty({ type: WorkspacePublicActivityPointDto, isArray: true })
  data: WorkspacePublicActivityPointDto[];

  @ApiProperty({ example: '2026-03-02T12:00:00.000Z' })
  updatedAt: string;
}

export class WorkspacePublicRequestsPageDto {
  @ApiProperty({ type: RequestPublicDto, isArray: true })
  items: RequestPublicDto[];

  @ApiProperty({ example: 245 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

export class WorkspacePublicSummaryDto {
  @ApiProperty({ example: 245 })
  totalPublishedRequests: number;

  @ApiProperty({ example: 67 })
  totalActiveProviders: number;
}

export class WorkspacePublicOverviewResponseDto {
  @ApiProperty({ example: '2026-03-02T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: WorkspacePublicSummaryDto })
  summary: WorkspacePublicSummaryDto;

  @ApiProperty({ type: WorkspacePublicActivityDto })
  activity: WorkspacePublicActivityDto;

  @ApiProperty({ type: WorkspacePublicCityActivityDto })
  cityActivity: WorkspacePublicCityActivityDto;

  @ApiProperty({ type: WorkspacePublicRequestsPageDto })
  requests: WorkspacePublicRequestsPageDto;
}
