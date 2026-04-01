import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { WorkspaceStatisticsRange, WorkspaceStatisticsViewerMode } from './workspace-statistics-query.dto';

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

export class WorkspaceStatisticsActivityComparisonPointDto {
  @ApiProperty({ example: '2026-03-02T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 3, nullable: true })
  clientActivity: number | null;

  @ApiProperty({ example: 2, nullable: true })
  providerActivity: number | null;
}

export class WorkspaceStatisticsActivityComparisonDto {
  @ApiPropertyOptional({ example: 'Aktivitätsvergleich', nullable: true })
  title?: string | null;

  @ApiPropertyOptional({ example: 'Deine Aktivität als Auftraggeber und Anbieter im selben Zeitfenster.', nullable: true })
  subtitle?: string | null;

  @ApiPropertyOptional({ example: 'Deine stärkste Aktivität liegt aktuell außerhalb des Marktpeaks.', nullable: true })
  summary?: string | null;

  @ApiPropertyOptional({ example: '2026-03-09T00:00:00.000Z', nullable: true })
  peakTimestamp?: string | null;

  @ApiPropertyOptional({ example: '2026-03-09T00:00:00.000Z', nullable: true })
  bestWindowTimestamp?: string | null;

  @ApiPropertyOptional({ example: '2026-03-26T19:19:00.000Z', nullable: true })
  updatedAt?: string | null;

  @ApiProperty({ example: true })
  hasReliableSeries: boolean;

  @ApiProperty({ type: WorkspaceStatisticsActivityComparisonPointDto, isArray: true })
  points: WorkspaceStatisticsActivityComparisonPointDto[];
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

export class WorkspaceStatisticsFilterOptionDto {
  @ApiProperty({ example: 'berlin' })
  value: string;

  @ApiProperty({ example: 'Berlin' })
  label: string;

  @ApiPropertyOptional({ example: false })
  disabled?: boolean;
}

export class WorkspaceStatisticsSelectedFilterDto {
  @ApiProperty({ example: 'berlin', nullable: true })
  value: string | null;

  @ApiProperty({ example: 'Berlin' })
  label: string;
}

export class WorkspaceStatisticsContextHealthDto {
  @ApiProperty({ enum: ['demand', 'competition', 'activity'], example: 'demand' })
  key: 'demand' | 'competition' | 'activity';

  @ApiProperty({ enum: ['rising', 'stable', 'limited', 'high', 'balanced', 'low'], example: 'stable' })
  value: 'rising' | 'stable' | 'limited' | 'high' | 'balanced' | 'low';

  @ApiProperty({ enum: ['positive', 'neutral', 'warning'], example: 'neutral' })
  tone: 'positive' | 'neutral' | 'warning';
}

export class WorkspaceStatisticsLowDataDto {
  @ApiProperty({ example: false })
  isLowData: boolean;

  @ApiPropertyOptional({ example: 'Zu wenig Daten für eine verlässliche Segmentanalyse', nullable: true })
  title?: string | null;

  @ApiPropertyOptional({
    example: 'Erweitern Sie den Zeitraum oder wechseln Sie zu Alle Städte bzw. Alle Kategorien.',
    nullable: true,
  })
  body?: string | null;
}

export class WorkspaceStatisticsDecisionContextDto {
  @ApiProperty({ enum: ['global', 'focus'], example: 'focus' })
  mode: 'global' | 'focus';

  @ApiProperty({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  period: WorkspaceStatisticsRange;

  @ApiProperty({ type: WorkspaceStatisticsSelectedFilterDto })
  city: WorkspaceStatisticsSelectedFilterDto;

  @ApiPropertyOptional({ type: WorkspaceStatisticsSelectedFilterDto, nullable: true })
  region?: WorkspaceStatisticsSelectedFilterDto | null;

  @ApiProperty({ type: WorkspaceStatisticsSelectedFilterDto })
  category: WorkspaceStatisticsSelectedFilterDto;

  @ApiPropertyOptional({ type: WorkspaceStatisticsSelectedFilterDto, nullable: true })
  service?: WorkspaceStatisticsSelectedFilterDto | null;

  @ApiPropertyOptional({ example: 'Berlin · Cleaning', nullable: true })
  scopeLabel?: string | null;

  @ApiPropertyOptional({ example: 'Globaler Markt', nullable: true })
  title?: string | null;

  @ApiPropertyOptional({
    example: 'Ein gemeinsamer Marktfilter steuert KPI, Chancen, Preise und Empfehlungen.',
    nullable: true,
  })
  subtitle?: string | null;

  @ApiPropertyOptional({ example: '30 Tage · Berlin · Cleaning', nullable: true })
  stickyLabel?: string | null;

  @ApiProperty({ type: WorkspaceStatisticsContextHealthDto, isArray: true })
  health: WorkspaceStatisticsContextHealthDto[];

  @ApiPropertyOptional({ type: WorkspaceStatisticsLowDataDto })
  lowData?: WorkspaceStatisticsLowDataDto;
}

export class WorkspaceStatisticsFilterOptionsDto {
  @ApiProperty({ type: WorkspaceStatisticsFilterOptionDto, isArray: true })
  cities: WorkspaceStatisticsFilterOptionDto[];

  @ApiProperty({ type: WorkspaceStatisticsFilterOptionDto, isArray: true })
  categories: WorkspaceStatisticsFilterOptionDto[];

  @ApiProperty({ type: WorkspaceStatisticsFilterOptionDto, isArray: true })
  services: WorkspaceStatisticsFilterOptionDto[];
}

export class WorkspaceStatisticsSectionMetaDto {
  @ApiPropertyOptional({ example: 'Operative Kennzahlen für Markt- und Wachstumsentscheidungen.', nullable: true })
  decisionSubtitle?: string | null;

  @ApiPropertyOptional({ example: 'Wo aktuell die meiste Nachfrage entsteht.', nullable: true })
  demandSubtitle?: string | null;

  @ApiPropertyOptional({ example: 'Regionen mit aktuellem Nachfrage- und Wettbewerbssignal.', nullable: true })
  citiesSubtitle?: string | null;

  @ApiPropertyOptional({ example: 'Opportunity Radar für Berlin', nullable: true })
  opportunityTitle?: string | null;

  @ApiPropertyOptional({ example: 'Preis-Intelligenz für Cleaning in Berlin', nullable: true })
  priceTitle?: string | null;

  @ApiPropertyOptional({ example: 'Empfehlungen basierend auf dem aktuellen Kontext · Berlin · Cleaning', nullable: true })
  insightsSubtitle?: string | null;

  @ApiPropertyOptional({ example: 'Wachstum & Promotion · Berlin · Cleaning', nullable: true })
  growthSubtitle?: string | null;
}

export class WorkspaceStatisticsExportMetaDto {
  @ApiPropertyOptional({ example: 'workspace-statistics-30d-berlin-cleaning-2026-03-15.csv', nullable: true })
  filename?: string | null;
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

  @ApiPropertyOptional({
    example: 18,
    nullable: true,
    description: 'Distinct providers with activity in the selected city scope during the selected period.',
  })
  providersActive?: number | null;

  @ApiPropertyOptional({
    example: 7.8,
    nullable: true,
    description: 'Canonical city opportunity score used for ranking and competitor selection.',
  })
  score?: number | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description: 'Rank of the city inside the backend-selected statistics city scope.',
  })
  rank?: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low', 'none'], example: 'high' })
  signal: 'high' | 'medium' | 'low' | 'none';

  @ApiProperty({ example: 52.52, nullable: true })
  lat: number | null;

  @ApiProperty({ example: 13.405, nullable: true })
  lng: number | null;

  @ApiPropertyOptional({ type: () => WorkspaceStatisticsOpportunityPeerContextDto, nullable: true })
  peerContext?: WorkspaceStatisticsOpportunityPeerContextDto | null;
}

export class WorkspaceStatisticsCityListDto {
  @ApiProperty({ type: WorkspaceStatisticsCityDemandDto, isArray: true })
  items: WorkspaceStatisticsCityDemandDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 27 })
  totalItems: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class WorkspaceStatisticsDemandDto {
  @ApiProperty({ type: WorkspaceStatisticsCategoryDemandDto, isArray: true })
  categories: WorkspaceStatisticsCategoryDemandDto[];

  @ApiProperty({ type: WorkspaceStatisticsCityDemandDto, isArray: true })
  cities: WorkspaceStatisticsCityDemandDto[];

  @ApiPropertyOptional({ type: WorkspaceStatisticsCityListDto })
  cityList?: WorkspaceStatisticsCityListDto;
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

export class WorkspaceStatisticsOpportunityPeerContextDto {
  @ApiProperty({ enum: ['focus', 'competitor'], example: 'focus' })
  role: 'focus' | 'competitor';

  @ApiProperty({ example: 13.4, nullable: true })
  distanceKm: number | null;

  @ApiProperty({ enum: ['selected_city', 'nearby_competitor', 'top_ranked'], example: 'selected_city' })
  reason: 'selected_city' | 'nearby_competitor' | 'top_ranked';
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

  @ApiPropertyOptional({ type: () => WorkspaceStatisticsOpportunityPeerContextDto, nullable: true })
  peerContext?: WorkspaceStatisticsOpportunityPeerContextDto | null;

  @ApiPropertyOptional({ type: () => WorkspaceStatisticsPriceIntelligenceDto, nullable: true })
  priceIntelligence?: WorkspaceStatisticsPriceIntelligenceDto | null;
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

  @ApiProperty({ example: 95, nullable: true })
  smartRecommendedPrice: number | null;

  @ApiProperty({ enum: ['visibility', 'balanced', 'premium'], nullable: true, example: 'balanced' })
  smartSignalTone: 'visibility' | 'balanced' | 'premium' | null;

  @ApiProperty({ example: 126, nullable: true })
  analyzedRequestsCount: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low'], nullable: true, example: 'high' })
  confidenceLevel: 'high' | 'medium' | 'low' | null;

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

export class WorkspaceStatisticsRecommendationItemDto {
  @ApiProperty({ example: 'high_unanswered_requests' })
  code: string;

  @ApiProperty({ enum: ['risk', 'opportunity', 'performance', 'growth', 'promotion', 'demand'], example: 'risk' })
  type: 'risk' | 'opportunity' | 'performance' | 'growth' | 'promotion' | 'demand';

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  priority: 'high' | 'medium' | 'low';

  @ApiProperty({ example: 'Viele offene Anfragen' })
  title: string;

  @ApiProperty({ example: 'Mehrere Anfragen bleiben länger als 24 Stunden unbeantwortet.' })
  description: string;

  @ApiProperty({ example: 0.86 })
  confidence: number;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  reliability: 'high' | 'medium' | 'low';

  @ApiProperty({ example: '56', nullable: true })
  context: string | null;

  @ApiProperty({ example: 'follow_up_unanswered', nullable: true })
  actionCode: string | null;

  @ApiProperty({ type: () => WorkspaceStatisticsActionLinkDto, nullable: true })
  action: WorkspaceStatisticsActionLinkDto | null;
}

export class WorkspaceStatisticsRecommendationSectionDto {
  @ApiProperty({ example: 'Risiken', nullable: true })
  title: string | null;

  @ApiProperty({ example: 'Was aktuell deinen Fortschritt ausbremst.', nullable: true })
  subtitle: string | null;

  @ApiProperty({ example: true })
  hasReliableItems: boolean;

  @ApiProperty({ type: () => WorkspaceStatisticsRecommendationItemDto, isArray: true })
  items: WorkspaceStatisticsRecommendationItemDto[];
}

export class WorkspaceStatisticsGrowthCardDto {
  @ApiProperty({ example: 'highlight_profile' })
  key: string;

  @ApiProperty({ example: '/workspace?section=profile' })
  href: string;
}

export class WorkspaceStatisticsActionLinkDto {
  @ApiProperty({ example: 'follow_up_requests' })
  code: string;

  @ApiProperty({ example: 'Offene Anfragen priorisieren' })
  label: string;

  @ApiProperty({ example: '/workspace?tab=my-requests', nullable: true })
  target: string | null;
}

export class WorkspaceStatisticsDecisionLayerMetricDto {
  @ApiProperty({ enum: ['offer_rate', 'avg_response_time', 'unanswered_over_24h', 'completed_jobs', 'revenue', 'average_order_value'], example: 'offer_rate' })
  id: 'offer_rate' | 'avg_response_time' | 'unanswered_over_24h' | 'completed_jobs' | 'revenue' | 'average_order_value';

  @ApiProperty({ example: 'Angebotsquote' })
  label: string;

  @ApiProperty({ example: 68, nullable: true })
  marketValue: number | null;

  @ApiProperty({ example: 100, nullable: true })
  userValue: number | null;

  @ApiProperty({ example: 32, nullable: true })
  gapAbsolute: number | null;

  @ApiProperty({ example: 47.06, nullable: true })
  gapPercent: number | null;

  @ApiProperty({ enum: ['percent', 'minutes', 'currency', 'count'], example: 'percent' })
  unit: 'percent' | 'minutes' | 'currency' | 'count';

  @ApiProperty({ enum: ['better', 'worse', 'neutral'], example: 'better' })
  direction: 'better' | 'worse' | 'neutral';

  @ApiProperty({ enum: ['good', 'warning', 'critical', 'neutral'], example: 'good' })
  status: 'good' | 'warning' | 'critical' | 'neutral';

  @ApiProperty({ example: ['slow_response'], type: String, isArray: true })
  signalCodes: string[];

  @ApiProperty({ example: 'respond_faster', nullable: true })
  primaryActionCode: string | null;

  @ApiProperty({ example: 'Du reagierst schneller als der Markt.', nullable: true })
  summary: string | null;
}

export class WorkspaceStatisticsDecisionLayerDto {
  @ApiProperty({ example: 'Decision Layer', nullable: true })
  title: string | null;

  @ApiProperty({ example: 'User vs Market im aktuellen Kontext', nullable: true })
  subtitle: string | null;

  @ApiProperty({ type: WorkspaceStatisticsDecisionLayerMetricDto, isArray: true })
  metrics: WorkspaceStatisticsDecisionLayerMetricDto[];

  @ApiProperty({ example: 'Zu viele Anfragen bleiben länger als 24 Stunden offen.', nullable: true })
  primaryInsight: string | null;

  @ApiProperty({ type: WorkspaceStatisticsActionLinkDto, nullable: true })
  primaryAction: WorkspaceStatisticsActionLinkDto | null;
}

export class WorkspaceStatisticsPersonalizedPricingDto {
  @ApiProperty({ example: 'Preisstrategie', nullable: true })
  title: string | null;

  @ApiProperty({ example: 'Wie dein Preis im aktuellen Markt einzuordnen ist.', nullable: true })
  subtitle: string | null;

  @ApiProperty({ example: 'Berlin · Cleaning', nullable: true })
  contextLabel: string | null;

  @ApiProperty({ example: 220, nullable: true })
  marketAverage: number | null;

  @ApiProperty({ example: 190, nullable: true })
  recommendedMin: number | null;

  @ApiProperty({ example: 260, nullable: true })
  recommendedMax: number | null;

  @ApiProperty({ example: 240, nullable: true })
  userPrice: number | null;

  @ApiProperty({ example: 20, nullable: true })
  gapAbsolute: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low', 'unavailable'], example: 'medium' })
  comparisonReliability: 'high' | 'medium' | 'low' | 'unavailable';

  @ApiProperty({ enum: ['below', 'within', 'above', 'unknown'], example: 'within' })
  position: 'below' | 'within' | 'above' | 'unknown';

  @ApiProperty({ enum: ['positive', 'neutral', 'warning'], example: 'positive' })
  effect: 'positive' | 'neutral' | 'warning';

  @ApiProperty({ example: 'adjust_price', nullable: true })
  actionCode: string | null;

  @ApiProperty({ example: 'Dein Preis liegt im empfohlenen Bereich.', nullable: true })
  summary: string | null;
}

export class WorkspaceStatisticsCategoryFitItemDto {
  @ApiProperty({ example: 'cleaning', nullable: true })
  categoryKey: string | null;

  @ApiProperty({ example: 'Cleaning' })
  label: string;

  @ApiProperty({ example: 32, nullable: true })
  marketDemandShare: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low', 'unknown'], example: 'medium' })
  reliability: 'high' | 'medium' | 'low' | 'unknown';

  @ApiProperty({ enum: ['high', 'medium', 'low', 'unknown'], example: 'medium' })
  userFit: 'high' | 'medium' | 'low' | 'unknown';

  @ApiProperty({ enum: ['high', 'medium', 'low', 'unknown'], example: 'high' })
  opportunity: 'high' | 'medium' | 'low' | 'unknown';

  @ApiProperty({ example: 'focus_market', nullable: true })
  actionCode: string | null;

  @ApiProperty({ example: 'Starke Nachfrage bei noch ausbaufähiger Präsenz.', nullable: true })
  summary: string | null;
}

export class WorkspaceStatisticsCategoryFitDto {
  @ApiProperty({ example: 'Kategorien-Fit', nullable: true })
  title: string | null;

  @ApiProperty({ example: 'Wie gut deine Präsenz zur aktuellen Nachfrage passt.', nullable: true })
  subtitle: string | null;

  @ApiProperty({ example: true })
  hasReliableItems: boolean;

  @ApiProperty({ type: WorkspaceStatisticsCategoryFitItemDto, isArray: true })
  items: WorkspaceStatisticsCategoryFitItemDto[];
}

export class WorkspaceStatisticsCityComparisonItemDto {
  @ApiProperty({ example: 'berlin-city', nullable: true })
  cityId: string | null;

  @ApiProperty({ example: 'Berlin' })
  city: string;

  @ApiProperty({ example: 48, nullable: true })
  marketRequests: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low', 'unknown'], example: 'medium' })
  reliability: 'high' | 'medium' | 'low' | 'unknown';

  @ApiProperty({ enum: ['high', 'medium', 'low', 'unknown'], example: 'medium' })
  userActivity: 'high' | 'medium' | 'low' | 'unknown';

  @ApiProperty({ example: 42, nullable: true })
  userConversion: number | null;

  @ApiProperty({ example: 'focus_market', nullable: true })
  actionCode: string | null;

  @ApiProperty({ example: 'Berlin bietet Marktvolumen, deine Präsenz ist hier aber noch ausbaufähig.', nullable: true })
  recommendation: string | null;
}

export class WorkspaceStatisticsCityComparisonDto {
  @ApiProperty({ example: 'Städtevergleich', nullable: true })
  title: string | null;

  @ApiProperty({ example: 'Marktvolumen vs. deine Aktivität in relevanten Städten.', nullable: true })
  subtitle: string | null;

  @ApiProperty({ example: true })
  hasReliableItems: boolean;

  @ApiProperty({ type: WorkspaceStatisticsCityComparisonItemDto, isArray: true })
  items: WorkspaceStatisticsCityComparisonItemDto[];
}

export class WorkspaceStatisticsFunnelComparisonStageDto {
  @ApiProperty({ example: 'offers' })
  key: string;

  @ApiProperty({ example: 'Angebote' })
  label: string;

  @ApiProperty({ example: 74, nullable: true })
  marketCount: number | null;

  @ApiProperty({ example: 8, nullable: true })
  userCount: number | null;

  @ApiProperty({ example: 68, nullable: true })
  marketRateFromPrev: number | null;

  @ApiProperty({ example: 100, nullable: true })
  userRateFromPrev: number | null;

  @ApiProperty({ example: 32, nullable: true, description: 'Difference in percentage points: user - market.' })
  gapRate: number | null;

  @ApiProperty({ enum: ['good', 'warning', 'critical', 'neutral'], example: 'warning' })
  status: 'good' | 'warning' | 'critical' | 'neutral';

  @ApiProperty({ example: ['high_offer_dropoff'], type: String, isArray: true })
  signalCodes: string[];

  @ApiProperty({
    example: 'Du verlierst hier deutlich mehr als der Markt.',
    nullable: true,
  })
  summary: string | null;
}

export class WorkspaceStatisticsFunnelLargestDropOffDto {
  @ApiProperty({ example: 'responses' })
  key: string;

  @ApiProperty({ example: 'Rückmeldungen' })
  label: string;

  @ApiProperty({ example: 0, nullable: true })
  userRateFromPrev: number | null;

  @ApiProperty({ example: 70, nullable: true })
  marketRateFromPrev: number | null;

  @ApiProperty({ example: -70, nullable: true })
  gapRate: number | null;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'], example: 'critical' })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ example: 'Zwischen Angebot und Rückmeldung verlierst du aktuell deutlich mehr als der Markt.' })
  summary: string;

  @ApiProperty({ example: 'follow_up_requests', nullable: true })
  actionCode: string | null;
}

export class WorkspaceStatisticsFunnelBottleneckDto {
  @ApiProperty({ example: 'responses' })
  key: string;

  @ApiProperty({ example: 'Rückmeldungen bleiben aus' })
  title: string;

  @ApiProperty({ example: 'Deine Angebote erhalten im aktuellen Kontext deutlich seltener eine Rückmeldung als der Markt.' })
  description: string;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'], example: 'high' })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ example: 'follow_up_requests', nullable: true })
  actionCode: string | null;
}

export class WorkspaceStatisticsFunnelConversionSummaryDto {
  @ApiProperty({ example: 18, nullable: true })
  userConversion: number | null;

  @ApiProperty({ example: 26, nullable: true })
  marketConversion: number | null;

  @ApiProperty({ example: -8, nullable: true })
  gapConversion: number | null;

  @ApiProperty({ enum: ['good', 'warning', 'critical', 'neutral'], example: 'warning' })
  status: 'good' | 'warning' | 'critical' | 'neutral';
}

export class WorkspaceStatisticsFunnelComparisonDto {
  @ApiProperty({ example: 'Profil Performance' })
  title: string;

  @ApiProperty({ example: 'Wie dein Profil aktuell performt.', nullable: true })
  subtitle: string | null;

  @ApiProperty({ type: WorkspaceStatisticsFunnelComparisonStageDto, isArray: true })
  stages: WorkspaceStatisticsFunnelComparisonStageDto[];

  @ApiProperty({ type: WorkspaceStatisticsFunnelLargestDropOffDto, nullable: true })
  largestDropOffStage: WorkspaceStatisticsFunnelLargestDropOffDto | null;

  @ApiProperty({ type: WorkspaceStatisticsFunnelBottleneckDto, nullable: true })
  bottleneck: WorkspaceStatisticsFunnelBottleneckDto | null;

  @ApiProperty({ type: WorkspaceStatisticsFunnelConversionSummaryDto, nullable: true })
  conversionSummary: WorkspaceStatisticsFunnelConversionSummaryDto | null;

  @ApiProperty({ type: WorkspaceStatisticsActionLinkDto, nullable: true })
  primaryAction: WorkspaceStatisticsActionLinkDto | null;

  @ApiProperty({ example: 'Du verlierst aktuell am meisten zwischen Angebot und Rückmeldung.', nullable: true })
  summary: string | null;

  @ApiProperty({ example: 'Rückmeldungen bleiben aus', nullable: true })
  primaryBottleneck: string | null;

  @ApiProperty({ example: 'Offene Anfragen priorisieren und schneller nachfassen.', nullable: true })
  nextAction: string | null;

  @ApiProperty({ example: 'responses', nullable: true })
  largestGapStage: string | null;
}

export class WorkspaceStatisticsOverviewResponseDto {
  @ApiProperty({ type: WorkspaceStatisticsDecisionContextDto })
  decisionContext: WorkspaceStatisticsDecisionContextDto;

  @ApiProperty({ type: WorkspaceStatisticsFilterOptionsDto })
  filterOptions: WorkspaceStatisticsFilterOptionsDto;

  @ApiProperty({ type: WorkspaceStatisticsSectionMetaDto })
  sectionMeta: WorkspaceStatisticsSectionMetaDto;

  @ApiProperty({ type: WorkspaceStatisticsExportMetaDto })
  exportMeta: WorkspaceStatisticsExportMetaDto;

  @ApiProperty({ example: '2026-03-10T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ enum: ['platform', 'personalized'], example: 'platform' })
  mode: 'platform' | 'personalized';

  @ApiProperty({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  range: WorkspaceStatisticsRange;

  @ApiProperty({ enum: ['provider', 'customer'], example: 'provider', nullable: true })
  viewerMode: WorkspaceStatisticsViewerMode | null;

  @ApiProperty({
    example:
      'Die Angebotsquote liegt aktuell bei 68 %, während 56 Anfragen länger als 24 Stunden unbeantwortet bleiben. Schnellere Reaktionen könnten die Abschlussrate weiter erhöhen.',
  })
  decisionInsight: string;

  @ApiPropertyOptional({ type: WorkspaceStatisticsDecisionLayerDto, nullable: true })
  decisionLayer?: WorkspaceStatisticsDecisionLayerDto | null;

  @ApiPropertyOptional({ type: WorkspaceStatisticsPersonalizedPricingDto, nullable: true })
  personalizedPricing?: WorkspaceStatisticsPersonalizedPricingDto | null;

  @ApiPropertyOptional({ type: WorkspaceStatisticsCategoryFitDto, nullable: true })
  categoryFit?: WorkspaceStatisticsCategoryFitDto | null;

  @ApiPropertyOptional({ type: WorkspaceStatisticsCityComparisonDto, nullable: true })
  cityComparison?: WorkspaceStatisticsCityComparisonDto | null;

  @ApiPropertyOptional({ type: WorkspaceStatisticsRecommendationSectionDto, nullable: true })
  risks?: WorkspaceStatisticsRecommendationSectionDto | null;

  @ApiPropertyOptional({ type: WorkspaceStatisticsRecommendationSectionDto, nullable: true })
  opportunities?: WorkspaceStatisticsRecommendationSectionDto | null;

  @ApiPropertyOptional({ type: WorkspaceStatisticsRecommendationSectionDto, nullable: true })
  nextSteps?: WorkspaceStatisticsRecommendationSectionDto | null;

  @ApiProperty({ type: WorkspaceStatisticsSummaryDto })
  summary: WorkspaceStatisticsSummaryDto;

  @ApiProperty({ type: WorkspaceStatisticsKpisDto })
  kpis: WorkspaceStatisticsKpisDto;

  @ApiProperty({ type: WorkspaceStatisticsActivityDto })
  activity: WorkspaceStatisticsActivityDto;

  @ApiPropertyOptional({ type: WorkspaceStatisticsActivityComparisonDto, nullable: true })
  activityComparison?: WorkspaceStatisticsActivityComparisonDto | null;

  @ApiProperty({ type: WorkspaceStatisticsDemandDto })
  demand: WorkspaceStatisticsDemandDto;

  @ApiProperty({ type: WorkspaceStatisticsOpportunityRadarItemDto, isArray: true })
  opportunityRadar: WorkspaceStatisticsOpportunityRadarItemDto[];

  @ApiProperty({ type: WorkspaceStatisticsPriceIntelligenceDto })
  priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto;

  @ApiProperty({ type: WorkspaceStatisticsProfileFunnelDto })
  profileFunnel: WorkspaceStatisticsProfileFunnelDto;

  @ApiPropertyOptional({ type: WorkspaceStatisticsFunnelComparisonDto, nullable: true })
  funnelComparison?: WorkspaceStatisticsFunnelComparisonDto | null;

  @ApiProperty({ type: WorkspaceStatisticsInsightDto, isArray: true })
  insights: WorkspaceStatisticsInsightDto[];

  @ApiProperty({ type: WorkspaceStatisticsGrowthCardDto, isArray: true })
  growthCards: WorkspaceStatisticsGrowthCardDto[];
}
