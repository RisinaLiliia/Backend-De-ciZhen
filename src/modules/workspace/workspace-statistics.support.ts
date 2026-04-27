import type { AppRole } from '../users/schemas/user.schema';
import type {
  WorkspaceStatisticsOpportunityMetricDto,
  WorkspaceStatisticsOpportunityRadarItemDto,
  WorkspaceStatisticsFunnelComparisonDto,
} from './dto/workspace-statistics-response.dto';
import type {
  WorkspaceStatisticsQueryDto,
  WorkspaceStatisticsRange,
  WorkspaceStatisticsViewerMode,
} from './dto/workspace-statistics-query.dto';

export type FunnelStageKey = 'requests' | 'offers' | 'responses' | 'contracts' | 'completed';

export type FunnelStageCounts = Record<FunnelStageKey, number>;

export class WorkspaceStatisticsSupport {
  protected static readonly CITY_LIST_DEFAULT_LIMIT = 10;
  protected static readonly CITY_LIST_MAX_LIMIT = 50;

  protected resolveRange(range?: WorkspaceStatisticsRange): WorkspaceStatisticsRange {
    if (range === '24h' || range === '7d' || range === '30d' || range === '90d') return range;
    return '30d';
  }

  protected normalizeScopeFilter(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  protected resolveFilters(query?: WorkspaceStatisticsRange | WorkspaceStatisticsQueryDto | null) {
    if (!query || typeof query === 'string') {
      return {
        range: this.resolveRange(query ?? undefined),
        cityId: null,
        regionId: null,
        categoryKey: null,
        subcategoryKey: null,
        citiesPage: 1,
        citiesLimit: WorkspaceStatisticsSupport.CITY_LIST_DEFAULT_LIMIT,
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
            WorkspaceStatisticsSupport.CITY_LIST_MAX_LIMIT,
            Math.max(1, Math.trunc(query.citiesLimit)),
          )
        : WorkspaceStatisticsSupport.CITY_LIST_DEFAULT_LIMIT;

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

  protected resolveViewerMode(
    viewerMode: WorkspaceStatisticsViewerMode | null | undefined,
    role?: AppRole | null,
  ): WorkspaceStatisticsViewerMode {
    if (viewerMode === 'provider' || viewerMode === 'customer') return viewerMode;
    return role === 'client' ? 'customer' : 'provider';
  }

  protected getActivityConfig(
    range: WorkspaceStatisticsRange,
  ): { points: number; stepMs: number; interval: 'hour' | 'day' } {
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

  protected resolveWindow(range: WorkspaceStatisticsRange): { start: Date; end: Date } {
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

  protected resolveFilterOptionsRange(range: WorkspaceStatisticsRange): WorkspaceStatisticsRange {
    if (range === '24h' || range === '7d') return '30d';
    return range;
  }

  protected clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  protected roundMoney(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  protected roundPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  protected roundScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 10) / 10;
  }

  protected clampUnit(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  protected resolveCitySignal(params: {
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

  protected resolveSignalTone(
    value: number,
    thresholds: {
      positiveWhen: (value: number) => boolean;
      warningWhen: (value: number) => boolean;
    },
  ): 'positive' | 'neutral' | 'warning' {
    if (thresholds.positiveWhen(value)) return 'positive';
    if (thresholds.warningWhen(value)) return 'warning';
    return 'neutral';
  }

  protected resolveOpportunityStatus(
    score: number,
  ): 'very_high' | 'good' | 'balanced' | 'competitive' | 'low' {
    if (score >= 8.5) return 'very_high';
    if (score >= 7) return 'good';
    if (score >= 5) return 'balanced';
    if (score >= 3.5) return 'competitive';
    return 'low';
  }

  protected resolveOpportunityTone(
    status: 'very_high' | 'good' | 'balanced' | 'competitive' | 'low',
  ): 'very-high' | 'high' | 'balanced' | 'supply-heavy' {
    if (status === 'very_high') return 'very-high';
    if (status === 'good') return 'high';
    if (status === 'balanced') return 'balanced';
    return 'supply-heavy';
  }

  protected resolveOpportunityMetricSemantic(params: {
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

  protected resolveOpportunitySummaryKey(params: {
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

  protected roundToNearestStep(value: number, step: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(step, Math.round(value / step) * step);
  }

  protected formatInt(value: number): string {
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(
      Math.max(0, Math.round(value)),
    );
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(this.roundMoney(Math.max(0, value)));
  }

  protected formatRangeLabel(range: WorkspaceStatisticsRange): string {
    if (range === '24h') return '24h';
    if (range === '7d') return '7 Tage';
    if (range === '90d') return '90 Tage';
    return '30 Tage';
  }

  protected buildFunnelStageLabels(
    viewerMode: WorkspaceStatisticsViewerMode,
  ): Record<FunnelStageKey, string> {
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

  protected computeRate(current: number, previous: number): number | null {
    if (previous <= 0) return null;
    return this.clampPercent((current / previous) * 100);
  }

  protected computeGap(userValue: number | null, marketValue: number | null): number | null {
    if (typeof userValue !== 'number' || typeof marketValue !== 'number') return null;
    return this.roundPercent(userValue - marketValue);
  }

  protected resolveFunnelStageStatus(
    gapRate: number | null,
    reliable: boolean,
  ): 'good' | 'warning' | 'critical' | 'neutral' {
    if (!reliable || gapRate === null) return 'neutral';
    if (gapRate <= -25) return 'critical';
    if (gapRate <= -10) return 'warning';
    if (gapRate >= 10) return 'good';
    return 'neutral';
  }

  protected resolveFunnelSeverity(
    gapRate: number | null,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (gapRate === null) return 'low';
    if (gapRate <= -35) return 'critical';
    if (gapRate <= -20) return 'high';
    if (gapRate <= -10) return 'medium';
    return 'low';
  }

  protected formatGapPercent(gapRate: number | null): string {
    if (gapRate === null || !Number.isFinite(gapRate)) return '—';
    if (gapRate > 0) return `+${this.roundPercent(gapRate)} pp`;
    return `${this.roundPercent(gapRate)} pp`;
  }

  protected resolveFunnelActionCode(
    stageKey: FunnelStageKey,
    status: 'good' | 'warning' | 'critical' | 'neutral',
  ): string | null {
    if (status === 'good' || status === 'neutral') return null;
    if (stageKey === 'offers') return 'focus_market';
    if (stageKey === 'responses') return 'follow_up_requests';
    if (stageKey === 'contracts') return 'respond_faster';
    if (stageKey === 'completed') return 'complete_profile';
    return 'focus_market';
  }

  protected resolveFunnelSignalCodes(
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

  protected buildFunnelStageSummary(params: {
    label: string;
    marketRate: number | null;
    userRate: number | null;
    gapRate: number | null;
    status: 'good' | 'warning' | 'critical' | 'neutral';
    reliable: boolean;
  }): string | null {
    if (
      !params.reliable ||
      params.marketRate === null ||
      params.userRate === null ||
      params.gapRate === null
    ) {
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

  protected normalizeFunnelStageCounts(counts: FunnelStageCounts): FunnelStageCounts {
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

  protected buildFunnelComparison(params: {
    viewerMode: WorkspaceStatisticsViewerMode;
    marketCounts: FunnelStageCounts;
    userCounts: FunnelStageCounts;
    lowData: boolean;
  }): WorkspaceStatisticsFunnelComparisonDto {
    const labels = this.buildFunnelStageLabels(params.viewerMode);
    const orderedKeys: FunnelStageKey[] = ['requests', 'offers', 'responses', 'contracts', 'completed'];

    const stages: WorkspaceStatisticsFunnelComparisonDto['stages'] = orderedKeys.map((key, index) => {
      const previousKey = orderedKeys[index - 1] ?? null;
      const marketRateFromPrev = previousKey
        ? this.computeRate(params.marketCounts[key], params.marketCounts[previousKey])
        : 100;
      const userRateFromPrev = previousKey
        ? this.computeRate(params.userCounts[key], params.userCounts[previousKey])
        : 100;
      const previousUserCount = previousKey ? params.userCounts[previousKey] : params.userCounts.requests;
      const previousMarketCount = previousKey ? params.marketCounts[previousKey] : params.marketCounts.requests;
      const reliable = !params.lowData && previousKey !== null && previousUserCount >= 3 && previousMarketCount >= 5;
      const gapRate = previousKey ? this.computeGap(userRateFromPrev, marketRateFromPrev) : 0;
      const status = previousKey ? this.resolveFunnelStageStatus(gapRate, reliable) : 'neutral';

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
      .filter(
        (stage) =>
          typeof stage.gapRate === 'number' && params.userCounts[stage.key as FunnelStageKey] >= 0,
      );

    const largestGapStage =
      comparableStages.reduce<WorkspaceStatisticsFunnelComparisonDto['stages'][number] | null>(
        (worst, stage) => {
          if (!worst) return stage;
          return (stage.gapRate ?? 0) < (worst.gapRate ?? 0) ? stage : worst;
        },
        null,
      );

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
          actionCode: this.resolveFunnelActionCode(
            reliableLargestGapStage.key as FunnelStageKey,
            reliableLargestGapStage.status,
          ),
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

    const marketConversion = this.computeRate(
      params.marketCounts.completed,
      params.marketCounts.requests,
    );
    const userConversion = this.computeRate(params.userCounts.completed, params.userCounts.requests);
    const gapConversion = this.computeGap(userConversion, marketConversion);
    const conversionSummary = {
      userConversion,
      marketConversion,
      gapConversion,
      status: this.resolveFunnelStageStatus(
        gapConversion,
        !params.lowData && params.userCounts.requests >= 3 && params.marketCounts.requests >= 5,
      ),
    };

    const primaryAction = bottleneck?.actionCode
      ? {
          code: bottleneck.actionCode,
          label:
            bottleneck.actionCode === 'follow_up_requests'
              ? 'Offene Anfragen priorisieren'
              : bottleneck.actionCode === 'respond_faster'
                ? 'Schneller reagieren'
                : bottleneck.actionCode === 'complete_profile'
                  ? 'Profil vervollständigen'
                  : 'Marktfokus schärfen',
          target:
            bottleneck.actionCode === 'focus_market'
              ? '/workspace?section=stats&focus=cities'
              : '/workspace?section=requests&scope=my&period=90d&range=90d',
        }
      : null;

    const lowDataSummary = 'Noch zu wenig Daten für einen belastbaren Funnel-Vergleich.';
    const summary = params.lowData
      ? lowDataSummary
      : largestDropOffStage?.summary ?? 'Dein Funnel liegt aktuell nahe am Markt.';

    return {
      title: 'Profil Performance',
      subtitle:
        params.viewerMode === 'customer'
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
}
