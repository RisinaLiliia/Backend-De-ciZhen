import { ApiProperty } from '@nestjs/swagger';

import type { WorkspaceStatisticsRange } from './workspace-statistics-query.dto';

export class WorkspaceStatisticsSummaryDto {
  @ApiProperty({ example: 412 })
  totalPublishedRequests: number;

  @ApiProperty({ example: 88 })
  totalActiveProviders: number;

  @ApiProperty({ example: 12 })
  totalActiveCities: number;

  @ApiProperty({ example: 4.7 })
  platformRatingAvg: number;

  @ApiProperty({ example: 128 })
  platformRatingCount: number;
}

export class WorkspaceStatisticsKpisDto {
  @ApiProperty({ example: 34 })
  requestsTotal: number;

  @ApiProperty({ example: 19 })
  offersTotal: number;

  @ApiProperty({ example: 7 })
  completedJobsTotal: number;

  @ApiProperty({ example: 56 })
  successRate: number;

  @ApiProperty({ example: 16, nullable: true })
  avgResponseMinutes: number | null;

  @ApiProperty({ example: 84, nullable: true })
  profileCompleteness: number | null;

  @ApiProperty({ example: 9, nullable: true })
  openRequests: number | null;

  @ApiProperty({ example: 5, nullable: true })
  recentOffers7d: number | null;
}

export class WorkspaceStatisticsActivityPointDto {
  @ApiProperty({ example: '2026-03-02T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 12 })
  requests: number;

  @ApiProperty({ example: 9 })
  offers: number;
}

export class WorkspaceStatisticsActivityTotalsDto {
  @ApiProperty({ example: 126 })
  requestsTotal: number;

  @ApiProperty({ example: 92 })
  offersTotal: number;

  @ApiProperty({ example: 8 })
  latestRequests: number;

  @ApiProperty({ example: 6 })
  latestOffers: number;

  @ApiProperty({ example: 4 })
  previousRequests: number;

  @ApiProperty({ example: 3 })
  previousOffers: number;

  @ApiProperty({ example: '2026-03-09T00:00:00.000Z', nullable: true })
  peakTimestamp: string | null;

  @ApiProperty({ example: '2026-03-09T00:00:00.000Z', nullable: true })
  bestWindowTimestamp: string | null;
}

export class WorkspaceStatisticsActivityMetricsDto {
  @ApiProperty({ example: 73 })
  offerRatePercent: number;

  @ApiProperty({ example: 42, nullable: true })
  responseMedianMinutes: number | null;

  @ApiProperty({ example: 18 })
  unansweredRequests24h: number;

  @ApiProperty({ example: 12 })
  cancellationRatePercent: number;

  @ApiProperty({ example: 11 })
  completedJobs: number;

  @ApiProperty({ example: 6840 })
  gmvAmount: number;

  @ApiProperty({ example: 684 })
  platformRevenueAmount: number;

  @ApiProperty({ example: 10 })
  takeRatePercent: number;
}

export class WorkspaceStatisticsActivityDto {
  @ApiProperty({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  range: WorkspaceStatisticsRange;

  @ApiProperty({ enum: ['hour', 'day'], example: 'day' })
  interval: 'hour' | 'day';

  @ApiProperty({ type: WorkspaceStatisticsActivityPointDto, isArray: true })
  points: WorkspaceStatisticsActivityPointDto[];

  @ApiProperty({ type: WorkspaceStatisticsActivityTotalsDto })
  totals: WorkspaceStatisticsActivityTotalsDto;

  @ApiProperty({ type: WorkspaceStatisticsActivityMetricsDto })
  metrics: WorkspaceStatisticsActivityMetricsDto;
}

export class WorkspaceStatisticsCategoryDemandDto {
  @ApiProperty({ example: 'cleaning', nullable: true })
  categoryKey: string | null;

  @ApiProperty({ example: 'Reinigung' })
  categoryName: string;

  @ApiProperty({ example: 18 })
  requestCount: number;

  @ApiProperty({
    example: 32,
    description:
      'Category demand share in percent, computed server-side from all published requests within selected range (24h|7d|30d|90d).',
  })
  sharePercent: number;
}

export class WorkspaceStatisticsCityDemandDto {
  @ApiProperty({ example: 'berlin' })
  citySlug: string;

  @ApiProperty({ example: 'Berlin' })
  cityName: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0', nullable: true })
  cityId: string | null;

  @ApiProperty({ example: 14 })
  requestCount: number;

  @ApiProperty({
    example: 22,
    description:
      'Provider-side demand activity: deduplicated searches for jobs in this city (target=request). Falls back to offer-based proxy if event data is missing.',
  })
  auftragSuchenCount: number;

  @ApiProperty({
    example: 9,
    description:
      'Client-side demand activity: deduplicated searches for providers in this city (target=provider). Falls back to distinct client-request proxy if event data is missing.',
  })
  anbieterSuchenCount: number;

  @ApiProperty({ example: 52.52, nullable: true })
  lat: number | null;

  @ApiProperty({ example: 13.405, nullable: true })
  lng: number | null;
}

export class WorkspaceStatisticsDemandDto {
  @ApiProperty({ type: WorkspaceStatisticsCategoryDemandDto, isArray: true })
  categories: WorkspaceStatisticsCategoryDemandDto[];

  @ApiProperty({ type: WorkspaceStatisticsCityDemandDto, isArray: true })
  cities: WorkspaceStatisticsCityDemandDto[];
}

export class WorkspaceStatisticsProfileFunnelDto {
  @ApiProperty({ example: 128 })
  stage1: number;

  @ApiProperty({ example: 34 })
  stage2: number;

  @ApiProperty({ example: 17 })
  stage3: number;

  @ApiProperty({ example: 5 })
  stage4: number;

  @ApiProperty({ example: 29 })
  conversionRate: number;
}

export class WorkspaceStatisticsInsightDto {
  @ApiProperty({ enum: ['info', 'trend', 'warning'], example: 'trend' })
  level: 'info' | 'trend' | 'warning';

  @ApiProperty({ example: 'high_category_demand' })
  code: string;

  @ApiProperty({ example: 'Reinigung', nullable: true })
  context: string | null;
}

export class WorkspaceStatisticsGrowthCardDto {
  @ApiProperty({ example: 'highlight_profile' })
  key: string;

  @ApiProperty({ example: '/workspace?section=profile' })
  href: string;
}

export class WorkspaceStatisticsOverviewResponseDto {
  @ApiProperty({ example: '2026-03-10T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ enum: ['platform', 'personalized'], example: 'platform' })
  mode: 'platform' | 'personalized';

  @ApiProperty({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  range: WorkspaceStatisticsRange;

  @ApiProperty({ type: WorkspaceStatisticsSummaryDto })
  summary: WorkspaceStatisticsSummaryDto;

  @ApiProperty({ type: WorkspaceStatisticsKpisDto })
  kpis: WorkspaceStatisticsKpisDto;

  @ApiProperty({ type: WorkspaceStatisticsActivityDto })
  activity: WorkspaceStatisticsActivityDto;

  @ApiProperty({ type: WorkspaceStatisticsDemandDto })
  demand: WorkspaceStatisticsDemandDto;

  @ApiProperty({ type: WorkspaceStatisticsProfileFunnelDto })
  profileFunnel: WorkspaceStatisticsProfileFunnelDto;

  @ApiProperty({ type: WorkspaceStatisticsInsightDto, isArray: true })
  insights: WorkspaceStatisticsInsightDto[];

  @ApiProperty({ type: WorkspaceStatisticsGrowthCardDto, isArray: true })
  growthCards: WorkspaceStatisticsGrowthCardDto[];
}
