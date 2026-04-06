import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AnalyticsService, type CitySearchCountsRow } from '../analytics/analytics.service';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Review, type ReviewDocument } from '../reviews/schemas/review.schema';
import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspacePrivateOverviewResponseDto } from './dto/workspace-private-response.dto';
import type {
  WorkspaceStatisticsQueryDto,
  WorkspaceStatisticsRange,
  WorkspaceStatisticsViewerMode,
} from './dto/workspace-statistics-query.dto';
import type { WorkspacePublicCityActivityItemDto } from './dto/workspace-public-response.dto';
import type {
  WorkspaceStatisticsActivityComparisonDto,
  WorkspaceStatisticsCategoryDemandDto,
  WorkspaceStatisticsContextHealthDto,
  WorkspaceStatisticsCityDemandDto,
  WorkspaceStatisticsDecisionContextDto,
  WorkspaceStatisticsDecisionLayerDto,
  WorkspaceStatisticsPersonalizedPricingDto,
  WorkspaceStatisticsCategoryFitDto,
  WorkspaceStatisticsCityComparisonDto,
  WorkspaceStatisticsFilterOptionDto,
  WorkspaceStatisticsInsightDto,
  WorkspaceStatisticsOpportunityMetricDto,
  WorkspaceStatisticsOpportunityPeerContextDto,
  WorkspaceStatisticsOpportunityRadarItemDto,
  WorkspaceStatisticsFunnelComparisonDto,
  WorkspaceStatisticsOverviewResponseDto,
  WorkspaceStatisticsPriceIntelligenceDto,
  WorkspaceStatisticsProfileFunnelDto,
  WorkspaceStatisticsRecommendationSectionDto,
  WorkspaceStatisticsSectionMetaDto,
} from './dto/workspace-statistics-response.dto';
import { InsightsService, type AnalyticsSnapshot } from './insights.service';
import { WorkspaceService } from './workspace.service';

type WorkspaceStatisticsCategoryAggregateRow = {
  _id: {
    categoryKey?: string | null;
    categoryName?: string | null;
    subcategoryName?: string | null;
    serviceKey?: string | null;
  };
  count: number;
};

type FunnelStageKey = 'requests' | 'offers' | 'responses' | 'contracts' | 'completed';

type FunnelStageCounts = Record<FunnelStageKey, number>;
type DecisionMetricId =
  | 'offer_rate'
  | 'avg_response_time'
  | 'unanswered_over_24h'
  | 'completed_jobs'
  | 'revenue'
  | 'average_order_value';

type UserCategoryActivityRow = {
  categoryKey: string | null;
  categoryName: string | null;
  baseCount: number;
  completedCount: number;
};

type UserCityActivityRow = {
  cityId: string | null;
  cityName: string;
  baseCount: number;
  completedCount: number;
};

type ActivityDateRow = {
  createdAt?: Date | string | null;
};

type RankedCityOpportunityCandidate = {
  citySlug: string;
  cityName: string;
  cityId: string | null;
  requestCount: number;
  auftragSuchenCount: number | null;
  anbieterSuchenCount: number | null;
  providersActive: number | null;
  marketBalanceRatio: number | null;
  signal: 'high' | 'medium' | 'low' | 'none';
  lat: number | null;
  lng: number | null;
  score: number;
  demand: number;
  providers: number | null;
  demandScore: number;
  competitionScore: number;
  growthScore: number;
  activityScore: number;
  status: WorkspaceStatisticsOpportunityRadarItemDto['status'];
  tone: WorkspaceStatisticsOpportunityRadarItemDto['tone'];
  summaryKey: WorkspaceStatisticsOpportunityRadarItemDto['summaryKey'];
  metrics: WorkspaceStatisticsOpportunityMetricDto[];
};

@Injectable()
export class WorkspaceStatisticsService {
  private static readonly CATEGORY_RESPONSE_LIMIT = 50;
  private static readonly CITY_LIST_DEFAULT_LIMIT = 10;
  private static readonly CITY_LIST_MAX_LIMIT = 50;
  private static readonly ALL_CITIES_LABEL = 'Alle Städte';
  private static readonly ALL_CATEGORIES_LABEL = 'Alle Kategorien';
  private static readonly ALL_REGIONS_LABEL = 'Alle Regionen';
  private static readonly ALL_SERVICES_LABEL = 'Alle Services';

  constructor(
    private readonly config: ConfigService,
    private readonly workspace: WorkspaceService,
    private readonly analytics: AnalyticsService,
    private readonly insightsService: InsightsService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
  ) {}

  private resolveRange(range?: WorkspaceStatisticsRange): WorkspaceStatisticsRange {
    if (range === '24h' || range === '7d' || range === '30d' || range === '90d') return range;
    return '30d';
  }

  private normalizeScopeFilter(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private resolveFilters(query?: WorkspaceStatisticsRange | WorkspaceStatisticsQueryDto | null) {
    if (!query || typeof query === 'string') {
      return {
        range: this.resolveRange(query ?? undefined),
        cityId: null,
        regionId: null,
        categoryKey: null,
        subcategoryKey: null,
        citiesPage: 1,
        citiesLimit: WorkspaceStatisticsService.CITY_LIST_DEFAULT_LIMIT,
        viewerMode: null,
      };
    }

    const citiesPage =
      typeof query.citiesPage === 'number' && Number.isFinite(query.citiesPage)
        ? Math.max(1, Math.trunc(query.citiesPage))
        : 1;
    const citiesLimit =
      typeof query.citiesLimit === 'number' && Number.isFinite(query.citiesLimit)
        ? Math.min(
            WorkspaceStatisticsService.CITY_LIST_MAX_LIMIT,
            Math.max(1, Math.trunc(query.citiesLimit)),
          )
        : WorkspaceStatisticsService.CITY_LIST_DEFAULT_LIMIT;

    return {
      range: this.resolveRange(query.range),
      cityId: this.normalizeScopeFilter(query.cityId),
      regionId: this.normalizeScopeFilter(query.regionId),
      categoryKey: this.normalizeScopeFilter(query.categoryKey)?.toLowerCase() ?? null,
      subcategoryKey: this.normalizeScopeFilter(query.subcategoryKey)?.toLowerCase() ?? null,
      citiesPage,
      citiesLimit,
      viewerMode: query.viewerMode ?? null,
    };
  }

  private resolveViewerMode(
    viewerMode: WorkspaceStatisticsViewerMode | null | undefined,
    role?: AppRole | null,
  ): WorkspaceStatisticsViewerMode {
    if (viewerMode === 'provider' || viewerMode === 'customer') return viewerMode;
    return role === 'client' ? 'customer' : 'provider';
  }

  private getActivityConfig(range: WorkspaceStatisticsRange): { points: number; stepMs: number; interval: 'hour' | 'day' } {
    if (range === '24h') {
      return { points: 24, stepMs: 60 * 60 * 1000, interval: 'hour' };
    }
    if (range === '90d') {
      return { points: 90, stepMs: 24 * 60 * 60 * 1000, interval: 'day' };
    }
    if (range === '30d') {
      return { points: 30, stepMs: 24 * 60 * 60 * 1000, interval: 'day' };
    }
    return { points: 7, stepMs: 24 * 60 * 60 * 1000, interval: 'day' };
  }

  private resolveWindow(range: WorkspaceStatisticsRange): { start: Date; end: Date } {
    const end = new Date();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const span =
      range === '24h'
        ? day
        : range === '7d'
          ? 7 * day
          : range === '90d'
            ? 90 * day
            : 30 * day;
    return {
      start: new Date(end.getTime() - span),
      end,
    };
  }

  private resolveFilterOptionsRange(range: WorkspaceStatisticsRange): WorkspaceStatisticsRange {
    if (range === '24h' || range === '7d') return '30d';
    return range;
  }

  private clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private roundMoney(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private roundPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private roundScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 10) / 10;
  }

  private clampUnit(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  private resolveCitySignal(params: {
    demandActivity: number;
    supplyActivity: number;
  }): 'high' | 'medium' | 'low' | 'none' {
    const demandActivity = Math.max(0, params.demandActivity);
    const supplyActivity = Math.max(0, params.supplyActivity);
    if (demandActivity <= 0 && supplyActivity <= 0) return 'none';
    const pressure = demandActivity / Math.max(1, supplyActivity);
    if (pressure >= 1.25) return 'high';
    if (pressure <= 0.8) return 'low';
    return 'medium';
  }

  private resolveSignalTone(value: number, thresholds: {
    positiveWhen: (value: number) => boolean;
    warningWhen: (value: number) => boolean;
  }): 'positive' | 'neutral' | 'warning' {
    if (thresholds.positiveWhen(value)) return 'positive';
    if (thresholds.warningWhen(value)) return 'warning';
    return 'neutral';
  }

  private resolveOpportunityStatus(score: number): 'very_high' | 'good' | 'balanced' | 'competitive' | 'low' {
    if (score >= 8.5) return 'very_high';
    if (score >= 7) return 'good';
    if (score >= 5) return 'balanced';
    if (score >= 3.5) return 'competitive';
    return 'low';
  }

  private resolveOpportunityTone(
    status: 'very_high' | 'good' | 'balanced' | 'competitive' | 'low',
  ): 'very-high' | 'high' | 'balanced' | 'supply-heavy' {
    if (status === 'very_high') return 'very-high';
    if (status === 'good') return 'high';
    if (status === 'balanced') return 'balanced';
    return 'supply-heavy';
  }

  private resolveOpportunityMetricSemantic(params: {
    key: WorkspaceStatisticsOpportunityMetricDto['key'];
    value: number;
  }): Pick<WorkspaceStatisticsOpportunityMetricDto, 'semanticTone' | 'semanticKey'> {
    const value = Math.max(0, Math.min(10, params.value));
    if (params.key === 'competition') {
      if (value >= 8) return { semanticTone: 'high', semanticKey: 'high' };
      if (value >= 6) return { semanticTone: 'medium', semanticKey: 'noticeable' };
      if (value >= 4) return { semanticTone: 'medium', semanticKey: 'medium' };
      return { semanticTone: 'low', semanticKey: 'low' };
    }

    if (value >= 8) return { semanticTone: 'very-high', semanticKey: 'very_high' };
    if (value >= 6) return { semanticTone: 'high', semanticKey: 'high' };
    if (value >= 4) return { semanticTone: 'medium', semanticKey: 'medium' };
    return { semanticTone: 'low', semanticKey: 'low' };
  }

  private resolveOpportunitySummaryKey(params: {
    status: 'very_high' | 'good' | 'balanced' | 'competitive' | 'low';
    demand: number;
    competition: number;
    growth: number;
    activity: number;
  }): WorkspaceStatisticsOpportunityRadarItemDto['summaryKey'] {
    if (params.status === 'very_high') return 'very_high';
    if (params.status === 'good') return 'good';
    if (params.status === 'balanced') {
      return params.competition >= 7 ? 'balanced_competitive' : 'balanced';
    }
    if (params.status === 'competitive') return 'competitive';
    if (params.demand < 4 || params.growth < 4 || params.activity < 4) return 'low_demand';
    return 'low';
  }

  private roundToNearestStep(value: number, step: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(step, Math.round(value / step) * step);
  }

  private formatInt(value: number): string {
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(this.roundMoney(Math.max(0, value)));
  }

  private formatRangeLabel(range: WorkspaceStatisticsRange): string {
    if (range === '24h') return '24h';
    if (range === '7d') return '7 Tage';
    if (range === '90d') return '90 Tage';
    return '30 Tage';
  }

  private buildFunnelStageLabels(viewerMode: WorkspaceStatisticsViewerMode): Record<FunnelStageKey, string> {
    if (viewerMode === 'customer') {
      return {
        requests: 'Anfragen',
        offers: 'Erhaltene Angebote',
        responses: 'Akzeptierte Angebote',
        contracts: 'Gestartete Aufträge',
        completed: 'Abgeschlossen',
      };
    }

    return {
      requests: 'Anfragen',
      offers: 'Angebote',
      responses: 'Rückmeldungen',
      contracts: 'Verträge',
      completed: 'Abgeschlossen',
    };
  }

  private computeRate(current: number, previous: number): number | null {
    if (previous <= 0) return null;
    return this.clampPercent((current / previous) * 100);
  }

  private computeGap(userValue: number | null, marketValue: number | null): number | null {
    if (typeof userValue !== 'number' || typeof marketValue !== 'number') return null;
    return this.roundPercent(userValue - marketValue);
  }

  private resolveFunnelStageStatus(gapRate: number | null, reliable: boolean): 'good' | 'warning' | 'critical' | 'neutral' {
    if (!reliable || gapRate === null) return 'neutral';
    if (gapRate <= -25) return 'critical';
    if (gapRate <= -10) return 'warning';
    if (gapRate >= 10) return 'good';
    return 'neutral';
  }

  private resolveFunnelSeverity(gapRate: number | null): 'low' | 'medium' | 'high' | 'critical' {
    if (gapRate === null) return 'low';
    if (gapRate <= -35) return 'critical';
    if (gapRate <= -20) return 'high';
    if (gapRate <= -10) return 'medium';
    return 'low';
  }

  private formatGapPercent(gapRate: number | null): string {
    if (gapRate === null || !Number.isFinite(gapRate)) return '—';
    if (gapRate > 0) return `+${this.roundPercent(gapRate)} pp`;
    return `${this.roundPercent(gapRate)} pp`;
  }

  private resolveFunnelActionCode(stageKey: FunnelStageKey, status: 'good' | 'warning' | 'critical' | 'neutral'): string | null {
    if (status === 'good' || status === 'neutral') return null;
    if (stageKey === 'offers') return 'focus_market';
    if (stageKey === 'responses') return 'follow_up_requests';
    if (stageKey === 'contracts') return 'respond_faster';
    if (stageKey === 'completed') return 'complete_profile';
    return 'focus_market';
  }

  private resolveFunnelSignalCodes(
    stageKey: FunnelStageKey,
    status: 'good' | 'warning' | 'critical' | 'neutral',
  ): string[] {
    if (status === 'good') {
      if (stageKey === 'offers') return ['strong_offer_rate'];
      if (stageKey === 'completed') return ['strong_completion'];
      return [];
    }
    if (status === 'warning' || status === 'critical') {
      if (stageKey === 'offers') return ['high_offer_dropoff'];
      if (stageKey === 'responses') return ['low_response_rate'];
      if (stageKey === 'contracts') return ['weak_acceptance'];
    }
    return [];
  }

  private buildFunnelStageSummary(params: {
    label: string;
    marketRate: number | null;
    userRate: number | null;
    gapRate: number | null;
    status: 'good' | 'warning' | 'critical' | 'neutral';
    reliable: boolean;
  }): string | null {
    if (!params.reliable || params.marketRate === null || params.userRate === null || params.gapRate === null) {
      return 'Kein belastbarer Marktvergleich verfügbar.';
    }
    if (params.status === 'good') {
      return `Du performst bei ${params.label} aktuell besser als der Markt (${this.formatGapPercent(params.gapRate)}).`;
    }
    if (params.status === 'warning' || params.status === 'critical') {
      return `Du verlierst bei ${params.label} aktuell mehr als der Markt (${this.formatGapPercent(params.gapRate)}).`;
    }
    return `Du liegst bei ${params.label} aktuell nahe am Markt.`;
  }


  private normalizeFunnelStageCounts(counts: FunnelStageCounts): FunnelStageCounts {
    const requests = Math.max(0, Math.round(Number(counts.requests ?? 0)));
    const offers = Math.min(Math.max(0, Math.round(Number(counts.offers ?? 0))), requests);
    const responses = Math.min(Math.max(0, Math.round(Number(counts.responses ?? 0))), offers);
    const contracts = Math.min(Math.max(0, Math.round(Number(counts.contracts ?? 0))), responses);
    const completed = Math.min(Math.max(0, Math.round(Number(counts.completed ?? 0))), contracts);

    return {
      requests,
      offers,
      responses,
      contracts,
      completed,
    };
  }

  private buildFunnelComparison(params: {
    viewerMode: WorkspaceStatisticsViewerMode;
    marketCounts: FunnelStageCounts;
    userCounts: FunnelStageCounts;
    lowData: boolean;
  }): WorkspaceStatisticsFunnelComparisonDto {
    const labels = this.buildFunnelStageLabels(params.viewerMode);
    const orderedKeys: FunnelStageKey[] = ['requests', 'offers', 'responses', 'contracts', 'completed'];

    const stages: WorkspaceStatisticsFunnelComparisonDto['stages'] = orderedKeys.map((key, index) => {
      const previousKey = orderedKeys[index - 1] ?? null;
      const marketRateFromPrev = previousKey ? this.computeRate(params.marketCounts[key], params.marketCounts[previousKey]) : 100;
      const userRateFromPrev = previousKey ? this.computeRate(params.userCounts[key], params.userCounts[previousKey]) : 100;
      const previousUserCount = previousKey ? params.userCounts[previousKey] : params.userCounts.requests;
      const previousMarketCount = previousKey ? params.marketCounts[previousKey] : params.marketCounts.requests;
      const reliable = !params.lowData && previousKey !== null && previousUserCount >= 3 && previousMarketCount >= 5;
      const gapRate = previousKey ? this.computeGap(userRateFromPrev, marketRateFromPrev) : 0;
      const status = previousKey
        ? this.resolveFunnelStageStatus(gapRate, reliable)
        : 'neutral';

      return {
        key,
        label: labels[key],
        marketCount: params.marketCounts[key],
        userCount: params.userCounts[key],
        marketRateFromPrev,
        userRateFromPrev,
        gapRate,
        status,
        signalCodes: previousKey ? this.resolveFunnelSignalCodes(key, status) : [],
        summary: previousKey
          ? this.buildFunnelStageSummary({
              label: labels[key],
              marketRate: marketRateFromPrev,
              userRate: userRateFromPrev,
              gapRate,
              status,
              reliable,
            })
          : null,
      };
    });

    const comparableStages = stages
      .filter((stage) => stage.key !== 'requests')
      .filter((stage) => typeof stage.gapRate === 'number' && params.userCounts[stage.key as FunnelStageKey] >= 0);

    const largestGapStage = comparableStages.reduce<WorkspaceStatisticsFunnelComparisonDto['stages'][number] | null>((worst, stage) => {
      if (!worst) return stage;
      return (stage.gapRate ?? 0) < (worst.gapRate ?? 0) ? stage : worst;
    }, null);

    const reliableLargestGapStage =
      params.lowData || !largestGapStage || (largestGapStage.gapRate ?? 0) >= 0
        ? null
        : largestGapStage;

    const largestDropOffStage = reliableLargestGapStage
      ? {
          key: reliableLargestGapStage.key,
          label: reliableLargestGapStage.label,
          userRateFromPrev: reliableLargestGapStage.userRateFromPrev,
          marketRateFromPrev: reliableLargestGapStage.marketRateFromPrev,
          gapRate: reliableLargestGapStage.gapRate,
          severity: this.resolveFunnelSeverity(reliableLargestGapStage.gapRate),
          summary: reliableLargestGapStage.summary ?? 'Hier liegt aktuell dein größter Drop-off.',
          actionCode: this.resolveFunnelActionCode(reliableLargestGapStage.key as FunnelStageKey, reliableLargestGapStage.status),
        }
      : null;

    const bottleneck = largestDropOffStage
      ? {
          key: largestDropOffStage.key,
          title: `${largestDropOffStage.label} bleiben zurück`,
          description: largestDropOffStage.summary,
          severity: largestDropOffStage.severity,
          actionCode: largestDropOffStage.actionCode,
        }
      : null;

    const marketConversion = this.computeRate(params.marketCounts.completed, params.marketCounts.requests);
    const userConversion = this.computeRate(params.userCounts.completed, params.userCounts.requests);
    const gapConversion = this.computeGap(userConversion, marketConversion);
    const conversionSummary = {
      userConversion,
      marketConversion,
      gapConversion,
      status: this.resolveFunnelStageStatus(gapConversion, !params.lowData && params.userCounts.requests >= 3 && params.marketCounts.requests >= 5),
    };

    const primaryAction = bottleneck?.actionCode
      ? {
          code: bottleneck.actionCode,
          label: bottleneck.actionCode === 'follow_up_requests'
            ? 'Offene Anfragen priorisieren'
            : bottleneck.actionCode === 'respond_faster'
              ? 'Schneller reagieren'
              : bottleneck.actionCode === 'complete_profile'
                ? 'Profil vervollständigen'
                : 'Marktfokus schärfen',
          target: bottleneck.actionCode === 'focus_market' ? '/workspace?section=stats&focus=cities' : '/workspace?tab=my-requests',
        }
      : null;

    const lowDataSummary = 'Noch zu wenig Daten für einen belastbaren Funnel-Vergleich.';
    const summary = params.lowData
      ? lowDataSummary
      : largestDropOffStage?.summary ?? 'Dein Funnel liegt aktuell nahe am Markt.';

    return {
      title: 'Profil Performance',
      subtitle: params.viewerMode === 'customer'
        ? 'Wie deine Anfragen aktuell performen.'
        : 'Wie dein Profil aktuell performt.',
      stages,
      largestDropOffStage,
      bottleneck,
      conversionSummary,
      primaryAction,
      summary,
      primaryBottleneck: bottleneck?.title ?? null,
      nextAction: primaryAction?.label ?? (params.lowData ? lowDataSummary : null),
      largestGapStage: largestDropOffStage?.key ?? null,
    };
  }

  private aggregateCategoryRows(params: {
    start: Date;
    end: Date;
    match?: Record<string, unknown>;
  }) {
    return this.requestModel
      .aggregate<WorkspaceStatisticsCategoryAggregateRow>([
        {
          $match: {
            status: 'published',
            createdAt: { $gte: params.start, $lte: params.end },
            ...(params.match ?? {}),
          },
        },
        {
          $group: {
            _id: {
              categoryKey: '$categoryKey',
              categoryName: '$categoryName',
              subcategoryName: '$subcategoryName',
              serviceKey: '$serviceKey',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .exec();
  }

  private buildFilterOptions(params: {
    publicCities: WorkspacePublicCityActivityItemDto[];
    categoryRows: WorkspaceStatisticsCategoryAggregateRow[];
  }): WorkspaceStatisticsOverviewResponseDto['filterOptions'] {
    const cities = params.publicCities
      .map((item) => ({
        value: item.cityId ?? item.citySlug,
        label: item.cityName,
      }))
      .filter((item) => item.value.trim().length > 0)
      .sort((a, b) => a.label.localeCompare(b.label, 'de-DE'));

    const categories = new Map<string, WorkspaceStatisticsFilterOptionDto>();
    const services = new Map<string, WorkspaceStatisticsFilterOptionDto>();

    for (const row of params.categoryRows) {
      const categoryKey = this.normalizeScopeFilter(row._id?.categoryKey)?.toLowerCase();
      const categoryLabel =
        this.normalizeScopeFilter(row._id?.categoryName) ??
        this.normalizeScopeFilter(row._id?.subcategoryName) ??
        this.normalizeScopeFilter(row._id?.serviceKey);
      if (categoryKey && categoryLabel && !categories.has(categoryKey)) {
        categories.set(categoryKey, {
          value: categoryKey,
          label: categoryLabel,
        });
      }

      const serviceKey = this.normalizeScopeFilter(row._id?.serviceKey)?.toLowerCase();
      const serviceLabel =
        this.normalizeScopeFilter(row._id?.subcategoryName) ??
        this.normalizeScopeFilter(row._id?.serviceKey);
      if (serviceKey && serviceLabel && !services.has(serviceKey)) {
        services.set(serviceKey, {
          value: serviceKey,
          label: serviceLabel,
        });
      }
    }

    return {
      cities,
      categories: Array.from(categories.values()).sort((a, b) => a.label.localeCompare(b.label, 'de-DE')),
      services: Array.from(services.values()).sort((a, b) => a.label.localeCompare(b.label, 'de-DE')),
    };
  }

  private buildContextHealth(params: {
    categories: WorkspaceStatisticsCategoryDemandDto[];
    cities: WorkspaceStatisticsCityDemandDto[];
    opportunityRadar: WorkspaceStatisticsOpportunityRadarItemDto[];
    activity: WorkspaceStatisticsOverviewResponseDto['activity'];
  }): WorkspaceStatisticsContextHealthDto[] {
    const leadCategory = params.categories[0] ?? null;
    const latestDelta =
      Number(params.activity.totals.latestRequests ?? 0) - Number(params.activity.totals.previousRequests ?? 0);
    const competitionRatio =
      params.opportunityRadar[0]?.marketBalanceRatio ?? params.cities[0]?.marketBalanceRatio ?? null;

    return [
      {
        key: 'demand',
        value: leadCategory
          ? leadCategory.sharePercent >= 45
            ? 'rising'
            : 'stable'
          : 'limited',
        tone: leadCategory
          ? leadCategory.sharePercent >= 45
            ? 'positive'
            : 'neutral'
          : 'warning',
      },
      {
        key: 'competition',
        value:
          competitionRatio === null
            ? 'balanced'
            : competitionRatio >= 2
              ? 'low'
              : competitionRatio >= 1
                ? 'balanced'
                : 'high',
        tone:
          competitionRatio === null
            ? 'neutral'
            : competitionRatio >= 2
              ? 'positive'
              : competitionRatio >= 1
                ? 'neutral'
                : 'warning',
      },
      {
        key: 'activity',
        value: latestDelta > 0 ? 'high' : latestDelta < 0 ? 'low' : 'stable',
        tone: latestDelta > 0 ? 'positive' : latestDelta < 0 ? 'warning' : 'neutral',
      },
    ];
  }

  private buildSectionMeta(context: WorkspaceStatisticsDecisionContextDto): WorkspaceStatisticsSectionMetaDto {
    const focusLabel = context.mode === 'focus' ? context.scopeLabel : null;
    return {
      decisionSubtitle: 'Operative Kennzahlen für Markt- und Wachstumsentscheidungen.',
      demandSubtitle: 'Wo aktuell die meiste Nachfrage entsteht.',
      citiesSubtitle: 'Regionen mit aktuellem Nachfrage- und Wettbewerbssignal.',
      opportunityTitle: focusLabel ? `Opportunity Radar für ${focusLabel}` : 'Opportunity Radar',
      priceTitle: focusLabel ? `Preis-Intelligenz für ${focusLabel}` : 'Preis-Intelligenz',
      insightsSubtitle: focusLabel
        ? `Empfehlungen basierend auf dem aktuellen Kontext · ${focusLabel}`
        : 'Empfehlungen basierend auf dem aktuellen Kontext',
      growthSubtitle: focusLabel
        ? `Wachstum & Promotion · ${focusLabel}`
        : 'Wachstum & Promotion',
    };
  }

  private buildExportMeta(params: {
    range: WorkspaceStatisticsRange;
    cityId: string | null;
    categoryKey: string | null;
    updatedAt: string;
  }): WorkspaceStatisticsOverviewResponseDto['exportMeta'] {
    const scopeSuffix = [params.cityId, params.categoryKey].filter(Boolean).join('-');
    return {
      filename: `workspace-statistics-${params.range}${scopeSuffix ? `-${scopeSuffix}` : ''}-${params.updatedAt.slice(0, 10)}.csv`,
    };
  }

  private resolvePriceSmartSignalTone(params: {
    smartRecommendedPrice: number | null;
    marketAverage: number | null;
  }): WorkspaceStatisticsPriceIntelligenceDto['smartSignalTone'] {
    if (params.smartRecommendedPrice === null || params.marketAverage === null) return null;
    const delta = params.smartRecommendedPrice - params.marketAverage;
    if (delta <= -10) return 'visibility';
    if (delta >= 10) return 'premium';
    return 'balanced';
  }

  private resolvePriceConfidenceLevel(
    analyzedRequestsCount: number | null,
  ): WorkspaceStatisticsPriceIntelligenceDto['confidenceLevel'] {
    if (analyzedRequestsCount === null || analyzedRequestsCount <= 0) return null;
    if (analyzedRequestsCount >= 100) return 'high';
    if (analyzedRequestsCount >= 40) return 'medium';
    return 'low';
  }

  private buildDecisionInsight(params: {
    activityMetrics: WorkspaceStatisticsOverviewResponseDto['activity']['metrics'];
    conversionRatePercent: number;
  }): string {
    const offerRatePercent = this.clampPercent(Number(params.activityMetrics.offerRatePercent ?? 0));
    const unansweredRequests24h = Math.max(0, Math.round(Number(params.activityMetrics.unansweredRequests24h ?? 0)));
    const responseMedianMinutesRaw = params.activityMetrics.responseMedianMinutes;
    const responseMedianMinutes =
      typeof responseMedianMinutesRaw === 'number' && Number.isFinite(responseMedianMinutesRaw)
        ? Math.max(0, Math.round(responseMedianMinutesRaw))
        : null;
    const conversionRatePercent = this.clampPercent(Number(params.conversionRatePercent ?? 0));
    const completedJobs = Math.max(0, Math.round(Number(params.activityMetrics.completedJobs ?? 0)));

    const hasRelevantSignals =
      offerRatePercent > 0 ||
      unansweredRequests24h > 0 ||
      conversionRatePercent > 0 ||
      completedJobs > 0 ||
      responseMedianMinutes !== null;
    if (!hasRelevantSignals) {
      return 'Aktuell liegen nur wenige Signale vor. Sobald mehr Anfragen und Angebote eingehen, werden präzisere Handlungsempfehlungen angezeigt.';
    }

    if (unansweredRequests24h >= 20) {
      return `Die Angebotsquote liegt aktuell bei ${offerRatePercent} %, während ${this.formatInt(unansweredRequests24h)} Anfragen länger als 24 Stunden unbeantwortet bleiben. Schnellere Reaktionen könnten die Abschlussrate weiter erhöhen.`;
    }

    if (responseMedianMinutes !== null && responseMedianMinutes >= 720) {
      return 'Die aktuelle Antwortzeit ist relativ hoch, wodurch mehrere Anfragen länger offen bleiben. Schnellere Reaktionen können die Anzahl erfolgreicher Abschlüsse deutlich erhöhen.';
    }

    if (conversionRatePercent >= 30 && offerRatePercent >= 60 && unansweredRequests24h <= 10) {
      return 'Die Plattform zeigt eine stabile Abschlussquote und gute Angebotsaktivität. Weitere Aufträge können vor allem durch höhere Sichtbarkeit der Anbieter entstehen.';
    }

    if (unansweredRequests24h >= 10) {
      return 'Mehrere Anfragen bleiben aktuell länger als 24 Stunden unbeantwortet. Dies deutet auf ungenutzte Marktchancen hin.';
    }

    return 'Die Nachfrage bleibt stabil, jedoch bleiben einige Anfragen ohne Angebot. Schnellere Reaktionen und mehr aktive Anbieter könnten die Abschlussrate erhöhen.';
  }

  private computeRelativeGap(userValue: number | null, marketValue: number | null): number | null {
    if (typeof userValue !== 'number' || typeof marketValue !== 'number' || marketValue === 0) return null;
    return this.roundPercent(((userValue - marketValue) / Math.abs(marketValue)) * 100);
  }

  private resolveDecisionMetric(
    params: {
      id: DecisionMetricId;
      label: string;
      unit: 'percent' | 'minutes' | 'currency' | 'count';
      marketValue: number | null;
      userValue: number | null;
      higherIsBetter: boolean;
      emptySummary: string;
      betterSummary: string;
      worseSummary: string;
      neutralSummary: string;
      signalCodes: string[];
      primaryActionCode: string | null;
      reliableComparison?: boolean;
      lowConfidenceSummary?: string;
    },
  ): WorkspaceStatisticsDecisionLayerDto['metrics'][number] {
    const gapAbsolute = this.computeGap(params.userValue, params.marketValue);
    const gapPercent = this.computeRelativeGap(params.userValue, params.marketValue);
    const hasComparison = typeof params.userValue === 'number' && typeof params.marketValue === 'number';
    const reliableComparison = params.reliableComparison ?? hasComparison;

    let direction: WorkspaceStatisticsDecisionLayerDto['metrics'][number]['direction'] = 'neutral';
    if (reliableComparison && gapAbsolute !== null && gapAbsolute !== 0) {
      const isBetter = params.higherIsBetter ? gapAbsolute > 0 : gapAbsolute < 0;
      direction = isBetter ? 'better' : 'worse';
    }

    let status: WorkspaceStatisticsDecisionLayerDto['metrics'][number]['status'] = 'neutral';
    if (reliableComparison && gapAbsolute !== null) {
      const gapMagnitude = Math.abs(gapPercent ?? gapAbsolute);
      if (direction === 'better') {
        status = gapMagnitude >= 20 ? 'good' : 'neutral';
      } else if (direction === 'worse') {
        status = gapMagnitude >= 35 ? 'critical' : gapMagnitude >= 12 ? 'warning' : 'neutral';
      }
    }

    let summary = params.emptySummary;
    if (hasComparison && !reliableComparison) {
      summary = params.lowConfidenceSummary ?? params.emptySummary;
    } else if (hasComparison) {
      if (direction === 'better') summary = params.betterSummary;
      else if (direction === 'worse') summary = params.worseSummary;
      else summary = params.neutralSummary;
    }

    return {
      id: params.id,
      label: params.label,
      marketValue: params.marketValue,
      userValue: params.userValue,
      gapAbsolute,
      gapPercent,
      unit: params.unit,
      direction,
      status,
      signalCodes: reliableComparison ? params.signalCodes : [],
      primaryActionCode: reliableComparison ? params.primaryActionCode : null,
      summary,
    };
  }

  private buildDecisionLayer(params: {
    mode: 'platform' | 'personalized';
    viewerMode: WorkspaceStatisticsViewerMode | null;
    activityMetrics: WorkspaceStatisticsOverviewResponseDto['activity']['metrics'];
    marketCounts: FunnelStageCounts;
    marketRevenueAmount: number;
    marketAverageOrderValue: number | null;
    userCounts: FunnelStageCounts;
    userRevenueAmount: number;
    userAverageOrderValue: number | null;
    userResponseMinutes: number | null;
    userUnansweredOver24h: number | null;
    reliableComparison: boolean;
  }): WorkspaceStatisticsDecisionLayerDto | null {
    if (params.mode !== 'personalized' || !params.viewerMode) return null;

    const marketOfferRate = this.computeRate(params.marketCounts.offers, params.marketCounts.requests);
    const userOfferRate = this.computeRate(params.userCounts.offers, params.userCounts.requests);

    const isCustomerMode = params.viewerMode === 'customer';
    const lowConfidenceSummary = 'Vergleich basiert aktuell auf begrenzten viewer-spezifischen Daten.';
    const metrics: WorkspaceStatisticsDecisionLayerDto['metrics'] = [
      this.resolveDecisionMetric({
        id: 'offer_rate',
        label: isCustomerMode ? 'Anfragen mit Angeboten' : 'Angebotsquote',
        unit: 'percent',
        marketValue: marketOfferRate,
        userValue: userOfferRate,
        higherIsBetter: true,
        emptySummary: 'Kein Marktvergleich verfügbar.',
        betterSummary: isCustomerMode
          ? 'Deine Anfragen erhalten häufiger Angebote als der Markt.'
          : 'Du sendest häufiger Angebote als der Markt.',
        worseSummary: isCustomerMode
          ? 'Deine Anfragen erhalten seltener Angebote als der Markt.'
          : 'Du bleibst bei Angeboten unter dem Markt.',
        neutralSummary: 'Du liegst bei der Angebotsquote nahe am Markt.',
        signalCodes: userOfferRate !== null && marketOfferRate !== null && userOfferRate >= marketOfferRate
          ? ['strong_position']
          : ['low_visibility'],
        primaryActionCode: userOfferRate !== null && marketOfferRate !== null && userOfferRate < marketOfferRate
          ? 'focus_market'
          : null,
        reliableComparison: params.reliableComparison,
        lowConfidenceSummary,
      }),
      this.resolveDecisionMetric({
        id: 'avg_response_time',
        label: isCustomerMode ? 'Zeit bis erstes Angebot' : 'Median Antwortzeit',
        unit: 'minutes',
        marketValue: params.activityMetrics.responseMedianMinutes,
        userValue: params.userResponseMinutes,
        higherIsBetter: false,
        emptySummary: 'Kein Marktvergleich verfügbar.',
        betterSummary: isCustomerMode
          ? 'Du erhältst schneller Angebote als der Markt.'
          : 'Du reagierst schneller als der Markt.',
        worseSummary: isCustomerMode
          ? 'Deine Anfragen erhalten später Angebote als im Markt üblich.'
          : 'Deine Antwortzeit ist langsamer als der Markt.',
        neutralSummary: 'Deine Antwortzeit liegt nahe am Markt.',
        signalCodes: ['slow_response'],
        primaryActionCode: 'respond_faster',
        reliableComparison: params.reliableComparison,
        lowConfidenceSummary,
      }),
      this.resolveDecisionMetric({
        id: 'unanswered_over_24h',
        label: isCustomerMode ? 'Ohne Angebot >24h' : 'Offen >24h',
        unit: 'count',
        marketValue: params.activityMetrics.unansweredRequests24h,
        userValue: params.userUnansweredOver24h,
        higherIsBetter: false,
        emptySummary: 'Kein Marktvergleich verfügbar.',
        betterSummary: 'Du hast weniger offene Fälle >24h als der Markt.',
        worseSummary: 'Zu viele Vorgänge bleiben länger als 24 Stunden offen.',
        neutralSummary: 'Deine offenen Fälle >24h liegen nahe am Markt.',
        signalCodes: ['high_unanswered'],
        primaryActionCode: 'follow_up_unanswered',
        reliableComparison: params.reliableComparison,
        lowConfidenceSummary,
      }),
      this.resolveDecisionMetric({
        id: 'completed_jobs',
        label: 'Abgeschlossene Aufträge',
        unit: 'count',
        marketValue: params.marketCounts.completed,
        userValue: params.userCounts.completed,
        higherIsBetter: true,
        emptySummary: 'Kein Marktvergleich verfügbar.',
        betterSummary: 'Du schließt mehr Aufträge ab als der Markt.',
        worseSummary: 'Du liegst bei Abschlüssen unter dem Markt.',
        neutralSummary: 'Deine Abschlusszahl liegt nahe am Markt.',
        signalCodes: params.userCounts.completed >= params.marketCounts.completed ? ['strong_position'] : [],
        primaryActionCode: params.userCounts.completed < params.marketCounts.completed ? 'focus_market' : null,
        reliableComparison: params.reliableComparison,
        lowConfidenceSummary,
      }),
      this.resolveDecisionMetric({
        id: 'revenue',
        label: isCustomerMode ? 'Ausgaben' : 'Umsatz',
        unit: 'currency',
        marketValue: params.marketRevenueAmount,
        userValue: params.userRevenueAmount,
        higherIsBetter: !isCustomerMode,
        emptySummary: 'Kein Marktvergleich verfügbar.',
        betterSummary: isCustomerMode
          ? 'Du gibst aktuell weniger aus als der Markt.'
          : 'Du erzielst aktuell mehr Umsatz als der Markt.',
        worseSummary: isCustomerMode
          ? 'Deine Ausgaben liegen aktuell über dem Markt.'
          : 'Dein Umsatz liegt aktuell unter dem Markt.',
        neutralSummary: 'Dein Umsatzniveau liegt nahe am Markt.',
        signalCodes: params.userRevenueAmount >= params.marketRevenueAmount ? ['strong_position'] : [],
        primaryActionCode: params.userRevenueAmount < params.marketRevenueAmount && !isCustomerMode ? 'focus_market' : null,
        reliableComparison: params.reliableComparison,
        lowConfidenceSummary,
      }),
      this.resolveDecisionMetric({
        id: 'average_order_value',
        label: 'Ø Auftragswert',
        unit: 'currency',
        marketValue: params.marketAverageOrderValue,
        userValue: params.userAverageOrderValue,
        higherIsBetter: !isCustomerMode,
        emptySummary: 'Kein Marktvergleich verfügbar.',
        betterSummary: isCustomerMode
          ? 'Dein durchschnittlicher Auftragswert liegt unter dem Markt.'
          : 'Dein durchschnittlicher Auftragswert liegt über dem Markt.',
        worseSummary: isCustomerMode
          ? 'Dein durchschnittlicher Auftragswert liegt über dem Markt.'
          : 'Dein durchschnittlicher Auftragswert liegt unter dem Markt.',
        neutralSummary: 'Dein durchschnittlicher Auftragswert liegt nahe am Markt.',
        signalCodes: [],
        primaryActionCode: isCustomerMode ? null : 'adjust_price',
        reliableComparison: params.reliableComparison,
        lowConfidenceSummary,
      }),
    ];

    const rankedMetric = params.reliableComparison
      ? (
          metrics
            .filter((metric) => metric.status === 'critical' || metric.status === 'warning')
            .sort((left, right) => {
              const leftPriority = left.status === 'critical' ? 2 : 1;
              const rightPriority = right.status === 'critical' ? 2 : 1;
              return rightPriority - leftPriority;
            })[0] ?? metrics.find((metric) => metric.status === 'good') ?? metrics.find((metric) => Boolean(metric.summary)) ?? metrics[0] ?? null
        )
      : null;

    const primaryInsight = params.reliableComparison
      ? (rankedMetric?.summary ?? null)
      : lowConfidenceSummary;
    const primaryAction = params.reliableComparison && rankedMetric?.primaryActionCode
      ? {
          code: rankedMetric.primaryActionCode,
          label: rankedMetric.primaryActionCode === 'respond_faster'
            ? 'Schneller reagieren'
            : rankedMetric.primaryActionCode === 'follow_up_unanswered'
              ? 'Offene Vorgänge priorisieren'
              : rankedMetric.primaryActionCode === 'adjust_price'
                ? 'Preisstrategie prüfen'
                : rankedMetric.primaryActionCode === 'complete_profile'
                  ? 'Profil vervollständigen'
                  : 'Marktfokus schärfen',
          target: rankedMetric.primaryActionCode === 'focus_market'
            ? '/workspace?section=stats&focus=cities'
            : '/workspace?tab=my-requests',
        }
      : null;

    return {
      title: 'Decision Layer',
      subtitle: 'User vs Market im aktuellen Kontext',
      metrics,
      primaryInsight,
      primaryAction,
    };
  }

  private toActivityLevel(value: number, maxValue: number): 'high' | 'medium' | 'low' | 'unknown' {
    if (maxValue <= 0 || value <= 0) return maxValue <= 0 ? 'unknown' : 'low';
    const ratio = value / maxValue;
    if (ratio >= 0.66) return 'high';
    if (ratio >= 0.33) return 'medium';
    return 'low';
  }

  private resolvePricingComparisonReliability(params: {
    priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto;
    userPrice: number | null;
  }): WorkspaceStatisticsPersonalizedPricingDto['comparisonReliability'] {
    const hasMarketSignal =
      typeof params.priceIntelligence.marketAverage === 'number' ||
      typeof params.priceIntelligence.recommendedMin === 'number' ||
      typeof params.priceIntelligence.recommendedMax === 'number';
    if (typeof params.userPrice !== 'number' || !hasMarketSignal) return 'unavailable';
    if (params.priceIntelligence.confidenceLevel === 'high') return 'high';
    if (params.priceIntelligence.confidenceLevel === 'medium') return 'medium';
    return 'low';
  }

  private resolveFitReliability(params: {
    marketValue: number | null;
    userBaseCount: number;
    userCompletedCount?: number;
  }): 'high' | 'medium' | 'low' | 'unknown' {
    const hasMarketValue = typeof params.marketValue === 'number' && params.marketValue > 0;
    const completedCount = params.userCompletedCount ?? 0;
    if (!hasMarketValue && params.userBaseCount <= 0 && completedCount <= 0) return 'unknown';
    if (hasMarketValue && params.userBaseCount >= 5) return 'high';
    if (hasMarketValue && params.userBaseCount >= 2) return 'medium';
    if (hasMarketValue || params.userBaseCount > 0 || completedCount > 0) return 'low';
    return 'unknown';
  }

  private resolveInsightReliability(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.65) return 'medium';
    return 'low';
  }

  private resolveInsightActionCode(insight: WorkspaceStatisticsInsightDto): string | null {
    switch (insight.code) {
      case 'high_unanswered_requests':
        return 'follow_up_unanswered';
      case 'city_opportunity_high':
      case 'category_opportunity_high':
      case 'top_city_demand':
      case 'top_category_demand':
        return 'focus_market';
      case 'user_low_conversion':
      case 'profile_missing_photo':
      case 'profile_low_completeness':
        return 'complete_profile';
      case 'local_ads_opportunity':
        return 'boost_visibility';
      default:
        return null;
    }
  }

  private toRecommendationAction(
    insight: WorkspaceStatisticsInsightDto,
    actionCode: string | null,
  ): WorkspaceStatisticsRecommendationSectionDto['items'][number]['action'] {
    if (insight.action?.actionType === 'internal_link' && insight.action.href) {
      return {
        code: actionCode ?? insight.code,
        label: insight.action.label,
        target: insight.action.href,
      };
    }

    if (actionCode === 'follow_up_unanswered') {
      return {
        code: actionCode,
        label: 'Offene Vorgänge priorisieren',
        target: '/workspace?tab=my-requests',
      };
    }
    if (actionCode === 'focus_market') {
      return {
        code: actionCode,
        label: 'Marktfokus schärfen',
        target: '/workspace?section=stats&focus=cities',
      };
    }
    if (actionCode === 'complete_profile') {
      return {
        code: actionCode,
        label: 'Profil vervollständigen',
        target: '/workspace?section=profile',
      };
    }
    if (actionCode === 'boost_visibility') {
      return {
        code: actionCode,
        label: 'Sichtbarkeit ausbauen',
        target: '/workspace?section=stats&focus=growth',
      };
    }

    return null;
  }

  private buildRecommendationSection(params: {
    mode: 'platform' | 'personalized';
    title: string;
    subtitle: string;
    items: WorkspaceStatisticsInsightDto[];
  }): WorkspaceStatisticsRecommendationSectionDto | null {
    if (params.mode !== 'personalized') return null;

    const items = params.items.map((insight) => {
      const actionCode = this.resolveInsightActionCode(insight);
      return {
        code: insight.code,
        type: insight.type,
        priority: insight.priority,
        title: insight.title,
        description: insight.body,
        confidence: insight.confidence,
        reliability: this.resolveInsightReliability(insight.confidence),
        context: insight.context,
        actionCode,
        action: this.toRecommendationAction(insight, actionCode),
      };
    });

    return {
      title: params.title,
      subtitle: params.subtitle,
      hasReliableItems: items.some((item) => item.reliability === 'high' || item.reliability === 'medium'),
      items,
    };
  }

  private buildPersonalizedPricing(params: {
    mode: 'platform' | 'personalized';
    scopeLabel: string;
    priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto;
    userAverageOrderValue: number | null;
  }): WorkspaceStatisticsPersonalizedPricingDto | null {
    if (params.mode !== 'personalized') return null;

    const marketAverage = params.priceIntelligence.marketAverage;
    const recommendedMin = params.priceIntelligence.recommendedMin;
    const recommendedMax = params.priceIntelligence.recommendedMax;
    const userPrice = params.userAverageOrderValue;
    const gapAbsolute = this.computeGap(userPrice, marketAverage);
    const comparisonReliability = this.resolvePricingComparisonReliability({
      priceIntelligence: params.priceIntelligence,
      userPrice,
    });

    let position: WorkspaceStatisticsPersonalizedPricingDto['position'] = 'unknown';
    if (
      comparisonReliability !== 'unavailable' &&
      typeof userPrice === 'number' &&
      typeof recommendedMin === 'number' &&
      typeof recommendedMax === 'number'
    ) {
      if (userPrice < recommendedMin) position = 'below';
      else if (userPrice > recommendedMax) position = 'above';
      else position = 'within';
    }

    const effect: WorkspaceStatisticsPersonalizedPricingDto['effect'] =
      comparisonReliability === 'high' || comparisonReliability === 'medium'
        ? (position === 'within' ? 'positive' : position === 'above' ? 'warning' : 'neutral')
        : 'neutral';
    const actionCode =
      comparisonReliability === 'high' || comparisonReliability === 'medium'
        ? (position === 'within' || position === 'unknown' ? null : 'adjust_price')
        : null;
    const summary =
      comparisonReliability === 'unavailable'
        ? 'Noch kein belastbarer Preisvergleich verfügbar.'
        : comparisonReliability === 'low'
          ? 'Preisvergleich ist aktuell nur eingeschränkt belastbar.'
          : position === 'within'
        ? 'Dein Preis liegt im empfohlenen Bereich.'
        : position === 'above'
          ? 'Dein Preis liegt über dem empfohlenen Bereich und kann Conversion kosten.'
          : position === 'below'
            ? 'Dein Preis liegt unter dem empfohlenen Bereich und lässt Potenzial offen.'
            : 'Noch kein belastbarer Preisvergleich verfügbar.';

    return {
      title: 'Preisstrategie',
      subtitle: 'Wie dein Preis im aktuellen Markt einzuordnen ist.',
      contextLabel: params.scopeLabel,
      marketAverage,
      recommendedMin,
      recommendedMax,
      userPrice,
      gapAbsolute,
      comparisonReliability,
      position,
      effect,
      actionCode,
      summary,
    };
  }

  private buildCategoryFit(params: {
    mode: 'platform' | 'personalized';
    categories: WorkspaceStatisticsCategoryDemandDto[];
    userRows: UserCategoryActivityRow[];
  }): WorkspaceStatisticsCategoryFitDto | null {
    if (params.mode !== 'personalized') return null;

    const userByCategory = new Map<string, UserCategoryActivityRow>();
    for (const row of params.userRows) {
      const key = this.normalizeScopeFilter(row.categoryKey) ?? '__null__';
      userByCategory.set(key, row);
    }
    const maxBase = Math.max(0, ...params.userRows.map((row) => row.baseCount));
    const items = params.categories.slice(0, 5).map((category) => {
      const key = this.normalizeScopeFilter(category.categoryKey) ?? '__null__';
      const userRow = userByCategory.get(key);
      const baseCount = userRow?.baseCount ?? 0;
      const reliability = this.resolveFitReliability({
        marketValue: category.sharePercent,
        userBaseCount: baseCount,
        userCompletedCount: userRow?.completedCount ?? 0,
      });
      const userFit = this.toActivityLevel(baseCount, maxBase);
      const demandShare = category.sharePercent;
      const opportunity: WorkspaceStatisticsCategoryFitDto['items'][number]['opportunity'] =
        reliability === 'unknown'
          ? 'unknown'
          : demandShare >= 25 && (userFit === 'low' || userFit === 'unknown')
            ? 'high'
            : demandShare >= 15
              ? 'medium'
              : demandShare > 0
                ? 'low'
                : 'unknown';
      const actionCode = reliability === 'high' && opportunity === 'high' ? 'focus_market' : null;
      const summary =
        reliability === 'unknown'
          ? 'Noch keine belastbare Einordnung für diese Kategorie.'
          : reliability === 'low'
            ? 'Erste Signale vorhanden, aber die Datengrundlage ist noch dünn.'
            : opportunity === 'high'
              ? 'Starke Nachfrage bei noch ausbaufähiger Präsenz.'
              : userFit === 'high'
                ? 'Du bist in dieser Kategorie bereits gut positioniert.'
                : 'Markt und Präsenz liegen aktuell nahe beieinander.';

      return {
        categoryKey: category.categoryKey,
        label: category.categoryName,
        marketDemandShare: demandShare,
        reliability,
        userFit,
        opportunity,
        actionCode,
        summary,
      };
    });

    return {
      title: 'Kategorien-Fit',
      subtitle: 'Wie gut deine Präsenz zur aktuellen Nachfrage passt.',
      hasReliableItems: items.some((item) => item.reliability === 'high' || item.reliability === 'medium'),
      items,
    };
  }

  private buildCityComparison(params: {
    mode: 'platform' | 'personalized';
    cities: WorkspaceStatisticsCityDemandDto[];
    userRows: UserCityActivityRow[];
  }): WorkspaceStatisticsCityComparisonDto | null {
    if (params.mode !== 'personalized') return null;

    const userByCity = new Map<string, UserCityActivityRow>();
    for (const row of params.userRows) {
      const key = this.normalizeScopeFilter(row.cityId) ?? this.normalizeScopeFilter(row.cityName) ?? '__null__';
      userByCity.set(key, row);
    }
    const maxBase = Math.max(0, ...params.userRows.map((row) => row.baseCount));
    const items = params.cities.slice(0, 5).map((city) => {
      const key = this.normalizeScopeFilter(city.cityId) ?? this.normalizeScopeFilter(city.cityName) ?? '__null__';
      const userRow = userByCity.get(key);
      const baseCount = userRow?.baseCount ?? 0;
      const completedCount = userRow?.completedCount ?? 0;
      const reliability = this.resolveFitReliability({
        marketValue: city.requestCount,
        userBaseCount: baseCount,
        userCompletedCount: completedCount,
      });
      const userActivity = this.toActivityLevel(baseCount, maxBase);
      const userConversion = baseCount > 0 ? this.computeRate(completedCount, baseCount) : null;
      const actionCode =
        reliability === 'high' &&
        city.requestCount >= 10 &&
        (userActivity === 'low' || userActivity === 'unknown')
          ? 'focus_market'
          : null;
      const recommendation =
        reliability === 'unknown'
          ? 'Für diese Stadt liegen noch keine belastbaren Vergleichsdaten vor.'
          : reliability === 'low'
            ? 'Es gibt erste Marktsignale, aber noch keine belastbare Positionsbestimmung.'
            : actionCode === 'focus_market'
              ? `${city.cityName} bietet Marktvolumen, deine Präsenz ist hier aber noch ausbaufähig.`
              : 'Deine Aktivität liegt hier näher am Marktniveau.';

      return {
        cityId: city.cityId,
        city: city.cityName,
        marketRequests: city.requestCount,
        reliability,
        userActivity,
        userConversion,
        actionCode,
        recommendation,
      };
    });

    return {
      title: 'Städtevergleich',
      subtitle: 'Marktvolumen vs. deine Aktivität in relevanten Städten.',
      hasReliableItems: items.some((item) => item.reliability === 'high' || item.reliability === 'medium'),
      items,
    };
  }

  private toProfitPotentialStatus(
    score: number | null,
  ): WorkspaceStatisticsPriceIntelligenceDto['profitPotentialStatus'] {
    if (typeof score !== 'number' || !Number.isFinite(score)) return null;
    if (score >= 7.5) return 'high';
    if (score >= 5.5) return 'medium';
    return 'low';
  }

  private buildPriceIntelligence(params: {
    avgRevenue: number | null;
    topOpportunity: {
      citySlug: string;
      city: string;
      demand: number;
      score: number;
      demandScore: number;
      competitionScore: number;
    } | null;
    topCategoryKey: string | null;
    topCategoryLabel: string | null;
  }): WorkspaceStatisticsPriceIntelligenceDto {
    const base = {
      citySlug: params.topOpportunity?.citySlug ?? null,
      city: params.topOpportunity?.city ?? null,
      categoryKey: params.topCategoryKey,
      category: params.topCategoryLabel,
    } as const;

    const opportunityScore =
      typeof params.topOpportunity?.score === 'number' && Number.isFinite(params.topOpportunity.score)
        ? Math.max(0, Math.min(10, params.topOpportunity.score))
        : null;
    const demandFactor =
      typeof params.topOpportunity?.demandScore === 'number' && Number.isFinite(params.topOpportunity.demandScore)
        ? Math.max(0.35, Math.min(1.25, params.topOpportunity.demandScore / 10))
        : 0.75;
    const competitionFactor =
      typeof params.topOpportunity?.competitionScore === 'number' && Number.isFinite(params.topOpportunity.competitionScore)
        ? Math.max(0.45, Math.min(1.35, params.topOpportunity.competitionScore / 10))
        : 0.8;

    const hasAverageRevenue =
      typeof params.avgRevenue === 'number' && Number.isFinite(params.avgRevenue) && params.avgRevenue > 0;
    const averageRevenueValue = hasAverageRevenue ? params.avgRevenue : null;
    const recommendedMin =
      averageRevenueValue !== null ? this.roundToNearestStep(averageRevenueValue * 0.85, 5) : null;
    const recommendedMax =
      averageRevenueValue !== null ? this.roundToNearestStep(averageRevenueValue * 1.15, 5) : null;
    const marketAverage =
      averageRevenueValue !== null ? this.roundToNearestStep(averageRevenueValue, 5) : null;
    const rangeSpan =
      typeof recommendedMin === 'number' && typeof recommendedMax === 'number'
        ? Math.max(0, recommendedMax - recommendedMin)
        : 0;
    const optimalMin =
      typeof recommendedMin === 'number' && rangeSpan > 0
        ? Math.max(0, Math.round(recommendedMin + rangeSpan * 0.35))
        : null;
    const optimalMax =
      typeof recommendedMin === 'number' && rangeSpan > 0
        ? Math.max(0, Math.round(recommendedMin + rangeSpan * 0.7))
        : null;
    const smartRecommendedPrice =
      typeof optimalMin === 'number' && typeof optimalMax === 'number'
        ? this.roundToNearestStep((optimalMin + optimalMax) / 2, 5)
        : null;
    const analyzedRequestsCount = params.topOpportunity?.demand ?? null;

    const recommendation =
      typeof optimalMin === 'number' && typeof optimalMax === 'number'
        ? `Preise im Bereich von ${this.formatCurrency(optimalMin)} – ${this.formatCurrency(optimalMax)} erzielen aktuell die höchste Abschlussrate${params.topOpportunity?.city ? ` in ${params.topOpportunity.city}` : ''}.`
        : null;

    const priceScore =
      typeof recommendedMin === 'number' &&
      typeof recommendedMax === 'number' &&
      typeof marketAverage === 'number' &&
      recommendedMax > recommendedMin
        ? (() => {
            const midpoint = (recommendedMin + recommendedMax) / 2;
            const halfRange = (recommendedMax - recommendedMin) / 2;
            const distance = Math.abs(marketAverage - midpoint);
            const normalized = Math.max(0, Math.min(1, 1 - (distance / Math.max(1, halfRange))));
            return 0.7 + normalized * 0.3;
          })()
        : 0.78;

    const profitPotentialScore =
      opportunityScore !== null
        ? Math.max(
            0,
            Math.min(
              10,
              Number(
                (
                  ((opportunityScore / 10) * priceScore * (0.72 + demandFactor * 0.28)) /
                  competitionFactor *
                  10
                ).toFixed(1),
              ),
            ),
          )
        : null;

    return {
      ...base,
      recommendedMin,
      recommendedMax,
      marketAverage,
      optimalMin,
      optimalMax,
      smartRecommendedPrice,
      smartSignalTone: this.resolvePriceSmartSignalTone({
        smartRecommendedPrice,
        marketAverage,
      }),
      analyzedRequestsCount,
      confidenceLevel: this.resolvePriceConfidenceLevel(analyzedRequestsCount),
      recommendation,
      profitPotentialScore,
      profitPotentialStatus: this.toProfitPotentialStatus(profitPotentialScore),
    };
  }

  private toMedian(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return this.roundMoney((sorted[middle - 1] + sorted[middle]) / 2);
    }
    return this.roundMoney(sorted[middle]);
  }

  private getPlatformTakeRatePercent(): number {
    const raw = Number(this.config.get('app.platformTakeRatePercent') ?? 10);
    if (!Number.isFinite(raw)) return 10;
    return Math.max(0, Math.min(100, this.roundMoney(raw)));
  }

  private toActivityTotals(points: Array<{ timestamp: string; requests: number; offers: number }>) {
    const requestsTotal = points.reduce((sum, point) => sum + (point.requests ?? 0), 0);
    const offersTotal = points.reduce((sum, point) => sum + (point.offers ?? 0), 0);
    const latest = points[points.length - 1] ?? null;
    const prev = points[points.length - 2] ?? null;

    const peak = points.reduce<{ timestamp: string; score: number } | null>((acc, point) => {
      const score = (point.requests ?? 0) + (point.offers ?? 0);
      if (!acc || score > acc.score) {
        return { timestamp: point.timestamp, score };
      }
      return acc;
    }, null);

    const bestWindow = points.reduce<{ timestamp: string; requests: number } | null>((acc, point) => {
      const requests = point.requests ?? 0;
      if (!acc || requests > acc.requests) {
        return { timestamp: point.timestamp, requests };
      }
      return acc;
    }, null);

    return {
      requestsTotal,
      offersTotal,
      latestRequests: latest?.requests ?? 0,
      latestOffers: latest?.offers ?? 0,
      previousRequests: prev?.requests ?? 0,
      previousOffers: prev?.offers ?? 0,
      peakTimestamp: peak?.timestamp ?? null,
      bestWindowTimestamp: bestWindow?.timestamp ?? null,
    };
  }

  private buildActivityComparisonSeries(params: {
    points: Array<{ timestamp: string }>;
    stepMs: number;
    rows: ActivityDateRow[];
  }): Array<number | null> {
    if (params.points.length === 0) return [];
    const startMs = new Date(params.points[0].timestamp).getTime();
    if (!Number.isFinite(startMs)) {
      return params.points.map(() => null);
    }

    const counts = Array.from({ length: params.points.length }, () => 0);
    for (const row of params.rows) {
      if (!row?.createdAt) continue;
      const ts = new Date(row.createdAt).getTime();
      if (!Number.isFinite(ts) || ts < startMs) continue;
      const index = Math.floor((ts - startMs) / params.stepMs);
      if (index < 0 || index >= counts.length) continue;
      counts[index] += 1;
    }

    const total = counts.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return params.points.map(() => null);
    return counts.map((value) => value);
  }

  private buildActivityComparison(params: {
    mode: 'platform' | 'personalized';
    marketPoints: Array<{ timestamp: string; requests: number; offers: number }>;
    stepMs: number;
    clientRows: ActivityDateRow[];
    providerRows: ActivityDateRow[];
    activityTotals: WorkspaceStatisticsOverviewResponseDto['activity']['totals'];
    updatedAt: string;
  }): WorkspaceStatisticsActivityComparisonDto | null {
    if (params.mode !== 'personalized') return null;

    const clientSeries = this.buildActivityComparisonSeries({
      points: params.marketPoints,
      stepMs: params.stepMs,
      rows: params.clientRows,
    });
    const providerSeries = this.buildActivityComparisonSeries({
      points: params.marketPoints,
      stepMs: params.stepMs,
      rows: params.providerRows,
    });

    const totalClientActivity = clientSeries.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const totalProviderActivity = providerSeries.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const hasReliableSeries = totalClientActivity > 0 || totalProviderActivity > 0;

    const combinedSeries = params.marketPoints.map((point, index) => ({
      timestamp: point.timestamp,
      score: (clientSeries[index] ?? 0) + (providerSeries[index] ?? 0),
    }));
    const userPeak = combinedSeries.reduce<{ timestamp: string; score: number } | null>((acc, point) => {
      if (!acc || point.score > acc.score) return point;
      return acc;
    }, null);

    const summary = !hasReliableSeries
      ? 'Noch keine eigene Aktivität im gewählten Zeitraum.'
      : userPeak?.timestamp && params.activityTotals.peakTimestamp && userPeak.timestamp === params.activityTotals.peakTimestamp
        ? 'Deine Aktivität trifft aktuell den Marktpeak.'
        : 'Deine stärkste Aktivität liegt aktuell außerhalb des Marktpeaks.';

    return {
      title: 'Aktivität der Plattform',
      subtitle: 'Neue Anfragen und Angebote im Zeitverlauf',
      summary,
      peakTimestamp: params.activityTotals.peakTimestamp,
      bestWindowTimestamp: params.activityTotals.bestWindowTimestamp,
      updatedAt: params.updatedAt,
      hasReliableSeries,
      points: params.marketPoints.map((point, index) => ({
        timestamp: point.timestamp,
        clientActivity: clientSeries[index] ?? null,
        providerActivity: providerSeries[index] ?? null,
      })),
    };
  }

  private slugifyCityName(cityName: string): string {
    return cityName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private calculateDistanceKm(
    from: { lat: number | null; lng: number | null } | null,
    to: { lat: number | null; lng: number | null } | null,
  ): number | null {
    if (!from || !to) return null;
    if (from.lat === null || from.lng === null || to.lat === null || to.lng === null) return null;

    const earthRadiusKm = 6371;
    const latDelta = this.toRadians(to.lat - from.lat);
    const lngDelta = this.toRadians(to.lng - from.lng);
    const originLat = this.toRadians(from.lat);
    const destinationLat = this.toRadians(to.lat);

    const a =
      (Math.sin(latDelta / 2) ** 2) +
      (Math.cos(originLat) * Math.cos(destinationLat) * (Math.sin(lngDelta / 2) ** 2));
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.roundPercent(earthRadiusKm * c);
  }

  private cityScopeKey(city: { cityId: string | null; citySlug: string }): string {
    return this.cityIdKey(city.cityId) || this.citySlugKey(city.citySlug);
  }

  private buildRankedCityCandidates(params: {
    cities: WorkspaceStatisticsCityDemandDto[];
    providersActiveByCityKey: Map<string, number>;
    growthIndex: number;
    responseSpeedIndex: number;
  }): RankedCityOpportunityCandidate[] {
    const demandByCity = params.cities.map((city) => Math.max(city.requestCount, city.anbieterSuchenCount ?? 0));
    const maxDemand = Math.max(1, ...demandByCity);

    return params.cities.map((city) => {
      const demand = Math.max(city.requestCount, city.anbieterSuchenCount ?? 0);
      const providers = city.auftragSuchenCount;
      const marketBalanceRatio = city.marketBalanceRatio;
      const demandIndex = this.clampUnit(demand / maxDemand);
      const competitionOpportunityIndex = marketBalanceRatio === null
        ? 0.5
        : this.clampUnit(marketBalanceRatio / 1.5);

      const demandScore = this.roundScore(demandIndex * 10);
      const competitionScore = this.roundScore(competitionOpportunityIndex * 10);
      const growthScore = this.roundScore(params.growthIndex * 10);
      const activityScore = this.roundScore(params.responseSpeedIndex * 10);
      const competitionPressureScore = this.roundScore(10 - competitionScore);
      const score = this.roundScore(10 * (
        (demandIndex * 0.4) +
        (competitionOpportunityIndex * 0.3) +
        (params.growthIndex * 0.2) +
        (params.responseSpeedIndex * 0.1)
      ));
      const status = this.resolveOpportunityStatus(score);
      const metricsBase: Array<{ key: WorkspaceStatisticsOpportunityMetricDto['key']; value: number }> = [
        { key: 'demand', value: demandScore },
        { key: 'competition', value: competitionPressureScore },
        { key: 'growth', value: growthScore },
        { key: 'activity', value: activityScore },
      ];

      return {
        citySlug: city.citySlug,
        cityName: city.cityName,
        cityId: city.cityId,
        requestCount: city.requestCount,
        auftragSuchenCount: city.auftragSuchenCount,
        anbieterSuchenCount: city.anbieterSuchenCount,
        providersActive: params.providersActiveByCityKey.get(this.cityScopeKey(city)) ?? null,
        marketBalanceRatio,
        signal: city.signal,
        lat: city.lat,
        lng: city.lng,
        score,
        demand,
        providers,
        demandScore,
        competitionScore,
        growthScore,
        activityScore,
        status,
        tone: this.resolveOpportunityTone(status),
        summaryKey: this.resolveOpportunitySummaryKey({
          status,
          demand: demandScore,
          competition: competitionPressureScore,
          growth: growthScore,
          activity: activityScore,
        }),
        metrics: metricsBase.map((metric) => ({
          ...metric,
          ...this.resolveOpportunityMetricSemantic(metric),
        })),
      };
    });
  }

  private paginateCityList(params: {
    cities: WorkspaceStatisticsCityDemandDto[];
    page: number;
    limit: number;
  }): {
    items: WorkspaceStatisticsCityDemandDto[];
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  } {
    const totalItems = params.cities.length;
    const limit = Math.min(
      WorkspaceStatisticsService.CITY_LIST_MAX_LIMIT,
      Math.max(1, Math.trunc(params.limit)),
    );
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const page = Math.min(totalPages, Math.max(1, Math.trunc(params.page)));
    const startIndex = (page - 1) * limit;

    return {
      items: params.cities.slice(startIndex, startIndex + limit),
      page,
      limit,
      totalItems,
      totalPages,
    };
  }

  private selectScopedCityRows(params: {
    rankedCandidates: RankedCityOpportunityCandidate[];
    cityId: string | null;
  }): {
    cities: WorkspaceStatisticsCityDemandDto[];
    opportunityCluster: RankedCityOpportunityCandidate[];
  } {
    const ranked = params.rankedCandidates
      .slice()
      .sort((a, b) => (b.score - a.score) || (b.demand - a.demand) || a.cityName.localeCompare(b.cityName, 'de-DE'));

    if (!params.cityId) {
      const cities = ranked.map((city, index) => ({
        citySlug: city.citySlug,
        cityName: city.cityName,
        cityId: city.cityId,
        requestCount: city.requestCount,
        auftragSuchenCount: city.auftragSuchenCount,
        anbieterSuchenCount: city.anbieterSuchenCount,
        providersActive: city.providersActive,
        marketBalanceRatio: city.marketBalanceRatio,
        score: city.score,
        rank: index + 1,
        signal: city.signal,
        lat: city.lat,
        lng: city.lng,
        peerContext: null,
      }));

      return {
        cities,
        opportunityCluster: ranked.slice(0, 3),
      };
    }

    const focus = ranked.find((city) => city.cityId === params.cityId || city.citySlug === params.cityId) ?? null;
    if (!focus) {
      return {
        cities: [],
        opportunityCluster: [],
      };
    }

    const scoped = [
      focus,
      ...ranked.filter((city) => {
        if (this.cityScopeKey(city) === this.cityScopeKey(focus)) return false;
        const distanceKm = this.calculateDistanceKm(focus, city);
        return distanceKm !== null && distanceKm <= 50;
      }),
    ].sort((a, b) => (b.score - a.score) || (b.demand - a.demand) || a.cityName.localeCompare(b.cityName, 'de-DE'));

    const focusIndex = scoped.findIndex((city) => this.cityScopeKey(city) === this.cityScopeKey(focus));
    const higher = focusIndex > 0 ? scoped.slice(0, focusIndex).reverse() : [];
    const lower = focusIndex >= 0 ? scoped.slice(focusIndex + 1) : [];
    const competitors: RankedCityOpportunityCandidate[] = [];

    for (const candidate of higher) {
      if (competitors.length >= 2) break;
      competitors.push(candidate);
    }
    for (const candidate of lower) {
      if (competitors.length >= 2) break;
      competitors.push(candidate);
    }

    const competitorKeys = new Set(competitors.map((city) => this.cityScopeKey(city)));
    const cities = scoped.map((city, index) => {
      let peerContext: WorkspaceStatisticsOpportunityPeerContextDto | null = null;
      if (this.cityScopeKey(city) === this.cityScopeKey(focus)) {
        peerContext = { role: 'focus', reason: 'selected_city', distanceKm: null };
      } else if (competitorKeys.has(this.cityScopeKey(city))) {
        peerContext = {
          role: 'competitor',
          reason: 'nearby_competitor',
          distanceKm: this.calculateDistanceKm(focus, city),
        };
      }

      return {
        citySlug: city.citySlug,
        cityName: city.cityName,
        cityId: city.cityId,
        requestCount: city.requestCount,
        auftragSuchenCount: city.auftragSuchenCount,
        anbieterSuchenCount: city.anbieterSuchenCount,
        providersActive: city.providersActive,
        marketBalanceRatio: city.marketBalanceRatio,
        score: city.score,
        rank: index + 1,
        signal: city.signal,
        lat: city.lat,
        lng: city.lng,
        peerContext,
      };
    });

    return {
      cities,
      opportunityCluster: [focus, ...competitors].slice(0, 3),
    };
  }

  private buildOpportunityRadarFromCluster(params: {
    cluster: RankedCityOpportunityCandidate[];
    focusCityId: string | null;
    categoryKey: string | null;
    categoryLabel: string | null;
    avgRevenue: number | null;
  }): WorkspaceStatisticsOpportunityRadarItemDto[] {
    if (params.cluster.length === 0) return [];
    const focus = params.focusCityId
      ? params.cluster.find((city) => city.cityId === params.focusCityId || city.citySlug === params.focusCityId) ?? params.cluster[0]
      : params.cluster[0];

    return params.cluster.slice(0, 3).map((city, index) => {
      const peerContext: WorkspaceStatisticsOpportunityPeerContextDto = params.focusCityId
        ? {
          role: index === 0 ? 'focus' : 'competitor',
          reason: index === 0 ? 'selected_city' : 'nearby_competitor',
          distanceKm: index === 0 ? null : this.calculateDistanceKm(focus, city),
        }
        : {
          role: index === 0 ? 'focus' : 'competitor',
          reason: 'top_ranked',
          distanceKm: null,
        };

      return {
        rank: (index + 1) as 1 | 2 | 3,
        cityId: city.cityId,
        city: city.cityName,
        categoryKey: params.categoryKey,
        category: params.categoryLabel,
        demand: city.demand,
        providers: city.providers ?? city.providersActive,
        marketBalanceRatio: city.marketBalanceRatio,
        score: city.score,
        demandScore: city.demandScore,
        competitionScore: city.competitionScore,
        growthScore: city.growthScore,
        activityScore: city.activityScore,
        status: city.status,
        tone: city.tone,
        summaryKey: city.summaryKey,
        metrics: city.metrics,
        peerContext,
        priceIntelligence: this.buildPriceIntelligence({
          avgRevenue: params.avgRevenue,
          topOpportunity: {
            citySlug: city.citySlug,
            city: city.cityName,
            demand: city.demand,
            score: city.score,
            demandScore: city.demandScore,
            competitionScore: city.competitionScore,
          },
          topCategoryKey: params.categoryKey,
          topCategoryLabel: params.categoryLabel,
        }),
      };
    });
  }

  private buildGrowthCards() {
    return [
      { key: 'highlight_profile', href: '/workspace?section=profile' },
      { key: 'local_ads', href: '/workspace?section=requests' },
      { key: 'premium_tools', href: '/provider/onboarding' },
    ];
  }

  private toCategorySnapshot(
    categories: WorkspaceStatisticsCategoryDemandDto[],
  ): AnalyticsSnapshot['categories'] {
    return categories.map((item) => ({
      categoryKey: item.categoryKey ?? item.categoryName.toLowerCase().replace(/\s+/g, '-'),
      categoryLabel: item.categoryName,
      requests: item.requestCount,
      offers: 0,
      activeProviders: 0,
      growthPercentVsPrevPeriod: null,
      searchCount: 0,
      providerSearchCount: 0,
      demandSharePercent: item.sharePercent,
    }));
  }

  private toCitySnapshot(cities: WorkspaceStatisticsCityDemandDto[]): AnalyticsSnapshot['cities'] {
    return cities.map((item) => {
      const requestSearchCount =
        typeof item.auftragSuchenCount === 'number' && Number.isFinite(item.auftragSuchenCount)
          ? Math.max(0, Math.round(item.auftragSuchenCount))
          : 0;
      const providerSearchCount =
        typeof item.anbieterSuchenCount === 'number' && Number.isFinite(item.anbieterSuchenCount)
          ? Math.max(0, Math.round(item.anbieterSuchenCount))
          : 0;

      const demandSupplyRatio = requestSearchCount > 0
        ? this.roundPercent(providerSearchCount / Math.max(1, requestSearchCount))
        : providerSearchCount > 0
          ? this.roundPercent(providerSearchCount)
          : null;

      const offerCoverageRate = item.requestCount > 0
        ? this.clampPercent((requestSearchCount / Math.max(1, item.requestCount)) * 100)
        : null;

      return {
        cityKey: item.citySlug,
        cityLabel: item.cityName,
        requests: item.requestCount,
        offers: requestSearchCount,
        activeProviders:
          typeof item.providersActive === 'number' && Number.isFinite(item.providersActive)
            ? Math.max(0, Math.round(item.providersActive))
            : 0,
        serviceSearchCount: requestSearchCount,
        providerSearchCount,
        growthPercentVsPrevPeriod: null,
        demandSupplyRatio,
        offerCoverageRate,
      };
    });
  }

  private hasCitySearchSignals(cities: WorkspaceStatisticsCityDemandDto[]): boolean {
    return cities.some(
      (city) => {
        const requestSearchCount =
          typeof city.auftragSuchenCount === 'number' && Number.isFinite(city.auftragSuchenCount)
            ? city.auftragSuchenCount
            : 0;
        const providerSearchCount =
          typeof city.anbieterSuchenCount === 'number' && Number.isFinite(city.anbieterSuchenCount)
            ? city.anbieterSuchenCount
            : 0;
        return requestSearchCount > 0 || providerSearchCount > 0;
      },
    );
  }

  private toOptionalCount(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.max(0, Math.round(value));
  }

  private resolveCitySearchMetrics(params: {
    requestCount: number;
    auftragSuchenCount: number | null | undefined;
    anbieterSuchenCount: number | null | undefined;
  }): Pick<WorkspaceStatisticsCityDemandDto, 'auftragSuchenCount' | 'anbieterSuchenCount' | 'marketBalanceRatio' | 'signal'> {
    const requestCount = Math.max(0, Math.round(params.requestCount ?? 0));
    let auftragSuchenCount = this.toOptionalCount(params.auftragSuchenCount);
    let anbieterSuchenCount = this.toOptionalCount(params.anbieterSuchenCount);

    const hasAnySignal = auftragSuchenCount !== null || anbieterSuchenCount !== null;
    if (!hasAnySignal) {
      return {
        auftragSuchenCount: null,
        anbieterSuchenCount: null,
        marketBalanceRatio: null,
        signal: 'none',
      };
    }

    if (auftragSuchenCount === null) {
      const proxySupply = requestCount > 0 ? requestCount : Math.max(0, anbieterSuchenCount ?? 0);
      auftragSuchenCount = Math.max(1, proxySupply);
    }

    if (anbieterSuchenCount === null) {
      const proxyDemand = requestCount > 0 ? requestCount : Math.max(0, auftragSuchenCount ?? 0);
      anbieterSuchenCount = Math.max(1, proxyDemand);
    }

    const demandActivity = Math.max(0, anbieterSuchenCount) || Math.max(0, requestCount);
    const supplyActivity = Math.max(0, auftragSuchenCount);
    const marketBalanceRatio =
      demandActivity <= 0 && supplyActivity <= 0
        ? null
        : this.roundPercent(demandActivity / Math.max(1, supplyActivity));
    const signal = marketBalanceRatio === null
      ? 'none'
      : this.resolveCitySignal({ demandActivity, supplyActivity });

    return {
      auftragSuchenCount,
      anbieterSuchenCount,
      marketBalanceRatio,
      signal,
    };
  }

  private hasIncompleteCitySearchSignals(cities: WorkspaceStatisticsCityDemandDto[]): boolean {
    return cities.some((city) => {
      if (city.requestCount <= 0) return false;
      const hasRequestSearchCount =
        typeof city.auftragSuchenCount === 'number' && Number.isFinite(city.auftragSuchenCount);
      const hasProviderSearchCount =
        typeof city.anbieterSuchenCount === 'number' && Number.isFinite(city.anbieterSuchenCount);
      return !hasRequestSearchCount || !hasProviderSearchCount;
    });
  }

  private hasPriceSignal(priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto): boolean {
    return (
      Number.isFinite(priceIntelligence.marketAverage) ||
      Number.isFinite(priceIntelligence.recommendedMin) ||
      Number.isFinite(priceIntelligence.recommendedMax)
    );
  }

  private hasProfitPotentialSignal(priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto): boolean {
    return Number.isFinite(priceIntelligence.profitPotentialScore);
  }

  private hasOpportunityCategoryData(opportunityRadar: WorkspaceStatisticsOpportunityRadarItemDto[]): boolean {
    return opportunityRadar.some((item) => Boolean(item.categoryKey || item.category));
  }

  private cityIdKey(value: string | null | undefined): string {
    return String(value ?? '').trim();
  }

  private citySlugKey(value: string | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private cityNameKey(value: string | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private mergeCityRankingWithPublicOverview(params: {
    statsCities: WorkspaceStatisticsCityDemandDto[];
    publicCities: WorkspacePublicCityActivityItemDto[];
  }): WorkspaceStatisticsCityDemandDto[] {
    if (params.publicCities.length === 0) return params.statsCities;

    const statsById = new Map<string, WorkspaceStatisticsCityDemandDto>();
    const statsBySlug = new Map<string, WorkspaceStatisticsCityDemandDto>();
    const statsByName = new Map<string, WorkspaceStatisticsCityDemandDto>();
    for (const city of params.statsCities) {
      const cityId = this.cityIdKey(city.cityId);
      const citySlug = this.citySlugKey(city.citySlug);
      const cityName = this.cityNameKey(city.cityName);
      if (cityId.length > 0 && !statsById.has(cityId)) statsById.set(cityId, city);
      if (citySlug.length > 0 && !statsBySlug.has(citySlug)) statsBySlug.set(citySlug, city);
      if (cityName.length > 0 && !statsByName.has(cityName)) statsByName.set(cityName, city);
    }

    return params.publicCities
      .slice()
      .sort((a, b) => b.requestCount - a.requestCount)
      .map((publicCity) => {
        const publicCityId = this.cityIdKey(publicCity.cityId);
        const publicCitySlug = this.citySlugKey(publicCity.citySlug);
        const publicCityName = this.cityNameKey(publicCity.cityName);
        const statsCity =
          (publicCityId.length > 0 ? statsById.get(publicCityId) : undefined) ??
          (publicCitySlug.length > 0 ? statsBySlug.get(publicCitySlug) : undefined) ??
          (publicCityName.length > 0 ? statsByName.get(publicCityName) : undefined);

        const metrics = this.resolveCitySearchMetrics({
          requestCount: publicCity.requestCount,
          auftragSuchenCount: statsCity?.auftragSuchenCount ?? null,
          anbieterSuchenCount: statsCity?.anbieterSuchenCount ?? null,
        });
        const marketBalanceRatio =
          typeof statsCity?.marketBalanceRatio === 'number' && Number.isFinite(statsCity.marketBalanceRatio)
            ? statsCity.marketBalanceRatio
            : metrics.marketBalanceRatio;

        return {
          citySlug: publicCity.citySlug,
          cityName: publicCity.cityName,
          cityId: publicCity.cityId,
          requestCount: Math.max(0, Math.round(publicCity.requestCount ?? 0)),
          auftragSuchenCount: metrics.auftragSuchenCount,
          anbieterSuchenCount: metrics.anbieterSuchenCount,
          marketBalanceRatio,
          signal: statsCity?.signal ?? metrics.signal,
          lat: publicCity.lat,
          lng: publicCity.lng,
        };
      });
  }

  private mergeCitySearchSignals(
    cities: WorkspaceStatisticsCityDemandDto[],
    baselineCities: WorkspaceStatisticsCityDemandDto[],
  ): WorkspaceStatisticsCityDemandDto[] {
    if (cities.length === 0) return baselineCities.slice();
    if (baselineCities.length === 0) return cities;

    const baselineById = new Map<string, WorkspaceStatisticsCityDemandDto>();
    const baselineBySlug = new Map<string, WorkspaceStatisticsCityDemandDto>();
    const baselineByName = new Map<string, WorkspaceStatisticsCityDemandDto>();
    for (const city of baselineCities) {
      const cityId = this.cityIdKey(city.cityId);
      const citySlug = this.citySlugKey(city.citySlug);
      const cityName = this.cityNameKey(city.cityName);
      if (cityId.length > 0 && !baselineById.has(cityId)) baselineById.set(cityId, city);
      if (citySlug.length > 0 && !baselineBySlug.has(citySlug)) baselineBySlug.set(citySlug, city);
      if (cityName.length > 0 && !baselineByName.has(cityName)) baselineByName.set(cityName, city);
    }

    return cities.map((city) => {
      const cityId = this.cityIdKey(city.cityId);
      const citySlug = this.citySlugKey(city.citySlug);
      const cityName = this.cityNameKey(city.cityName);
      const baseline =
        (cityId.length > 0 ? baselineById.get(cityId) : undefined) ??
        (citySlug.length > 0 ? baselineBySlug.get(citySlug) : undefined) ??
        (cityName.length > 0 ? baselineByName.get(cityName) : undefined);
      if (!baseline) return city;
      const cityRequestSearchCount =
        typeof city.auftragSuchenCount === 'number' && Number.isFinite(city.auftragSuchenCount)
          ? city.auftragSuchenCount
          : null;
      const cityProviderSearchCount =
        typeof city.anbieterSuchenCount === 'number' && Number.isFinite(city.anbieterSuchenCount)
          ? city.anbieterSuchenCount
          : null;
      const baselineRequestSearchCount =
        typeof baseline.auftragSuchenCount === 'number' && Number.isFinite(baseline.auftragSuchenCount)
          ? baseline.auftragSuchenCount
          : null;
      const baselineProviderSearchCount =
        typeof baseline.anbieterSuchenCount === 'number' && Number.isFinite(baseline.anbieterSuchenCount)
          ? baseline.anbieterSuchenCount
          : null;
      const auftragSuchenCount =
        typeof cityRequestSearchCount === 'number' && typeof baselineRequestSearchCount === 'number'
          ? Math.max(cityRequestSearchCount, baselineRequestSearchCount)
          : cityRequestSearchCount ?? baselineRequestSearchCount;
      const anbieterSuchenCount =
        typeof cityProviderSearchCount === 'number' && typeof baselineProviderSearchCount === 'number'
          ? Math.max(cityProviderSearchCount, baselineProviderSearchCount)
          : cityProviderSearchCount ?? baselineProviderSearchCount;
      const metrics = this.resolveCitySearchMetrics({
        requestCount: city.requestCount,
        auftragSuchenCount,
        anbieterSuchenCount,
      });

      return {
        ...city,
        auftragSuchenCount: metrics.auftragSuchenCount,
        anbieterSuchenCount: metrics.anbieterSuchenCount,
        marketBalanceRatio: metrics.marketBalanceRatio,
        signal: metrics.signal,
      };
    });
  }

  private buildInsightsSnapshot(params: {
    range: WorkspaceStatisticsRange;
    updatedAt: string;
    mode: 'platform' | 'personalized';
    role?: AppRole | null;
    summary: WorkspaceStatisticsOverviewResponseDto['summary'];
    kpis: WorkspaceStatisticsOverviewResponseDto['kpis'];
    categories: WorkspaceStatisticsCategoryDemandDto[];
    cities: WorkspaceStatisticsCityDemandDto[];
    activityMetrics: WorkspaceStatisticsOverviewResponseDto['activity']['metrics'];
    profileFunnel: WorkspaceStatisticsProfileFunnelDto;
  }): AnalyticsSnapshot {
    const role = params.mode === 'personalized'
      ? params.role === 'provider' || params.role === 'client'
        ? params.role
        : 'provider'
      : 'guest';

    return {
      period: params.range,
      generatedAt: params.updatedAt,
      market: {
        totalRequests: params.kpis.requestsTotal,
        totalOffers: params.kpis.offersTotal,
        totalContracts: params.profileFunnel.closedContractsTotal,
        totalCompleted: params.profileFunnel.completedJobsTotal,
        totalRevenue: params.profileFunnel.profitAmount,
        averageRating: params.summary.platformRatingAvg > 0 ? params.summary.platformRatingAvg : null,
        activeProviders: params.summary.totalActiveProviders,
        activeCities: params.summary.totalActiveCities,
        unansweredRequestsOver24h: params.activityMetrics.unansweredRequests24h,
        medianResponseTimeMinutes: params.activityMetrics.responseMedianMinutes,
        successRatePercent: params.kpis.successRate,
      },
      categories: this.toCategorySnapshot(params.categories),
      cities: this.toCitySnapshot(params.cities),
      user: params.mode === 'personalized'
        ? {
            role,
            profileCompleteness: params.kpis.profileCompleteness ?? 0,
            hasProfilePhoto: true,
            rating: null,
            reviewCount: 0,
            medianResponseTimeMinutes: params.kpis.avgResponseMinutes,
            offersSent: params.profileFunnel.offersTotal,
            confirmations: params.profileFunnel.confirmedResponsesTotal,
            contracts: params.profileFunnel.closedContractsTotal,
            completed: params.profileFunnel.completedJobsTotal,
            revenue: params.profileFunnel.profitAmount,
            profileViews: 0,
            profileViewsGrowthPercent: null,
          }
        : undefined,
    };
  }

  async getStatisticsOverview(
    query: WorkspaceStatisticsRange | WorkspaceStatisticsQueryDto | undefined,
    userId?: string | null,
    role?: AppRole | null,
  ): Promise<WorkspaceStatisticsOverviewResponseDto> {
    const {
      range,
      cityId,
      regionId,
      categoryKey,
      subcategoryKey,
      citiesPage,
      citiesLimit,
      viewerMode: requestedViewerMode,
    } = this.resolveFilters(query);
    const { start, end } = this.resolveWindow(range);
    const filterOptionsRange = this.resolveFilterOptionsRange(range);
    const { start: filterOptionsStart, end: filterOptionsEnd } =
      filterOptionsRange === range ? { start, end } : this.resolveWindow(filterOptionsRange);
    const normalizedUserId = String(userId ?? '').trim();
    const hasActorScope = normalizedUserId.length > 0;
    const hasDecisionScope = Boolean(cityId || regionId || categoryKey || subcategoryKey);
    const viewerMode = hasActorScope ? this.resolveViewerMode(requestedViewerMode, role) : null;

    const requestFunnelMatch = hasActorScope
      ? { clientId: normalizedUserId }
      : { status: 'published' };
    const offerFunnelMatch = hasActorScope
      ? { $or: [{ providerUserId: normalizedUserId }, { clientUserId: normalizedUserId }] }
      : {};
    const contractFunnelMatch = hasActorScope
      ? { $or: [{ providerUserId: normalizedUserId }, { clientId: normalizedUserId }] }
      : {};
    const scopedRequestMatch: Record<string, unknown> = {
      status: 'published',
      createdAt: { $gte: start, $lte: end },
    };
    if (cityId) scopedRequestMatch.cityId = cityId;
    if (categoryKey) scopedRequestMatch.categoryKey = categoryKey;
    if (subcategoryKey) scopedRequestMatch.serviceKey = subcategoryKey;
    const requestRefScopeMatch: Record<string, unknown> = {};
    if (cityId) requestRefScopeMatch['requestRef.cityId'] = cityId;
    if (categoryKey) requestRefScopeMatch['requestRef.categoryKey'] = categoryKey;
    if (subcategoryKey) requestRefScopeMatch['requestRef.serviceKey'] = subcategoryKey;
    const funnelRequestRefScopeMatch: Record<string, unknown> = {
      'requestRef.createdAt': { $gte: start, $lte: end },
      ...requestRefScopeMatch,
    };

    const marketFunnelRequestsPromise = hasActorScope
      ? this.requestModel.countDocuments({
          ...(cityId ? { cityId } : {}),
          ...(categoryKey ? { categoryKey } : {}),
          ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
          createdAt: { $gte: start, $lte: end },
        })
      : Promise.resolve<number | null>(null);

    const marketFunnelOffersPromise = hasActorScope
      ? this.offerModel
          .aggregate<{ _id: null; offersTotal: number; confirmedResponsesTotal: number }>([
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      createdAt: '$createdAt',
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            { $match: funnelRequestRefScopeMatch },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedResponse: {
                  $max: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                offersTotal: { $sum: 1 },
                confirmedResponsesTotal: { $sum: '$hasAcceptedResponse' },
              },
            },
          ])
          .exec()
      : Promise.resolve<Array<{ _id: null; offersTotal: number; confirmedResponsesTotal: number }> | null>(null);

    const marketFunnelContractsPromise = hasActorScope
      ? this.contractModel
          .aggregate<{ _id: null; closedContractsTotal: number; completedJobsTotal: number; profitAmount: number }>([
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      createdAt: '$createdAt',
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            { $match: funnelRequestRefScopeMatch },
            {
              $lookup: {
                from: 'offers',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$requestId', '$$requestId'] },
                          { $eq: ['$status', 'accepted'] },
                        ],
                      },
                    },
                  },
                  { $limit: 1 },
                ],
                as: 'acceptedOfferRef',
              },
            },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedResponse: {
                  $max: {
                    $cond: [{ $gt: [{ $size: '$acceptedOfferRef' }, 0] }, 1, 0],
                  },
                },
                hasContract: {
                  $max: {
                    $cond: [
                      { $in: ['$status', ['confirmed', 'in_progress', 'completed']] },
                      1,
                      0,
                    ],
                  },
                },
                hasCompleted: {
                  $max: {
                    $cond: [
                      { $eq: ['$status', 'completed'] },
                      1,
                      0,
                    ],
                  },
                },
                completedRevenue: {
                  $max: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$status', 'completed'] },
                          { $ne: ['$priceAmount', null] },
                          { $gt: ['$priceAmount', 0] },
                        ],
                      },
                      '$priceAmount',
                      0,
                    ],
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                closedContractsTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasContract', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                completedJobsTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                profitAmount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      '$completedRevenue',
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .exec()
      : Promise.resolve<Array<{ _id: null; closedContractsTotal: number; completedJobsTotal: number; profitAmount: number }> | null>(null);

    const providerFunnelOffersPromise = hasActorScope && viewerMode === 'provider'
      ? this.offerModel
          .aggregate<{ _id: null; requestsTotal: number; offersTotal: number; confirmedResponsesTotal: number }>([
            {
              $match: {
                providerUserId: normalizedUserId,
              },
            },
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      createdAt: '$createdAt',
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            { $match: funnelRequestRefScopeMatch },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedResponse: {
                  $max: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
            {
              $group: {
                _id: 1,
                requestsTotal: { $sum: 1 },
                offersTotal: { $sum: 1 },
                confirmedResponsesTotal: { $sum: '$hasAcceptedResponse' },
              },
            },
          ])
          .exec()
      : Promise.resolve<Array<{ _id: null; requestsTotal: number; offersTotal: number; confirmedResponsesTotal: number }> | null>(null);

    const providerFunnelContractsPromise = hasActorScope && viewerMode === 'provider'
      ? this.contractModel
          .aggregate<{ _id: null; contractsTotal: number; completedTotal: number; revenueAmount: number }>([
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      createdAt: '$createdAt',
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            { $match: funnelRequestRefScopeMatch },
            {
              $match: {
                providerUserId: normalizedUserId,
              },
            },
            {
              $lookup: {
                from: 'offers',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      providerUserId: normalizedUserId,
                      status: 'accepted',
                      $expr: { $eq: ['$requestId', '$$requestId'] },
                    },
                  },
                  { $limit: 1 },
                ],
                as: 'acceptedOfferRef',
              },
            },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedResponse: {
                  $max: {
                    $cond: [{ $gt: [{ $size: '$acceptedOfferRef' }, 0] }, 1, 0],
                  },
                },
                hasContract: {
                  $max: {
                    $cond: [
                      { $in: ['$status', ['confirmed', 'in_progress', 'completed']] },
                      1,
                      0,
                    ],
                  },
                },
                hasCompleted: {
                  $max: {
                    $cond: [
                      { $eq: ['$status', 'completed'] },
                      1,
                      0,
                    ],
                  },
                },
                completedRevenue: {
                  $max: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$status', 'completed'] },
                          { $ne: ['$priceAmount', null] },
                          { $gt: ['$priceAmount', 0] },
                        ],
                      },
                      '$priceAmount',
                      0,
                    ],
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                contractsTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasContract', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                completedTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                revenueAmount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      '$completedRevenue',
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .exec()
      : Promise.resolve<Array<{ _id: null; contractsTotal: number; completedTotal: number; revenueAmount: number }> | null>(null);

    const customerFunnelRequestsPromise = hasActorScope && viewerMode === 'customer'
      ? this.requestModel.countDocuments({
          clientId: normalizedUserId,
          ...(cityId ? { cityId } : {}),
          ...(categoryKey ? { categoryKey } : {}),
          ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
          createdAt: { $gte: start, $lte: end },
        })
      : Promise.resolve<number | null>(null);

    const customerFunnelOffersPromise = hasActorScope && viewerMode === 'customer'
      ? this.offerModel
          .aggregate<{ _id: null; offersTotal: number; acceptedOffersTotal: number }>([
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      createdAt: '$createdAt',
                      clientId: '$clientId',
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            {
              $match: {
                ...funnelRequestRefScopeMatch,
                'requestRef.clientId': normalizedUserId,
              },
            },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedOffer: {
                  $max: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                offersTotal: { $sum: 1 },
                acceptedOffersTotal: { $sum: '$hasAcceptedOffer' },
              },
            },
          ])
          .exec()
      : Promise.resolve<Array<{ _id: null; offersTotal: number; acceptedOffersTotal: number }> | null>(null);

    const customerFunnelContractsPromise = hasActorScope && viewerMode === 'customer'
      ? this.contractModel
          .aggregate<{ _id: null; contractsTotal: number; completedTotal: number; revenueAmount: number }>([
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      createdAt: '$createdAt',
                      clientId: '$clientId',
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            {
              $match: {
                ...funnelRequestRefScopeMatch,
                'requestRef.clientId': normalizedUserId,
              },
            },
            {
              $lookup: {
                from: 'offers',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      status: 'accepted',
                      $expr: { $eq: ['$requestId', '$$requestId'] },
                    },
                  },
                  { $limit: 1 },
                ],
                as: 'acceptedOfferRef',
              },
            },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedOffer: {
                  $max: {
                    $cond: [{ $gt: [{ $size: '$acceptedOfferRef' }, 0] }, 1, 0],
                  },
                },
                hasContract: {
                  $max: {
                    $cond: [
                      { $in: ['$status', ['confirmed', 'in_progress', 'completed']] },
                      1,
                      0,
                    ],
                  },
                },
                hasCompleted: {
                  $max: {
                    $cond: [
                      { $eq: ['$status', 'completed'] },
                      1,
                      0,
                    ],
                  },
                },
                completedRevenue: {
                  $max: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$status', 'completed'] },
                          { $ne: ['$priceAmount', null] },
                          { $gt: ['$priceAmount', 0] },
                        ],
                      },
                      '$priceAmount',
                      0,
                    ],
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                contractsTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedOffer', 1] },
                          { $eq: ['$hasContract', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                completedTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedOffer', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                revenueAmount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedOffer', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      '$completedRevenue',
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .exec()
      : Promise.resolve<Array<{ _id: null; contractsTotal: number; completedTotal: number; revenueAmount: number }> | null>(null);

    const providerCategoryActivityPromise = hasActorScope && viewerMode === 'provider'
      ? this.offerModel
          .aggregate<UserCategoryActivityRow>([
            {
              $match: {
                providerUserId: normalizedUserId,
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      categoryKey: '$categoryKey',
                      categoryName: '$categoryName',
                      cityId: '$cityId',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
            {
              $group: {
                _id: {
                  categoryKey: '$requestRef.categoryKey',
                  categoryName: '$requestRef.categoryName',
                },
                baseCount: { $sum: 1 },
                completedCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                categoryKey: '$_id.categoryKey',
                categoryName: '$_id.categoryName',
                baseCount: 1,
                completedCount: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<UserCategoryActivityRow[]>([]);

    const customerCategoryActivityPromise = hasActorScope && viewerMode === 'customer'
      ? this.requestModel
          .aggregate<UserCategoryActivityRow>([
            {
              $match: {
                clientId: normalizedUserId,
                ...(cityId ? { cityId } : {}),
                ...(categoryKey ? { categoryKey } : {}),
                ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $group: {
                _id: {
                  categoryKey: '$categoryKey',
                  categoryName: '$categoryName',
                },
                baseCount: { $sum: 1 },
                completedCount: { $sum: 0 },
              },
            },
            {
              $project: {
                _id: 0,
                categoryKey: '$_id.categoryKey',
                categoryName: '$_id.categoryName',
                baseCount: 1,
                completedCount: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<UserCategoryActivityRow[]>([]);

    const providerCityActivityPromise = hasActorScope && viewerMode === 'provider'
      ? this.offerModel
          .aggregate<UserCityActivityRow>([
            {
              $match: {
                providerUserId: normalizedUserId,
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      cityId: '$cityId',
                      cityName: '$cityName',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
            {
              $group: {
                _id: {
                  cityId: '$requestRef.cityId',
                  cityName: '$requestRef.cityName',
                },
                baseCount: { $sum: 1 },
                completedCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                cityId: '$_id.cityId',
                cityName: '$_id.cityName',
                baseCount: 1,
                completedCount: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<UserCityActivityRow[]>([]);

    const customerCityActivityPromise = hasActorScope && viewerMode === 'customer'
      ? this.requestModel
          .aggregate<UserCityActivityRow>([
            {
              $match: {
                clientId: normalizedUserId,
                ...(cityId ? { cityId } : {}),
                ...(categoryKey ? { categoryKey } : {}),
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $group: {
                _id: {
                  cityId: '$cityId',
                  cityName: '$cityName',
                },
                baseCount: { $sum: 1 },
                completedCount: { $sum: 0 },
              },
            },
            {
              $project: {
                _id: 0,
                cityId: '$_id.cityId',
                cityName: '$_id.cityName',
                baseCount: 1,
                completedCount: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<UserCityActivityRow[]>([]);

    const clientActivityRowsPromise = hasActorScope
      ? this.requestModel
          .aggregate<ActivityDateRow>([
            {
              $match: {
                clientId: normalizedUserId,
                ...(cityId ? { cityId } : {}),
                ...(categoryKey ? { categoryKey } : {}),
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $project: {
                _id: 0,
                createdAt: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<ActivityDateRow[]>([]);

    const providerActivityRowsPromise = hasActorScope
      ? this.offerModel
          .aggregate<ActivityDateRow>([
            {
              $match: {
                providerUserId: normalizedUserId,
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
            {
              $project: {
                _id: 0,
                createdAt: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<ActivityDateRow[]>([]);

    const publicOverviewPromise = this.workspace.getPublicOverview({
      page: 1,
      limit: 100,
      cityActivityLimit: 5000,
      activityRange: range,
    });
    const filterOptionsPublicOverviewPromise =
      filterOptionsRange === range
        ? publicOverviewPromise
        : this.workspace.getPublicOverview({
            page: 1,
            limit: 100,
            cityActivityLimit: 5000,
            activityRange: filterOptionsRange,
          });
    const filterOptionsCategoryRowsPromise =
      filterOptionsRange === range
        ? this.aggregateCategoryRows({
            start,
            end,
          })
        : this.aggregateCategoryRows({
            start: filterOptionsStart,
            end: filterOptionsEnd,
          });

    const [
      publicOverview,
      filterOptionsPublicOverview,
      activity,
      filterOptionsCategoryRows,
      categoryRows,
      cityRows,
      offerCityRows,
      searchCityRows,
      requestResponseRows,
      contractLifecycleRows,
      reviewSummary,
      activeProviderRows,
      activeProvidersByCityRows,
      funnelRequestsTotal,
      funnelOffersRows,
      funnelContractsRows,
      marketFunnelRequestsTotal,
      marketFunnelOffersRows,
      marketFunnelContractsRows,
      providerFunnelOffersRows,
      providerFunnelContractsRows,
      customerFunnelRequestsTotal,
      customerFunnelOffersRows,
      customerFunnelContractsRows,
      providerCategoryActivityRows,
      customerCategoryActivityRows,
      providerCityActivityRows,
      customerCityActivityRows,
      clientActivityRows,
      providerActivityRows,
    ] = await Promise.all([
      publicOverviewPromise,
      filterOptionsPublicOverviewPromise,
      this.analytics.getPlatformActivity(range, { cityId, categoryKey, subcategoryKey }),
      filterOptionsCategoryRowsPromise,
      this.aggregateCategoryRows({
        start,
        end,
        match: {
          ...(cityId ? { cityId } : {}),
          ...(categoryKey ? { categoryKey } : {}),
          ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
        },
      }),
      this.requestModel
        .aggregate<{ _id: { cityId?: string | null; cityName?: string | null }; requestCount: number; anbieterSuchenCount: number }>([
          {
            $match: scopedRequestMatch,
          },
          {
            $group: {
              _id: {
                cityId: '$cityId',
                cityName: '$cityName',
              },
              requestCount: { $sum: 1 },
              clientIds: { $addToSet: '$clientId' },
            },
          },
          {
            $project: {
              _id: 1,
              requestCount: 1,
              anbieterSuchenCount: {
                $size: {
                  $filter: {
                    input: '$clientIds',
                    as: 'clientId',
                    cond: {
                      $and: [
                        { $ne: ['$$clientId', null] },
                        { $ne: ['$$clientId', ''] },
                      ],
                    },
                  },
                },
              },
            },
          },
          { $sort: { requestCount: -1 } },
        ])
        .exec(),
      this.offerModel
        .aggregate<{ _id: { cityId?: string | null; cityName?: string | null }; auftragSuchenCount: number }>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    cityName: '$cityName',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $group: {
              _id: {
                cityId: '$requestRef.cityId',
                cityName: '$requestRef.cityName',
              },
              auftragSuchenCount: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.analytics.getCitySearchCounts(range, { cityId, categoryKey, subcategoryKey }),
      this.requestModel
        .aggregate<{ createdAt: Date; firstOfferAt: Date | null; responseMinutes: number | null }>([
          {
            $match: scopedRequestMatch,
          },
          {
            $project: {
              createdAt: 1,
              requestId: { $toString: '$_id' },
            },
          },
          {
            $lookup: {
              from: 'offers',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$requestId', '$$requestId'] },
                  },
                },
                {
                  $group: {
                    _id: null,
                    firstOfferAt: { $min: '$createdAt' },
                  },
                },
              ],
              as: 'offerStats',
            },
          },
          {
            $project: {
              createdAt: 1,
              firstOfferAt: {
                $ifNull: [{ $arrayElemAt: ['$offerStats.firstOfferAt', 0] }, null],
              },
            },
          },
          {
            $project: {
              createdAt: 1,
              firstOfferAt: 1,
              responseMinutes: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$firstOfferAt', null] },
                      { $gte: ['$firstOfferAt', '$createdAt'] },
                    ],
                  },
                  {
                    $divide: [{ $subtract: ['$firstOfferAt', '$createdAt'] }, 60000],
                  },
                  null,
                ],
              },
            },
          },
        ])
        .exec(),
      this.contractModel
        .aggregate<{ _id: null; completedJobs: number; cancelledJobs: number; gmvAmount: number }>([
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $match: {
              $or: [
                { completedAt: { $gte: start, $lte: end } },
                { cancelledAt: { $gte: start, $lte: end } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              completedJobs: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$completedAt', null] },
                        { $gte: ['$completedAt', start] },
                        { $lte: ['$completedAt', end] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              cancelledJobs: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$cancelledAt', null] },
                        { $gte: ['$cancelledAt', start] },
                        { $lte: ['$cancelledAt', end] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              gmvAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$completedAt', null] },
                        { $gte: ['$completedAt', start] },
                        { $lte: ['$completedAt', end] },
                        { $ne: ['$priceAmount', null] },
                        { $gt: ['$priceAmount', 0] },
                      ],
                    },
                    '$priceAmount',
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
      this.reviewModel
        .aggregate<{ _id: null; total: number; average: number }>([
          { $match: { targetRole: 'platform' } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              average: { $avg: '$rating' },
            },
          },
        ])
        .exec(),
      this.offerModel
        .aggregate<{ _id: string }>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $group: {
              _id: '$providerUserId',
            },
          },
        ])
        .exec(),
      this.offerModel
        .aggregate<{ _id: { cityId?: string | null; cityName?: string | null }; providersActive: number }>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    cityName: '$cityName',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $group: {
              _id: {
                cityId: '$requestRef.cityId',
                cityName: '$requestRef.cityName',
              },
              providerIds: { $addToSet: '$providerUserId' },
            },
          },
          {
            $project: {
              _id: 1,
              providersActive: {
                $size: {
                  $filter: {
                    input: '$providerIds',
                    as: 'providerId',
                    cond: {
                      $and: [
                        { $ne: ['$$providerId', null] },
                        { $ne: ['$$providerId', ''] },
                      ],
                    },
                  },
                },
              },
            },
          },
        ])
        .exec(),
      this.requestModel.countDocuments({
        ...requestFunnelMatch,
        ...(cityId ? { cityId } : {}),
        ...(categoryKey ? { categoryKey } : {}),
        ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
        createdAt: { $gte: start, $lte: end },
      }),
      this.offerModel
        .aggregate<{ _id: null; offersTotal: number; confirmedResponsesTotal: number }>([
          {
            $match: {
              ...offerFunnelMatch,
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $group: {
              _id: null,
              offersTotal: { $sum: 1 },
              confirmedResponsesTotal: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                },
              },
            },
          },
        ])
        .exec(),
      this.contractModel
        .aggregate<{ _id: null; closedContractsTotal: number; completedJobsTotal: number; profitAmount: number }>([
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $match: {
              ...contractFunnelMatch,
              $or: [
                { createdAt: { $gte: start, $lte: end } },
                { confirmedAt: { $gte: start, $lte: end } },
                { completedAt: { $gte: start, $lte: end } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              closedContractsTotal: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $in: ['$status', ['confirmed', 'in_progress', 'completed']] },
                        {
                          $or: [
                            {
                              $and: [
                                { $ne: ['$confirmedAt', null] },
                                { $gte: ['$confirmedAt', start] },
                                { $lte: ['$confirmedAt', end] },
                              ],
                            },
                            {
                              $and: [
                                { $eq: ['$confirmedAt', null] },
                                { $gte: ['$createdAt', start] },
                                { $lte: ['$createdAt', end] },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              completedJobsTotal: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$status', 'completed'] },
                        { $ne: ['$completedAt', null] },
                        { $gte: ['$completedAt', start] },
                        { $lte: ['$completedAt', end] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              profitAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$status', 'completed'] },
                        { $ne: ['$completedAt', null] },
                        { $gte: ['$completedAt', start] },
                        { $lte: ['$completedAt', end] },
                        { $ne: ['$priceAmount', null] },
                        { $gt: ['$priceAmount', 0] },
                      ],
                    },
                    '$priceAmount',
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
      marketFunnelRequestsPromise,
      marketFunnelOffersPromise,
      marketFunnelContractsPromise,
      providerFunnelOffersPromise,
      providerFunnelContractsPromise,
      customerFunnelRequestsPromise,
      customerFunnelOffersPromise,
      customerFunnelContractsPromise,
      providerCategoryActivityPromise,
      customerCategoryActivityPromise,
      providerCityActivityPromise,
      customerCityActivityPromise,
      clientActivityRowsPromise,
      providerActivityRowsPromise,
    ]);

    const unansweredThreshold = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    let viewerScopedResponseMinutes: number | null = null;
    let viewerScopedUnansweredOver24h: number | null = null;

    if (hasActorScope && viewerMode === 'provider') {
      const providerDecisionRows = await this.offerModel
        .aggregate<{ requestCreatedAt: Date | null; firstOfferAt: Date | null; hasAcceptedResponse: number }>([
          {
            $match: {
              providerUserId: normalizedUserId,
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    createdAt: '$createdAt',
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          { $match: funnelRequestRefScopeMatch },
          {
            $group: {
              _id: '$requestId',
              requestCreatedAt: { $min: '$requestRef.createdAt' },
              firstOfferAt: { $min: '$createdAt' },
              hasAcceptedResponse: {
                $max: {
                  $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              requestCreatedAt: 1,
              firstOfferAt: 1,
              hasAcceptedResponse: 1,
            },
          },
        ])
        .exec();

      const providerResponseMinutes = providerDecisionRows
        .map((row) => {
          const requestCreatedAt = row.requestCreatedAt ? new Date(row.requestCreatedAt) : null;
          const firstOfferAt = row.firstOfferAt ? new Date(row.firstOfferAt) : null;
          if (!requestCreatedAt || !firstOfferAt) return null;
          if (!Number.isFinite(requestCreatedAt.getTime()) || !Number.isFinite(firstOfferAt.getTime())) return null;
          if (firstOfferAt < requestCreatedAt) return null;
          return (firstOfferAt.getTime() - requestCreatedAt.getTime()) / 60000;
        })
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);

      viewerScopedResponseMinutes = this.toMedian(providerResponseMinutes);
      viewerScopedUnansweredOver24h = providerDecisionRows.filter((row) => {
        const firstOfferAt = row.firstOfferAt ? new Date(row.firstOfferAt) : null;
        if (!firstOfferAt || !Number.isFinite(firstOfferAt.getTime())) return false;
        if (firstOfferAt > unansweredThreshold) return false;
        return row.hasAcceptedResponse === 0;
      }).length;
    }

    if (hasActorScope && viewerMode === 'customer') {
      const customerDecisionRows = await this.requestModel
        .aggregate<{ createdAt: Date | null; firstOfferAt: Date | null }>([
          {
            $match: {
              clientId: normalizedUserId,
              ...(cityId ? { cityId } : {}),
              ...(categoryKey ? { categoryKey } : {}),
              ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $project: {
              createdAt: 1,
              requestId: { $toString: '$_id' },
            },
          },
          {
            $lookup: {
              from: 'offers',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$requestId', '$$requestId'] },
                  },
                },
                {
                  $group: {
                    _id: null,
                    firstOfferAt: { $min: '$createdAt' },
                  },
                },
              ],
              as: 'offerStats',
            },
          },
          {
            $project: {
              createdAt: 1,
              firstOfferAt: {
                $ifNull: [{ $arrayElemAt: ['$offerStats.firstOfferAt', 0] }, null],
              },
            },
          },
        ])
        .exec();

      const customerResponseMinutes = customerDecisionRows
        .map((row) => {
          const createdAt = row.createdAt ? new Date(row.createdAt) : null;
          const firstOfferAt = row.firstOfferAt ? new Date(row.firstOfferAt) : null;
          if (!createdAt || !firstOfferAt) return null;
          if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(firstOfferAt.getTime())) return null;
          if (firstOfferAt < createdAt) return null;
          return (firstOfferAt.getTime() - createdAt.getTime()) / 60000;
        })
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);

      viewerScopedResponseMinutes = this.toMedian(customerResponseMinutes);
      viewerScopedUnansweredOver24h = customerDecisionRows.filter((row) => {
        const createdAt = row.createdAt ? new Date(row.createdAt) : null;
        if (!createdAt || !Number.isFinite(createdAt.getTime())) return false;
        if (createdAt > unansweredThreshold) return false;
        return row.firstOfferAt === null;
      }).length;
    }

    const activityTotals = this.toActivityTotals(activity.data);
    const activityConfig = this.getActivityConfig(range);
    const activityResponseMinutes = requestResponseRows
      .map((row) => row.responseMinutes)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
    const responseMedianMinutes = this.toMedian(activityResponseMinutes);
    const unansweredRequests24h = requestResponseRows.filter((row) => {
      const createdAt = row.createdAt ? new Date(row.createdAt) : null;
      if (!createdAt || !Number.isFinite(createdAt.getTime()) || createdAt > unansweredThreshold) {
        return false;
      }
      return row.firstOfferAt === null;
    }).length;

    const contractLifecycle = contractLifecycleRows[0] ?? { completedJobs: 0, cancelledJobs: 0, gmvAmount: 0 };
    const completedJobsRange = Math.max(0, Math.round(contractLifecycle.completedJobs ?? 0));
    const cancelledJobsRange = Math.max(0, Math.round(contractLifecycle.cancelledJobs ?? 0));
    const gmvAmount = this.roundMoney(Math.max(0, Number(contractLifecycle.gmvAmount ?? 0)));
    const takeRatePercent = this.getPlatformTakeRatePercent();
    const offerRatePercent = this.clampPercent((activityTotals.offersTotal / Math.max(1, activityTotals.requestsTotal)) * 100);
    const cancellationRatePercent = this.clampPercent(
      (cancelledJobsRange / Math.max(1, completedJobsRange + cancelledJobsRange)) * 100,
    );

    const activityMetrics: WorkspaceStatisticsOverviewResponseDto['activity']['metrics'] = {
      offerRatePercent,
      responseMedianMinutes,
      unansweredRequests24h,
      cancellationRatePercent,
      completedJobs: completedJobsRange,
      gmvAmount,
      platformRevenueAmount: this.roundMoney((gmvAmount * takeRatePercent) / 100),
      takeRatePercent,
      offerRateTone: this.resolveSignalTone(
        offerRatePercent,
        {
          positiveWhen: (value) => value >= 60,
          warningWhen: (value) => value < 30,
        },
      ),
      responseMedianTone:
        typeof responseMedianMinutes === 'number' && Number.isFinite(responseMedianMinutes)
          ? this.resolveSignalTone(responseMedianMinutes, {
              positiveWhen: (value) => value <= 30,
              warningWhen: (value) => value > 90,
            })
          : 'neutral',
      unansweredTone: unansweredRequests24h > 0 ? 'warning' : 'positive',
      cancellationTone: this.resolveSignalTone(
        cancellationRatePercent,
        {
          positiveWhen: (value) => value <= 10,
          warningWhen: (value) => value >= 25,
        },
      ),
      completedTone: completedJobsRange > 0 ? 'positive' : 'neutral',
      revenueTone: gmvAmount > 0 ? 'positive' : 'neutral',
    };

    const normalizedCategoryRows = categoryRows
      .map((row) => ({
        ...row,
        count: Math.max(0, Math.round(row.count || 0)),
      }))
      .sort((a, b) => b.count - a.count);
    const categoryTotal = normalizedCategoryRows.reduce((sum, row) => sum + row.count, 0);

    let categories = normalizedCategoryRows.map((row) => {
      const categoryName =
        String(row._id?.categoryName ?? '').trim() ||
        String(row._id?.subcategoryName ?? '').trim() ||
        String(row._id?.serviceKey ?? '').trim() ||
        'Other';

      return {
        categoryKey: row._id?.categoryKey ?? null,
        categoryName,
        requestCount: row.count,
        sharePercent: categoryTotal > 0 ? this.clampPercent((row.count / categoryTotal) * 100) : 0,
      };
    }).slice(0, WorkspaceStatisticsService.CATEGORY_RESPONSE_LIMIT);

    const coordsBySlug = new Map(
      publicOverview.cityActivity.items.map((item) => [
        item.citySlug,
        { cityId: item.cityId, lat: item.lat, lng: item.lng },
      ]),
    );

    const auftragSuchenByCitySlug = new Map<string, number>(
      offerCityRows.map((row) => {
        const cityName = String(row._id?.cityName ?? '').trim();
        const citySlug = this.slugifyCityName(cityName);
        return [citySlug, Math.max(0, Math.round(row.auftragSuchenCount ?? 0))] as const;
      }),
    );

    const searchByCitySlug = new Map<string, CitySearchCountsRow>(
      searchCityRows.map((row) => [row.citySlug, row] as const),
    );

    const searchByCityId = new Map<string, CitySearchCountsRow>(
      searchCityRows
        .filter((row) => String(row.cityId ?? '').trim().length > 0)
        .map((row) => [String(row.cityId), row] as const),
    );

    let hasCitySignalCoverageGap = false;
    let cities: WorkspaceStatisticsCityDemandDto[] = cityRows.map((row) => {
      const cityName = String(row._id?.cityName ?? '').trim();
      const citySlug = this.slugifyCityName(cityName);
      const coords = coordsBySlug.get(citySlug);
      const resolvedCityId = String(row._id?.cityId ?? '').trim();
      const searchRow =
        (resolvedCityId.length > 0 ? searchByCityId.get(resolvedCityId) : undefined) ??
        searchByCitySlug.get(citySlug);

      const requestCount = Math.max(0, Math.round(row.requestCount || 0));
      const offerProxyCount = auftragSuchenByCitySlug.get(citySlug);
      const auftragSuchenRaw = searchRow
        ? Math.max(0, Math.round(searchRow.requestSearchCount))
        : (offerProxyCount ?? null);
      const anbieterSuchenRaw = searchRow
        ? Math.max(0, Math.round(searchRow.providerSearchCount))
        : Math.max(0, Math.round(row.anbieterSuchenCount || 0));
      if (requestCount > 0) {
        const hasRawSupplySignal = Boolean(searchRow) || typeof offerProxyCount === 'number';
        const hasRawDemandSignal = Boolean(searchRow);
        if (!hasRawSupplySignal || !hasRawDemandSignal) {
          hasCitySignalCoverageGap = true;
        }
      }
      const metrics = this.resolveCitySearchMetrics({
        requestCount,
        auftragSuchenCount: auftragSuchenRaw,
        anbieterSuchenCount: anbieterSuchenRaw,
      });

      return {
        citySlug,
        cityName,
        cityId: resolvedCityId.length > 0 ? resolvedCityId : (coords?.cityId ?? null),
        requestCount,
        auftragSuchenCount: metrics.auftragSuchenCount,
        anbieterSuchenCount: metrics.anbieterSuchenCount,
        marketBalanceRatio: metrics.marketBalanceRatio,
        signal: metrics.signal,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      };
    });

    cities = this.mergeCityRankingWithPublicOverview({
      statsCities: cities,
      publicCities: publicOverview.cityActivity.items,
    });

    const filterOptions = this.buildFilterOptions({
      publicCities: filterOptionsPublicOverview.cityActivity.items,
      categoryRows: filterOptionsCategoryRows,
    });

    const ratingAgg = reviewSummary[0] ?? { total: 0, average: 0 };
    const activeProvidersCount = activeProviderRows.length;

    let mode: 'platform' | 'personalized' = 'platform';
    let privateOverview: WorkspacePrivateOverviewResponseDto | null = null;

    if (normalizedUserId) {
      privateOverview = await this.workspace.getPrivateOverview(normalizedUserId, role ?? 'client', range);
      mode = 'personalized';
    }

    let summary = {
      totalPublishedRequests: activityTotals.requestsTotal,
      totalActiveProviders: activeProvidersCount,
      totalActiveCities: cities.length,
      platformRatingAvg: Number.isFinite(ratingAgg.average) ? Number(ratingAgg.average.toFixed(2)) : 0,
      platformRatingCount: Math.max(0, Math.round(ratingAgg.total ?? 0)),
    };

    const personalizedCompletedJobs = privateOverview
      ? privateOverview.providerContractsByStatus.completed + privateOverview.clientContractsByStatus.completed
      : 0;
    const personalizedProfileCompleteness = privateOverview
      ? Math.max(privateOverview.profiles.providerCompleteness, privateOverview.profiles.clientCompleteness)
      : null;

    const kpis = {
      requestsTotal: mode === 'personalized' && !hasDecisionScope
        ? privateOverview?.requestsByStatus.total ?? 0
        : activityTotals.requestsTotal,
      offersTotal: mode === 'personalized' && !hasDecisionScope
        ? privateOverview?.providerOffersByStatus.sent ?? 0
        : activityTotals.offersTotal,
      completedJobsTotal: mode === 'personalized' && !hasDecisionScope
        ? personalizedCompletedJobs
        : completedJobsRange,
      successRate: mode === 'personalized' && !hasDecisionScope
        ? privateOverview?.kpis.acceptanceRate ?? 0
        : this.clampPercent(
            (completedJobsRange / Math.max(1, activityTotals.requestsTotal)) * 100,
          ),
      avgResponseMinutes: mode === 'personalized'
        ? (viewerScopedResponseMinutes ?? privateOverview?.kpis.avgResponseMinutes ?? null)
        : null,
      profileCompleteness: mode === 'personalized' ? personalizedProfileCompleteness : null,
      openRequests: mode === 'personalized'
        ? (viewerScopedUnansweredOver24h ?? privateOverview?.kpis.myOpenRequests ?? null)
        : null,
      recentOffers7d: mode === 'personalized' ? privateOverview?.kpis.recentOffers7d ?? null : null,
    };

    const growthIndex = this.clampUnit(activityMetrics.offerRatePercent / 100);
    const responseSpeedIndex =
      typeof activityMetrics.responseMedianMinutes === 'number' && Number.isFinite(activityMetrics.responseMedianMinutes)
        ? this.clampUnit(1 - (activityMetrics.responseMedianMinutes / 180))
        : 0.5;
    const categoryLeaders = categories.slice(0, 3);
    const demandByCity = cities.map((city) => Math.max(city.requestCount, city.anbieterSuchenCount ?? 0));
    const maxDemand = Math.max(1, ...demandByCity);

    const scoredOpportunities = cities.map((city) => {
      const demand = Math.max(city.requestCount, city.anbieterSuchenCount ?? 0);
      const providers = city.auftragSuchenCount;
      const demandIndex = this.clampUnit(demand / maxDemand);
      const competitionOpportunityIndex = city.marketBalanceRatio === null
        ? 0.5
        : this.clampUnit(city.marketBalanceRatio / 1.5);

      const demandScore = this.roundScore(demandIndex * 10);
      const competitionScore = this.roundScore(competitionOpportunityIndex * 10);
      const growthScore = this.roundScore(growthIndex * 10);
      const activityScore = this.roundScore(responseSpeedIndex * 10);
      const competitionPressureScore = this.roundScore(10 - competitionScore);

      const score = this.roundScore(10 * (
        (demandIndex * 0.4) +
        (competitionOpportunityIndex * 0.3) +
        (growthIndex * 0.2) +
        (responseSpeedIndex * 0.1)
      ));

      const status = this.resolveOpportunityStatus(score);
      const metricsBase: Array<{ key: WorkspaceStatisticsOpportunityMetricDto['key']; value: number }> = [
        { key: 'demand', value: demandScore },
        { key: 'competition', value: competitionPressureScore },
        { key: 'growth', value: growthScore },
        { key: 'activity', value: activityScore },
      ];
      const metrics: WorkspaceStatisticsOpportunityMetricDto[] = metricsBase.map((metric) => ({
        ...metric,
        ...this.resolveOpportunityMetricSemantic(metric),
      }));
      const summaryKey = this.resolveOpportunitySummaryKey({
        status,
        demand: demandScore,
        competition: competitionPressureScore,
        growth: growthScore,
        activity: activityScore,
      });

      return {
        cityId: city.cityId,
        citySlug: city.citySlug,
        city: city.cityName,
        demand,
        providers,
        marketBalanceRatio: city.marketBalanceRatio,
        score,
        demandScore,
        competitionScore,
        growthScore,
        activityScore,
        status,
        tone: this.resolveOpportunityTone(status),
        summaryKey,
        metrics,
      };
    });

    const rankedOpportunities = scoredOpportunities
      .sort((a, b) =>
        (b.score - a.score) ||
        (b.demand - a.demand) ||
        a.city.localeCompare(b.city, 'de-DE'),
      )
      .slice(0, 3);

    let opportunityRadar: WorkspaceStatisticsOpportunityRadarItemDto[] = rankedOpportunities
      .map((item, index) => {
        const category = categoryLeaders[index] ?? null;
        return {
          rank: (index + 1) as 1 | 2 | 3,
          cityId: item.cityId,
          city: item.city,
          categoryKey: category?.categoryKey ?? null,
          category: category?.categoryName ?? null,
          demand: item.demand,
          providers: item.providers ?? null,
          marketBalanceRatio: item.marketBalanceRatio,
          score: item.score,
          demandScore: item.demandScore,
          competitionScore: item.competitionScore,
          growthScore: item.growthScore,
          activityScore: item.activityScore,
          status: item.status,
          tone: item.tone,
          summaryKey: item.summaryKey,
          metrics: item.metrics,
        };
      });

    const topOpportunity = rankedOpportunities[0] ?? null;
    const avgRevenue = activityMetrics.completedJobs > 0
      ? activityMetrics.gmvAmount / activityMetrics.completedJobs
      : null;

    let priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto = this.buildPriceIntelligence({
      avgRevenue,
      topOpportunity,
      topCategoryKey: opportunityRadar[0]?.categoryKey ?? null,
      topCategoryLabel: opportunityRadar[0]?.category ?? null,
    });

    if (range === '24h') {
      const shouldBackfillCategories = categories.length === 0;
      const shouldBackfillCitySignals =
        hasCitySignalCoverageGap ||
        !this.hasCitySearchSignals(cities) ||
        this.hasIncompleteCitySearchSignals(cities);
      const shouldBackfillOpportunity =
        opportunityRadar.length === 0 || !this.hasOpportunityCategoryData(opportunityRadar);
      const shouldBackfillPrice = !this.hasPriceSignal(priceIntelligence);

      if (
        shouldBackfillCategories ||
        shouldBackfillCitySignals ||
        shouldBackfillOpportunity ||
        shouldBackfillPrice
      ) {
        const baseline = await this.getStatisticsOverview(
          {
            range: '30d',
            cityId: cityId ?? undefined,
            regionId: regionId ?? undefined,
            categoryKey: categoryKey ?? undefined,
            subcategoryKey: subcategoryKey ?? undefined,
          },
          hasActorScope ? normalizedUserId : undefined,
          role,
        );

        if (shouldBackfillCategories && baseline.demand.categories.length > 0) {
          categories = baseline.demand.categories.slice();
        }
        if (shouldBackfillCitySignals && baseline.demand.cities.length > 0) {
          cities = this.mergeCitySearchSignals(cities, baseline.demand.cities);
          summary = {
            ...summary,
            totalActiveCities: Math.max(summary.totalActiveCities, cities.length),
          };
        }
        if (shouldBackfillOpportunity && baseline.opportunityRadar.length > 0) {
          opportunityRadar = baseline.opportunityRadar.slice();
        }
        if (
          shouldBackfillPrice &&
          (this.hasPriceSignal(baseline.priceIntelligence) ||
            this.hasProfitPotentialSignal(baseline.priceIntelligence))
        ) {
          priceIntelligence = { ...baseline.priceIntelligence };
        }
      }
    } else if (range !== '30d' && (hasCitySignalCoverageGap || this.hasIncompleteCitySearchSignals(cities))) {
      const baseline = await this.getStatisticsOverview(
        {
          range: '30d',
          cityId: cityId ?? undefined,
          regionId: regionId ?? undefined,
          categoryKey: categoryKey ?? undefined,
          subcategoryKey: subcategoryKey ?? undefined,
        },
        hasActorScope ? normalizedUserId : undefined,
        role,
      );
      if (baseline.demand.cities.length > 0) {
        cities = this.mergeCitySearchSignals(cities, baseline.demand.cities);
        summary = {
          ...summary,
          totalActiveCities: Math.max(summary.totalActiveCities, cities.length),
        };
      }
    }

    const activeProvidersByCityKey = new Map<string, number>();
    for (const row of activeProvidersByCityRows) {
      const cityId = this.cityIdKey(String(row._id?.cityId ?? '').trim() || null);
      const citySlug = this.citySlugKey(this.slugifyCityName(String(row._id?.cityName ?? '').trim()));
      const key = cityId || citySlug;
      if (!key) continue;
      activeProvidersByCityKey.set(key, Math.max(0, Math.round(row.providersActive ?? 0)));
    }

    const scopedGrowthIndex = this.clampUnit(activityMetrics.offerRatePercent / 100);
    const scopedResponseSpeedIndex =
      typeof activityMetrics.responseMedianMinutes === 'number' && Number.isFinite(activityMetrics.responseMedianMinutes)
        ? this.clampUnit(1 - (activityMetrics.responseMedianMinutes / 180))
        : 0.5;
    const rankedCityCandidates = this.buildRankedCityCandidates({
      cities,
      providersActiveByCityKey: activeProvidersByCityKey,
      growthIndex: scopedGrowthIndex,
      responseSpeedIndex: scopedResponseSpeedIndex,
    });
    const scopedCityMarket = this.selectScopedCityRows({
      rankedCandidates: rankedCityCandidates,
      cityId,
    });
    const scopedCategory =
      (categoryKey ? categories.find((item) => item.categoryKey === categoryKey) ?? null : categories[0] ?? null);
    const scopedOpportunityCategoryKey = categoryKey ?? scopedCategory?.categoryKey ?? null;
    const scopedOpportunityCategoryLabel = scopedCategory?.categoryName ?? null;
    const scopedAvgRevenue = activityMetrics.completedJobs > 0
      ? activityMetrics.gmvAmount / activityMetrics.completedJobs
      : null;

    cities = scopedCityMarket.cities;
    const cityList = this.paginateCityList({
      cities,
      page: citiesPage,
      limit: citiesLimit,
    });
    opportunityRadar = this.buildOpportunityRadarFromCluster({
      cluster: scopedCityMarket.opportunityCluster,
      focusCityId: cityId,
      categoryKey: scopedOpportunityCategoryKey,
      categoryLabel: scopedOpportunityCategoryLabel,
      avgRevenue: scopedAvgRevenue,
    });
    const scopedPriceIntelligence = opportunityRadar[0]?.priceIntelligence ?? this.buildPriceIntelligence({
      avgRevenue: scopedAvgRevenue,
      topOpportunity: rankedCityCandidates[0]
        ? {
          citySlug: rankedCityCandidates[0].citySlug,
          city: rankedCityCandidates[0].cityName,
          demand: rankedCityCandidates[0].demand,
          score: rankedCityCandidates[0].score,
          demandScore: rankedCityCandidates[0].demandScore,
          competitionScore: rankedCityCandidates[0].competitionScore,
        }
        : null,
      topCategoryKey: scopedOpportunityCategoryKey,
      topCategoryLabel: scopedOpportunityCategoryLabel,
    });
    const scopedHasPriceSignal = this.hasPriceSignal(scopedPriceIntelligence);
    const existingHasPriceSignal = this.hasPriceSignal(priceIntelligence);
    priceIntelligence =
      scopedHasPriceSignal || (!existingHasPriceSignal && this.hasProfitPotentialSignal(scopedPriceIntelligence))
        ? scopedPriceIntelligence
        : priceIntelligence;

    const funnelOffersAgg = funnelOffersRows[0] ?? { offersTotal: 0, confirmedResponsesTotal: 0 };
    const funnelContractsAgg = funnelContractsRows[0] ?? {
      closedContractsTotal: 0,
      completedJobsTotal: 0,
      profitAmount: 0,
    };
    const marketFunnelOffersAgg = (marketFunnelOffersRows?.[0] ?? null) ?? { offersTotal: 0, confirmedResponsesTotal: 0 };
    const marketFunnelContractsAgg = (marketFunnelContractsRows?.[0] ?? null) ?? {
      closedContractsTotal: 0,
      completedJobsTotal: 0,
      profitAmount: 0,
    };
    const providerFunnelOffersAgg = (providerFunnelOffersRows?.[0] ?? null) ?? {
      requestsTotal: 0,
      offersTotal: 0,
      confirmedResponsesTotal: 0,
    };
    const providerFunnelContractsAgg = (providerFunnelContractsRows?.[0] ?? null) ?? {
      contractsTotal: 0,
      completedTotal: 0,
      revenueAmount: 0,
    };
    const customerFunnelOffersAgg = (customerFunnelOffersRows?.[0] ?? null) ?? {
      offersTotal: 0,
      acceptedOffersTotal: 0,
    };
    const customerFunnelContractsAgg = (customerFunnelContractsRows?.[0] ?? null) ?? {
      contractsTotal: 0,
      completedTotal: 0,
      revenueAmount: 0,
    };

    const rawRequestsFunnelTotal = Math.max(0, Math.round(Number(funnelRequestsTotal ?? 0)));
    const fallbackPlatformRequestsTotal =
      mode === 'platform' && range === '24h'
        ? Math.max(0, Math.round(Number(summary.totalPublishedRequests ?? 0)))
        : 0;
    const baseMarketRequestsTotal = rawRequestsFunnelTotal > 0 ? rawRequestsFunnelTotal : fallbackPlatformRequestsTotal;
    const marketCounts: FunnelStageCounts = this.normalizeFunnelStageCounts({
      requests: hasActorScope
        ? Math.max(0, Math.round(Number(marketFunnelRequestsTotal ?? 0)))
        : baseMarketRequestsTotal,
      offers: hasActorScope
        ? Math.max(0, Math.round(Number(marketFunnelOffersAgg.offersTotal ?? 0)))
        : Math.max(0, Math.round(Number(funnelOffersAgg.offersTotal ?? 0))),
      responses: hasActorScope
        ? Math.max(0, Math.round(Number(marketFunnelOffersAgg.confirmedResponsesTotal ?? 0)))
        : Math.max(0, Math.round(Number(funnelOffersAgg.confirmedResponsesTotal ?? 0))),
      contracts: hasActorScope
        ? Math.max(0, Math.round(Number(marketFunnelContractsAgg.closedContractsTotal ?? 0)))
        : Math.max(0, Math.round(Number(funnelContractsAgg.closedContractsTotal ?? 0))),
      completed: hasActorScope
        ? Math.max(0, Math.round(Number(marketFunnelContractsAgg.completedJobsTotal ?? 0)))
        : Math.max(0, Math.round(Number(funnelContractsAgg.completedJobsTotal ?? 0))),
    });
    const marketRevenueAmount = hasActorScope
      ? this.roundMoney(Math.max(0, Number(marketFunnelContractsAgg.profitAmount ?? 0)))
      : this.roundMoney(Math.max(0, Number(funnelContractsAgg.profitAmount ?? 0)));

    const providerCounts: FunnelStageCounts = this.normalizeFunnelStageCounts({
      requests: Math.max(0, Math.round(Number(providerFunnelOffersAgg.requestsTotal ?? 0))),
      offers: Math.max(0, Math.round(Number(providerFunnelOffersAgg.offersTotal ?? 0))),
      responses: Math.max(0, Math.round(Number(providerFunnelOffersAgg.confirmedResponsesTotal ?? 0))),
      contracts: Math.max(0, Math.round(Number(providerFunnelContractsAgg.contractsTotal ?? 0))),
      completed: Math.max(0, Math.round(Number(providerFunnelContractsAgg.completedTotal ?? 0))),
    });
    const providerRevenueAmount = this.roundMoney(Math.max(0, Number(providerFunnelContractsAgg.revenueAmount ?? 0)));

    const customerCounts: FunnelStageCounts = this.normalizeFunnelStageCounts({
      requests: Math.max(0, Math.round(Number(customerFunnelRequestsTotal ?? 0))),
      offers: Math.max(0, Math.round(Number(customerFunnelOffersAgg.offersTotal ?? 0))),
      responses: Math.max(0, Math.round(Number(customerFunnelOffersAgg.acceptedOffersTotal ?? 0))),
      contracts: Math.max(0, Math.round(Number(customerFunnelContractsAgg.contractsTotal ?? 0))),
      completed: Math.max(0, Math.round(Number(customerFunnelContractsAgg.completedTotal ?? 0))),
    });
    const customerRevenueAmount = this.roundMoney(Math.max(0, Number(customerFunnelContractsAgg.revenueAmount ?? 0)));
    const viewerModeCounts = viewerMode === 'customer' ? customerCounts : providerCounts;
    const hasViewerModeCounts = Object.values(viewerModeCounts).some((value) => value > 0);
    const selectedUserCounts = viewerModeCounts;
    const selectedUserRevenueAmount = viewerMode === 'customer' ? customerRevenueAmount : providerRevenueAmount;
    const marketAverageOrderValue =
      marketCounts.completed > 0 ? this.roundMoney(marketRevenueAmount / marketCounts.completed) : null;
    const selectedUserAverageOrderValue =
      selectedUserCounts.completed > 0 ? this.roundMoney(selectedUserRevenueAmount / selectedUserCounts.completed) : null;
    const hasViewerScopedData =
      hasViewerModeCounts ||
      selectedUserRevenueAmount > 0;
    const requestsFunnelTotal = mode === 'personalized' ? selectedUserCounts.requests : marketCounts.requests;
    const offersFunnelTotal = mode === 'personalized' ? selectedUserCounts.offers : marketCounts.offers;
    const confirmedResponsesTotal = mode === 'personalized' ? selectedUserCounts.responses : marketCounts.responses;
    const closedContractsTotal = mode === 'personalized' ? selectedUserCounts.contracts : marketCounts.contracts;
    const completedFunnelTotal = mode === 'personalized' ? selectedUserCounts.completed : marketCounts.completed;
    const profitAmount = mode === 'personalized'
      ? selectedUserRevenueAmount
      : marketRevenueAmount;

    const offerResponseRatePercent = this.clampPercent((offersFunnelTotal / Math.max(1, requestsFunnelTotal)) * 100);
    const confirmationRatePercent = this.clampPercent((confirmedResponsesTotal / Math.max(1, offersFunnelTotal)) * 100);
    const contractClosureRatePercent = this.clampPercent((closedContractsTotal / Math.max(1, confirmedResponsesTotal)) * 100);
    const completionRatePercent = this.clampPercent((completedFunnelTotal / Math.max(1, closedContractsTotal)) * 100);
    const conversionRatePercent = this.clampPercent((completedFunnelTotal / Math.max(1, requestsFunnelTotal)) * 100);
    const avgRevenuePerCompleted = completedFunnelTotal > 0 ? this.roundMoney(profitAmount / completedFunnelTotal) : 0;

    const requestsWidthPercent = 100;
    const offersWidthPercent = this.roundPercent(
      Math.max(0, Math.min(100, (offersFunnelTotal / Math.max(1, requestsFunnelTotal)) * 100)),
    );
    const confirmationsWidthPercent = this.roundPercent(
      Math.max(0, Math.min(offersWidthPercent, (confirmedResponsesTotal / Math.max(1, requestsFunnelTotal)) * 100)),
    );
    const contractsWidthPercent = this.roundPercent(
      Math.max(0, Math.min(confirmationsWidthPercent, (closedContractsTotal / Math.max(1, requestsFunnelTotal)) * 100)),
    );
    const completedWidthPercent = this.roundPercent(
      Math.max(0, Math.min(contractsWidthPercent, (completedFunnelTotal / Math.max(1, requestsFunnelTotal)) * 100)),
    );

    const funnelStageLabels = this.buildFunnelStageLabels(viewerMode ?? 'provider');
    const offerStageRateLabel = viewerMode === 'customer' ? 'Angebotsquote' : 'Antwortquote';
    const responseStageRateLabel = viewerMode === 'customer' ? 'Akzeptanzrate' : 'Rückmeldequote';
    const contractStageRateLabel = viewerMode === 'customer' ? 'Startquote' : 'Abschlussrate';

    const stages: WorkspaceStatisticsProfileFunnelDto['stages'] = [
      {
        id: 'requests',
        label: funnelStageLabels.requests,
        value: requestsFunnelTotal,
        displayValue: this.formatInt(requestsFunnelTotal),
        widthPercent: requestsWidthPercent,
        rateLabel: 'Basis',
        ratePercent: 100,
        helperText: null,
      },
      {
        id: 'offers',
        label: funnelStageLabels.offers,
        value: offersFunnelTotal,
        displayValue: this.formatInt(offersFunnelTotal),
        widthPercent: offersWidthPercent,
        rateLabel: offerStageRateLabel,
        ratePercent: offerResponseRatePercent,
        helperText: null,
      },
      {
        id: 'confirmations',
        label: funnelStageLabels.responses,
        value: confirmedResponsesTotal,
        displayValue: this.formatInt(confirmedResponsesTotal),
        widthPercent: confirmationsWidthPercent,
        rateLabel: responseStageRateLabel,
        ratePercent: confirmationRatePercent,
        helperText: null,
      },
      {
        id: 'contracts',
        label: funnelStageLabels.contracts,
        value: closedContractsTotal,
        displayValue: this.formatInt(closedContractsTotal),
        widthPercent: contractsWidthPercent,
        rateLabel: contractStageRateLabel,
        ratePercent: contractClosureRatePercent,
        helperText: null,
      },
      {
        id: 'completed',
        label: funnelStageLabels.completed,
        value: completedFunnelTotal,
        displayValue: this.formatInt(completedFunnelTotal),
        widthPercent: completedWidthPercent,
        rateLabel: 'Erfüllungsquote',
        ratePercent: completionRatePercent,
        helperText: null,
      },
      {
        id: 'revenue',
        label: 'Gewinnsumme',
        value: profitAmount,
        displayValue: this.formatCurrency(profitAmount),
        widthPercent: completedWidthPercent,
        rateLabel: 'Ø Umsatz / Auftrag',
        ratePercent: null,
        helperText: completedFunnelTotal > 0 ? this.formatCurrency(avgRevenuePerCompleted) : '—',
      },
    ];

    const profileFunnel = {
      periodLabel: this.formatRangeLabel(range),
      stage1: requestsFunnelTotal,
      stage2: offersFunnelTotal,
      stage3: confirmedResponsesTotal,
      stage4: closedContractsTotal,
      requestsTotal: requestsFunnelTotal,
      offersTotal: offersFunnelTotal,
      confirmedResponsesTotal,
      closedContractsTotal,
      completedJobsTotal: completedFunnelTotal,
      profitAmount,
      offerResponseRatePercent,
      confirmationRatePercent,
      contractClosureRatePercent,
      completionRatePercent,
      conversionRate: conversionRatePercent,
      totalConversionPercent: conversionRatePercent,
      summaryText: `Von ${this.formatInt(requestsFunnelTotal)} Anfragen wurden ${this.formatInt(completedFunnelTotal)} erfolgreich abgeschlossen.`,
      stages,
    };

    const personalizedFunnelLowData = mode === 'personalized'
      ? !hasViewerScopedData || selectedUserCounts.requests < 3 || (selectedUserCounts.offers + selectedUserCounts.responses + selectedUserCounts.contracts + selectedUserCounts.completed) < 3
      : false;
    const funnelComparison = mode === 'personalized' && viewerMode
      ? this.buildFunnelComparison({
          viewerMode,
          marketCounts,
          userCounts: selectedUserCounts,
          lowData: personalizedFunnelLowData,
        })
      : null;
    const decisionLayer = this.buildDecisionLayer({
      mode,
      viewerMode,
      activityMetrics,
      marketCounts,
      marketRevenueAmount,
      marketAverageOrderValue,
      userCounts: selectedUserCounts,
      userRevenueAmount: selectedUserRevenueAmount,
      userAverageOrderValue: selectedUserAverageOrderValue,
      userResponseMinutes: viewerScopedResponseMinutes,
      userUnansweredOver24h: viewerScopedUnansweredOver24h,
      reliableComparison: hasViewerScopedData,
    });
    const userCategoryActivityRows = viewerMode === 'customer'
      ? customerCategoryActivityRows
      : providerCategoryActivityRows;
    const userCityActivityRows = viewerMode === 'customer'
      ? customerCityActivityRows
      : providerCityActivityRows;
    const categoryFit = this.buildCategoryFit({
      mode,
      categories,
      userRows: userCategoryActivityRows,
    });
    const cityComparison = this.buildCityComparison({
      mode,
      cities,
      userRows: userCityActivityRows,
    });

    const updatedAt = new Date().toISOString();
    const selectedCityOption = filterOptions.cities.find((item) => item.value === cityId);
    const selectedCategoryOption = filterOptions.categories.find((item) => item.value === categoryKey);
    const selectedServiceOption = filterOptions.services.find((item) => item.value === subcategoryKey);
    const selectedCityFromRows =
      (cityId
        ? cities.find((item) => item.cityId === cityId || item.citySlug === cityId)?.cityName
        : null) ??
      null;
    const selectedCategoryFromRows =
      (categoryKey
        ? categories.find((item) => item.categoryKey === categoryKey)?.categoryName
        : null) ??
      null;
    const selectedCityLabel =
      selectedCityOption?.label ??
      selectedCityFromRows ??
      cityId ??
      WorkspaceStatisticsService.ALL_CITIES_LABEL;
    const selectedCategoryLabel =
      selectedCategoryOption?.label ??
      selectedCategoryFromRows ??
      categoryKey ??
      WorkspaceStatisticsService.ALL_CATEGORIES_LABEL;
    const selectedServiceLabel =
      selectedServiceOption?.label ??
      subcategoryKey ??
      WorkspaceStatisticsService.ALL_SERVICES_LABEL;
    const scopeLabel = [cityId ? selectedCityLabel : null, categoryKey ? selectedCategoryLabel : null, subcategoryKey ? selectedServiceLabel : null]
      .filter(Boolean)
      .join(' · ') || 'Globaler Markt';
    const personalizedPricing = this.buildPersonalizedPricing({
      mode,
      scopeLabel,
      priceIntelligence,
      userAverageOrderValue: selectedUserAverageOrderValue,
    });
    const activityComparison = this.buildActivityComparison({
      mode,
      marketPoints: activity.data,
      stepMs: activityConfig.stepMs,
      clientRows: clientActivityRows,
      providerRows: providerActivityRows,
      activityTotals,
      updatedAt,
    });
    const hasScopedPriceData = Boolean(
      priceIntelligence.recommendedMin !== null ||
      priceIntelligence.recommendedMax !== null ||
      priceIntelligence.marketAverage !== null,
    );
    const isLowData =
      hasDecisionScope && (
        (cityId !== null && cities.length === 0) ||
        (categoryKey !== null && categories.length === 0) ||
        opportunityRadar.length === 0 ||
        !hasScopedPriceData
      );
    const decisionContext: WorkspaceStatisticsDecisionContextDto = {
      mode: hasDecisionScope ? 'focus' : 'global',
      period: range,
      city: {
        value: cityId,
        label: cityId ? selectedCityLabel : WorkspaceStatisticsService.ALL_CITIES_LABEL,
      },
      region: {
        value: regionId,
        label: regionId ?? WorkspaceStatisticsService.ALL_REGIONS_LABEL,
      },
      category: {
        value: categoryKey,
        label: categoryKey ? selectedCategoryLabel : WorkspaceStatisticsService.ALL_CATEGORIES_LABEL,
      },
      service: {
        value: subcategoryKey,
        label: subcategoryKey ? selectedServiceLabel : WorkspaceStatisticsService.ALL_SERVICES_LABEL,
      },
      scopeLabel,
      title: hasDecisionScope ? scopeLabel : 'Globaler Markt',
      subtitle: 'Ein gemeinsamer Marktfilter steuert KPI, Chancen, Preise und Empfehlungen.',
      stickyLabel: [
        this.formatRangeLabel(range),
        cityId ? selectedCityLabel : WorkspaceStatisticsService.ALL_CITIES_LABEL,
        categoryKey ? selectedCategoryLabel : WorkspaceStatisticsService.ALL_CATEGORIES_LABEL,
        subcategoryKey ? selectedServiceLabel : WorkspaceStatisticsService.ALL_SERVICES_LABEL,
      ].join(' · '),
      health: this.buildContextHealth({
        categories,
        cities,
        opportunityRadar,
        activity: {
          range,
          interval: activity.interval,
          points: activity.data,
          totals: activityTotals,
          metrics: activityMetrics,
        },
      }),
      lowData: {
        isLowData,
        title: isLowData ? 'Zu wenig Daten für eine verlässliche Segmentanalyse' : null,
        body: isLowData
          ? 'Erweitern Sie den Zeitraum oder wechseln Sie zu Alle Städte bzw. Alle Kategorien.'
          : null,
      },
    };
    const decisionInsight = decisionLayer?.primaryInsight ?? this.buildDecisionInsight({
      activityMetrics,
      conversionRatePercent,
    });
    const insights = this.insightsService.getInsights(
      this.buildInsightsSnapshot({
        range,
        updatedAt,
        mode,
        role,
        summary,
        kpis,
        categories,
        cities,
        activityMetrics,
        profileFunnel,
      }),
      role,
    );
    const risks = this.buildRecommendationSection({
      mode,
      title: 'Risiken',
      subtitle: 'Was aktuell deinen Fortschritt ausbremst.',
      items: insights.filter((item) => item.type === 'risk'),
    });
    const opportunities = this.buildRecommendationSection({
      mode,
      title: 'Chancen',
      subtitle: 'Wo der Markt im aktuellen Kontext Potenzial für dich zeigt.',
      items: insights.filter((item) => item.type === 'demand' || item.type === 'opportunity' || item.type === 'growth'),
    });
    const nextSteps = this.buildRecommendationSection({
      mode,
      title: 'Nächste Schritte',
      subtitle: 'Konkrete Aktionen auf Basis der aktuellen Signale.',
      items: insights
        .filter((item) => item.action?.actionType !== 'none' || this.resolveInsightActionCode(item) !== null)
        .slice(0, 3),
    });

    return {
      decisionContext,
      filterOptions,
      sectionMeta: this.buildSectionMeta(decisionContext),
      exportMeta: this.buildExportMeta({
        range,
        cityId,
        categoryKey,
        updatedAt,
      }),
      updatedAt,
      mode,
      range,
      viewerMode,
      decisionInsight,
      decisionLayer,
      personalizedPricing,
      categoryFit,
      cityComparison,
      risks,
      opportunities,
      nextSteps,
      summary,
      kpis,
      activity: {
        range,
        interval: activity.interval,
        points: activity.data,
        totals: activityTotals,
        metrics: activityMetrics,
      },
      activityComparison,
      demand: {
        categories,
        cities,
        cityList,
      },
      opportunityRadar,
      priceIntelligence,
      profileFunnel,
      funnelComparison,
      insights,
      growthCards: this.buildGrowthCards(),
    };
  }
}
