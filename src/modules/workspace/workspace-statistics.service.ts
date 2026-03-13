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
import type { WorkspaceStatisticsRange } from './dto/workspace-statistics-query.dto';
import type { WorkspacePublicCityActivityItemDto } from './dto/workspace-public-response.dto';
import type {
  WorkspaceStatisticsCategoryDemandDto,
  WorkspaceStatisticsCityDemandDto,
  WorkspaceStatisticsOpportunityMetricDto,
  WorkspaceStatisticsOpportunityRadarItemDto,
  WorkspaceStatisticsOverviewResponseDto,
  WorkspaceStatisticsPriceIntelligenceDto,
  WorkspaceStatisticsProfileFunnelDto,
} from './dto/workspace-statistics-response.dto';
import { InsightsService, type AnalyticsSnapshot } from './insights.service';
import { WorkspaceService } from './workspace.service';

@Injectable()
export class WorkspaceStatisticsService {
  private static readonly CATEGORY_RESPONSE_LIMIT = 50;

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

  private slugifyCityName(cityName: string): string {
    return cityName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
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
        activeProviders: 0,
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
    rangeInput: WorkspaceStatisticsRange | undefined,
    userId?: string | null,
    role?: AppRole | null,
  ): Promise<WorkspaceStatisticsOverviewResponseDto> {
    const range = this.resolveRange(rangeInput);
    const { start, end } = this.resolveWindow(range);
    const normalizedUserId = String(userId ?? '').trim();
    const hasActorScope = normalizedUserId.length > 0;

    const requestFunnelMatch = hasActorScope
      ? { clientId: normalizedUserId }
      : { status: 'published' };
    const offerFunnelMatch = hasActorScope
      ? { $or: [{ providerUserId: normalizedUserId }, { clientUserId: normalizedUserId }] }
      : {};
    const contractFunnelMatch = hasActorScope
      ? { $or: [{ providerUserId: normalizedUserId }, { clientId: normalizedUserId }] }
      : {};

    const [
      publicOverview,
      activity,
      categoryRows,
      cityRows,
      offerCityRows,
      searchCityRows,
      requestResponseRows,
      contractLifecycleRows,
      reviewSummary,
      funnelRequestsTotal,
      funnelOffersRows,
      funnelContractsRows,
    ] = await Promise.all([
      this.workspace.getPublicOverview({
        page: 1,
        limit: 100,
        cityActivityLimit: 5000,
        activityRange: range,
      }),
      this.analytics.getPlatformActivity(range),
      this.requestModel
        .aggregate<{ _id: { categoryKey?: string | null; categoryName?: string | null; subcategoryName?: string | null; serviceKey?: string | null }; count: number }>([
          {
            $match: {
              status: 'published',
              createdAt: { $gte: start, $lte: end },
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
        .exec(),
      this.requestModel
        .aggregate<{ _id: { cityId?: string | null; cityName?: string | null }; requestCount: number; anbieterSuchenCount: number }>([
          {
            $match: {
              status: 'published',
              createdAt: { $gte: start, $lte: end },
            },
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
      this.analytics.getCitySearchCounts(range),
      this.requestModel
        .aggregate<{ createdAt: Date; firstOfferAt: Date | null; responseMinutes: number | null }>([
          {
            $match: {
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
      this.requestModel.countDocuments({
        ...requestFunnelMatch,
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
    ]);

    const activityTotals = this.toActivityTotals(activity.data);
    const activityResponseMinutes = requestResponseRows
      .map((row) => row.responseMinutes)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
    const responseMedianMinutes = this.toMedian(activityResponseMinutes);
    const unansweredThreshold = new Date(end.getTime() - 24 * 60 * 60 * 1000);
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

    const ratingAgg = reviewSummary[0] ?? { total: 0, average: 0 };

    let mode: 'platform' | 'personalized' = 'platform';
    let privateOverview: WorkspacePrivateOverviewResponseDto | null = null;

    if (normalizedUserId) {
      privateOverview = await this.workspace.getPrivateOverview(normalizedUserId, role ?? 'client');
      mode = 'personalized';
    }

    let summary = {
      totalPublishedRequests: publicOverview.summary.totalPublishedRequests,
      totalActiveProviders: publicOverview.summary.totalActiveProviders,
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
      requestsTotal: mode === 'personalized'
        ? privateOverview?.requestsByStatus.total ?? 0
        : activityTotals.requestsTotal,
      offersTotal: mode === 'personalized'
        ? privateOverview?.providerOffersByStatus.sent ?? 0
        : activityTotals.offersTotal,
      completedJobsTotal: mode === 'personalized'
        ? personalizedCompletedJobs
        : completedJobsRange,
      successRate: mode === 'personalized'
        ? privateOverview?.kpis.acceptanceRate ?? 0
        : this.clampPercent(
            (completedJobsRange / Math.max(1, activityTotals.requestsTotal)) * 100,
          ),
      avgResponseMinutes: mode === 'personalized' ? privateOverview?.kpis.avgResponseMinutes ?? null : null,
      profileCompleteness: mode === 'personalized' ? personalizedProfileCompleteness : null,
      openRequests: mode === 'personalized' ? privateOverview?.kpis.myOpenRequests ?? null : null,
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
      const shouldBackfillPrice =
        !this.hasPriceSignal(priceIntelligence) || !this.hasProfitPotentialSignal(priceIntelligence);

      if (
        shouldBackfillCategories ||
        shouldBackfillCitySignals ||
        shouldBackfillOpportunity ||
        shouldBackfillPrice
      ) {
        const baseline = await this.getStatisticsOverview(
          '30d',
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
        '30d',
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

    const funnelOffersAgg = funnelOffersRows[0] ?? { offersTotal: 0, confirmedResponsesTotal: 0 };
    const funnelContractsAgg = funnelContractsRows[0] ?? {
      closedContractsTotal: 0,
      completedJobsTotal: 0,
      profitAmount: 0,
    };

    const rawRequestsFunnelTotal = Math.max(0, Math.round(Number(funnelRequestsTotal ?? 0)));
    const fallbackPlatformRequestsTotal =
      mode === 'platform' && range === '24h'
        ? Math.max(0, Math.round(Number(summary.totalPublishedRequests ?? 0)))
        : 0;
    const requestsFunnelTotal =
      rawRequestsFunnelTotal > 0 ? rawRequestsFunnelTotal : fallbackPlatformRequestsTotal;
    const offersFunnelTotal = Math.max(0, Math.round(Number(funnelOffersAgg.offersTotal ?? 0)));
    const confirmedResponsesTotal = Math.max(0, Math.round(Number(funnelOffersAgg.confirmedResponsesTotal ?? 0)));
    const closedContractsTotal = Math.max(0, Math.round(Number(funnelContractsAgg.closedContractsTotal ?? 0)));
    const completedFunnelTotal = Math.max(0, Math.round(Number(funnelContractsAgg.completedJobsTotal ?? 0)));
    const profitAmount = this.roundMoney(Math.max(0, Number(funnelContractsAgg.profitAmount ?? 0)));

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

    const stages: WorkspaceStatisticsProfileFunnelDto['stages'] = [
      {
        id: 'requests',
        label: 'Anfragen',
        value: requestsFunnelTotal,
        displayValue: this.formatInt(requestsFunnelTotal),
        widthPercent: requestsWidthPercent,
        rateLabel: 'Basis',
        ratePercent: 100,
        helperText: null,
      },
      {
        id: 'offers',
        label: 'Angebote von Anbietern',
        value: offersFunnelTotal,
        displayValue: this.formatInt(offersFunnelTotal),
        widthPercent: offersWidthPercent,
        rateLabel: 'Antwortquote',
        ratePercent: offerResponseRatePercent,
        helperText: null,
      },
      {
        id: 'confirmations',
        label: 'Bestätigte Rückmeldungen',
        value: confirmedResponsesTotal,
        displayValue: this.formatInt(confirmedResponsesTotal),
        widthPercent: confirmationsWidthPercent,
        rateLabel: 'Zustimmungsrate',
        ratePercent: confirmationRatePercent,
        helperText: null,
      },
      {
        id: 'contracts',
        label: 'Geschlossene Verträge',
        value: closedContractsTotal,
        displayValue: this.formatInt(closedContractsTotal),
        widthPercent: contractsWidthPercent,
        rateLabel: 'Abschlussrate',
        ratePercent: contractClosureRatePercent,
        helperText: null,
      },
      {
        id: 'completed',
        label: 'Erfolgreich abgeschlossen',
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

    const updatedAt = new Date().toISOString();
    const decisionInsight = this.buildDecisionInsight({
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

    return {
      updatedAt,
      mode,
      range,
      decisionInsight,
      summary,
      kpis,
      activity: {
        range,
        interval: activity.interval,
        points: activity.data,
        totals: activityTotals,
        metrics: activityMetrics,
      },
      demand: {
        categories,
        cities,
      },
      opportunityRadar,
      priceIntelligence,
      profileFunnel,
      insights,
      growthCards: this.buildGrowthCards(),
    };
  }
}
