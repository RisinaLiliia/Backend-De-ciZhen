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

  @ApiProperty({ enum: ['positive', 'neutral', 'warning'], example: 'positive' })
  offerRateTone: 'positive' | 'neutral' | 'warning';

  @ApiProperty({ enum: ['positive', 'neutral', 'warning'], example: 'warning' })
  responseMedianTone: 'positive' | 'neutral' | 'warning';

  @ApiProperty({ enum: ['positive', 'neutral', 'warning'], example: 'warning' })
  unansweredTone: 'positive' | 'neutral' | 'warning';

  @ApiProperty({ enum: ['positive', 'neutral', 'warning'], example: 'positive' })
  cancellationTone: 'positive' | 'neutral' | 'warning';

  @ApiProperty({ enum: ['positive', 'neutral', 'warning'], example: 'positive' })
  completedTone: 'positive' | 'neutral' | 'warning';

  @ApiProperty({ enum: ['positive', 'neutral', 'warning'], example: 'positive' })
  revenueTone: 'positive' | 'neutral' | 'warning';
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
    nullable: true,
  })
  auftragSuchenCount: number | null;

  @ApiProperty({
    example: 9,
    description:
      'Client-side demand activity: deduplicated searches for providers in this city (target=provider). Falls back to distinct client-request proxy if event data is missing.',
    nullable: true,
  })
  anbieterSuchenCount: number | null;

  @ApiProperty({
    example: 1.56,
    nullable: true,
    description:
      'Demand-to-supply market balance ratio (demand activity / provider activity) used for opportunity scoring.',
  })
  marketBalanceRatio: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low', 'none'], example: 'high' })
  signal: 'high' | 'medium' | 'low' | 'none';

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

export class WorkspaceStatisticsOpportunityMetricDto {
  @ApiProperty({ enum: ['demand', 'competition', 'growth', 'activity'], example: 'demand' })
  key: 'demand' | 'competition' | 'growth' | 'activity';

  @ApiProperty({ example: 8.6 })
  value: number;

  @ApiProperty({ enum: ['very-high', 'high', 'medium', 'low'], example: 'high' })
  semanticTone: 'very-high' | 'high' | 'medium' | 'low';

  @ApiProperty({ enum: ['very_high', 'high', 'noticeable', 'medium', 'low'], example: 'high' })
  semanticKey: 'very_high' | 'high' | 'noticeable' | 'medium' | 'low';
}

export class WorkspaceStatisticsOpportunityRadarItemDto {
  @ApiProperty({ enum: [1, 2, 3], example: 1 })
  rank: 1 | 2 | 3;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0', nullable: true })
  cityId: string | null;

  @ApiProperty({ example: 'Berlin' })
  city: string;

  @ApiProperty({ example: 'cleaning', nullable: true })
  categoryKey: string | null;

  @ApiProperty({ example: 'Cleaning & Housekeeping', nullable: true })
  category: string | null;

  @ApiProperty({ example: 127 })
  demand: number;

  @ApiProperty({ example: 23, nullable: true })
  providers: number | null;

  @ApiProperty({ example: 1.56, nullable: true })
  marketBalanceRatio: number | null;

  @ApiProperty({ example: 8.2 })
  score: number;

  @ApiProperty({ example: 9.1 })
  demandScore: number;

  @ApiProperty({ example: 6.4 })
  competitionScore: number;

  @ApiProperty({ example: 7.2 })
  growthScore: number;

  @ApiProperty({ example: 6.8 })
  activityScore: number;

  @ApiProperty({ enum: ['very_high', 'good', 'balanced', 'competitive', 'low'], example: 'balanced' })
  status: 'very_high' | 'good' | 'balanced' | 'competitive' | 'low';

  @ApiProperty({ enum: ['very-high', 'high', 'balanced', 'supply-heavy'], example: 'balanced' })
  tone: 'very-high' | 'high' | 'balanced' | 'supply-heavy';

  @ApiProperty({
    enum: ['very_high', 'good', 'balanced_competitive', 'balanced', 'competitive', 'low_demand', 'low'],
    example: 'balanced_competitive',
  })
  summaryKey: 'very_high' | 'good' | 'balanced_competitive' | 'balanced' | 'competitive' | 'low_demand' | 'low';

  @ApiProperty({ type: WorkspaceStatisticsOpportunityMetricDto, isArray: true })
  metrics: WorkspaceStatisticsOpportunityMetricDto[];
}

export class WorkspaceStatisticsPriceIntelligenceDto {
  @ApiProperty({ example: 'berlin', nullable: true })
  citySlug: string | null;

  @ApiProperty({ example: 'Berlin', nullable: true })
  city: string | null;

  @ApiProperty({ example: 'cleaning', nullable: true })
  categoryKey: string | null;

  @ApiProperty({ example: 'Cleaning & Housekeeping', nullable: true })
  category: string | null;

  @ApiProperty({ example: 65, nullable: true })
  recommendedMin: number | null;

  @ApiProperty({ example: 90, nullable: true })
  recommendedMax: number | null;

  @ApiProperty({ example: 78, nullable: true })
  marketAverage: number | null;

  @ApiProperty({ example: 86, nullable: true })
  optimalMin: number | null;

  @ApiProperty({ example: 101, nullable: true })
  optimalMax: number | null;

  @ApiProperty({
    example: 'Preise im Bereich von 86 € – 101 € erzielen aktuell die höchste Abschlussrate in Berlin.',
    nullable: true,
  })
  recommendation: string | null;

  @ApiProperty({ example: 7.2, nullable: true })
  profitPotentialScore: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low'], nullable: true, example: 'high' })
  profitPotentialStatus: 'high' | 'medium' | 'low' | null;
}

export class WorkspaceStatisticsProfileFunnelDto {
  @ApiProperty({ example: '30 Tage' })
  periodLabel: string;

  @ApiProperty({ example: 128, description: 'Legacy alias for requestsTotal.' })
  stage1: number;

  @ApiProperty({ example: 34, description: 'Legacy alias for offersTotal.' })
  stage2: number;

  @ApiProperty({ example: 17, description: 'Legacy alias for confirmedResponsesTotal.' })
  stage3: number;

  @ApiProperty({ example: 5, description: 'Legacy alias for closedContractsTotal.' })
  stage4: number;

  @ApiProperty({ example: 128 })
  requestsTotal: number;

  @ApiProperty({ example: 34 })
  offersTotal: number;

  @ApiProperty({ example: 17 })
  confirmedResponsesTotal: number;

  @ApiProperty({ example: 9 })
  closedContractsTotal: number;

  @ApiProperty({ example: 5 })
  completedJobsTotal: number;

  @ApiProperty({ example: 6840 })
  profitAmount: number;

  @ApiProperty({ example: 27, description: 'Offers / Requests in selected period.' })
  offerResponseRatePercent: number;

  @ApiProperty({ example: 50, description: 'Confirmed responses / Offers in selected period.' })
  confirmationRatePercent: number;

  @ApiProperty({ example: 53, description: 'Closed contracts / Confirmed responses in selected period.' })
  contractClosureRatePercent: number;

  @ApiProperty({ example: 56, description: 'Completed jobs / Closed contracts in selected period.' })
  completionRatePercent: number;

  @ApiProperty({ example: 29 })
  conversionRate: number;

  @ApiProperty({ example: 29 })
  totalConversionPercent: number;

  @ApiProperty({ example: 'Von 80 Anfragen wurden 10 erfolgreich abgeschlossen.' })
  summaryText: string;

  @ApiProperty({ type: () => WorkspaceStatisticsProfileFunnelStageDto, isArray: true })
  stages: WorkspaceStatisticsProfileFunnelStageDto[];
}

export class WorkspaceStatisticsProfileFunnelStageDto {
  @ApiProperty({
    enum: ['requests', 'offers', 'confirmations', 'contracts', 'completed', 'revenue'],
    example: 'requests',
  })
  id: 'requests' | 'offers' | 'confirmations' | 'contracts' | 'completed' | 'revenue';

  @ApiProperty({ example: 'Anfragen' })
  label: string;

  @ApiProperty({ example: 80 })
  value: number;

  @ApiProperty({ example: '80' })
  displayValue: string;

  @ApiProperty({ example: 100 })
  widthPercent: number;

  @ApiProperty({ example: 'Antwortquote', nullable: true })
  rateLabel: string | null;

  @ApiProperty({ example: 50, nullable: true })
  ratePercent: number | null;

  @ApiProperty({ example: '187,50 €', nullable: true })
  helperText: string | null;
}

export class WorkspaceStatisticsInsightMetricDto {
  @ApiProperty({ example: 'ratio' })
  key: string;

  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }], example: 3 })
  value: string | number;
}

export class WorkspaceStatisticsInsightActionDto {
  @ApiProperty({ example: 'Städte ansehen' })
  label: string;

  @ApiProperty({ enum: ['internal_link', 'modal', 'promotion', 'none'], example: 'internal_link' })
  actionType: 'internal_link' | 'modal' | 'promotion' | 'none';

  @ApiProperty({ example: '/workspace?section=stats&focus=cities', nullable: true })
  href?: string;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  payload?: Record<string, unknown>;
}

export class WorkspaceStatisticsInsightDto {
  @ApiProperty({ example: 'city_opportunity_high:city-opportunity:berlin' })
  id: string;

  @ApiProperty({ enum: ['demand', 'opportunity', 'performance', 'growth', 'risk', 'promotion'], example: 'opportunity' })
  type: 'demand' | 'opportunity' | 'performance' | 'growth' | 'risk' | 'promotion';

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  priority: 'high' | 'medium' | 'low';

  @ApiProperty({ enum: ['all', 'provider', 'client', 'guest'], example: 'provider' })
  audience: 'all' | 'provider' | 'client' | 'guest';

  @ApiProperty({ example: 88 })
  score: number;

  @ApiProperty({ example: 'Gute Chance in Karlsruhe' })
  title: string;

  @ApiProperty({
    example:
      'In Karlsruhe liegt die Nachfrage aktuell über dem Angebot. Neue Anbieter haben hier besonders gute Chancen.',
  })
  body: string;

  @ApiProperty({ example: 'Marktchance', nullable: true })
  shortLabel?: string;

  @ApiProperty({ example: 'spark' })
  icon: string;

  @ApiProperty({ example: 0.91, description: 'Signal confidence from 0 to 1.' })
  confidence: number;

  @ApiProperty({ type: () => WorkspaceStatisticsInsightMetricDto, isArray: true })
  metrics: WorkspaceStatisticsInsightMetricDto[];

  @ApiProperty({ type: () => WorkspaceStatisticsInsightActionDto, nullable: true })
  action?: WorkspaceStatisticsInsightActionDto;

  @ApiProperty({ example: '2026-03-11T10:30:00.000Z', nullable: true })
  validUntil?: string;

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

  @ApiProperty({ type: WorkspaceStatisticsOpportunityRadarItemDto, isArray: true })
  opportunityRadar: WorkspaceStatisticsOpportunityRadarItemDto[];

  @ApiProperty({ type: WorkspaceStatisticsPriceIntelligenceDto })
  priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto;

  @ApiProperty({ type: WorkspaceStatisticsProfileFunnelDto })
  profileFunnel: WorkspaceStatisticsProfileFunnelDto;

  @ApiProperty({ type: WorkspaceStatisticsInsightDto, isArray: true })
  insights: WorkspaceStatisticsInsightDto[];

  @ApiProperty({ type: WorkspaceStatisticsGrowthCardDto, isArray: true })
  growthCards: WorkspaceStatisticsGrowthCardDto[];
}
