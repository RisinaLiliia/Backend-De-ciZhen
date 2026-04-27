import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspacePublicCityActivityItemDto } from './dto/workspace-public-response.dto';
import type {
  WorkspaceStatisticsCategoryDemandDto,
  WorkspaceStatisticsCityDemandDto,
  WorkspaceStatisticsOpportunityMetricDto,
  WorkspaceStatisticsOpportunityPeerContextDto,
  WorkspaceStatisticsOpportunityRadarItemDto,
  WorkspaceStatisticsOverviewResponseDto,
  WorkspaceStatisticsPriceIntelligenceDto,
  WorkspaceStatisticsProfileFunnelDto,
} from './dto/workspace-statistics-response.dto';
import type { WorkspaceStatisticsRange } from './dto/workspace-statistics-query.dto';
import type { AnalyticsSnapshot } from './insights.service';
import { WorkspaceStatisticsDecisionSupport } from './workspace-statistics-decision.support';

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

type ScoredMarketOpportunity = {
  cityId: string | null;
  citySlug: string;
  city: string;
  demand: number;
  providers: number | null;
  marketBalanceRatio: number | null;
  score: number;
  demandScore: number;
  competitionScore: number;
  growthScore: number;
  activityScore: number;
  status: WorkspaceStatisticsOpportunityRadarItemDto['status'];
  tone: WorkspaceStatisticsOpportunityRadarItemDto['tone'];
  summaryKey: WorkspaceStatisticsOpportunityRadarItemDto['summaryKey'];
  metrics: WorkspaceStatisticsOpportunityMetricDto[];
};

export class WorkspaceStatisticsMarketSupport extends WorkspaceStatisticsDecisionSupport {
  protected slugifyCityName(cityName: string): string {
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

  protected buildRankedCityCandidates(params: {
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

  protected paginateCityList(params: {
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
      20,
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

  protected selectScopedCityRows(params: {
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

  protected buildOpportunityRadarFromCluster(params: {
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

  protected buildGrowthCards() {
    return [
      { key: 'highlight_profile', href: '/workspace?section=profile' },
      { key: 'local_ads', href: '/workspace?section=requests' },
      { key: 'premium_tools', href: '/provider/onboarding' },
    ];
  }

  protected buildInitialOpportunityRadar(params: {
    cities: WorkspaceStatisticsCityDemandDto[];
    growthIndex: number;
    responseSpeedIndex: number;
    categoryLeaders: WorkspaceStatisticsCategoryDemandDto[];
  }): {
    opportunityRadar: WorkspaceStatisticsOpportunityRadarItemDto[];
    topOpportunity: ScoredMarketOpportunity | null;
  } {
    const demandByCity = params.cities.map((city) => Math.max(city.requestCount, city.anbieterSuchenCount ?? 0));
    const maxDemand = Math.max(1, ...demandByCity);

    const rankedOpportunities = params.cities
      .map((city) => {
        const demand = Math.max(city.requestCount, city.anbieterSuchenCount ?? 0);
        const providers = city.auftragSuchenCount;
        const demandIndex = this.clampUnit(demand / maxDemand);
        const competitionOpportunityIndex = city.marketBalanceRatio === null
          ? 0.5
          : this.clampUnit(city.marketBalanceRatio / 1.5);

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
      })
      .sort((a, b) =>
        (b.score - a.score) ||
        (b.demand - a.demand) ||
        a.city.localeCompare(b.city, 'de-DE'),
      )
      .slice(0, 3);

    return {
      opportunityRadar: rankedOpportunities.map((item, index) => {
        const category = params.categoryLeaders[index] ?? null;
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
      }),
      topOpportunity: rankedOpportunities[0] ?? null,
    };
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

  protected hasCitySearchSignals(cities: WorkspaceStatisticsCityDemandDto[]): boolean {
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

  protected resolveCitySearchMetrics(params: {
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

  protected hasIncompleteCitySearchSignals(cities: WorkspaceStatisticsCityDemandDto[]): boolean {
    return cities.some((city) => {
      if (city.requestCount <= 0) return false;
      const hasRequestSearchCount =
        typeof city.auftragSuchenCount === 'number' && Number.isFinite(city.auftragSuchenCount);
      const hasProviderSearchCount =
        typeof city.anbieterSuchenCount === 'number' && Number.isFinite(city.anbieterSuchenCount);
      return !hasRequestSearchCount || !hasProviderSearchCount;
    });
  }

  protected hasPriceSignal(priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto): boolean {
    return (
      Number.isFinite(priceIntelligence.marketAverage) ||
      Number.isFinite(priceIntelligence.recommendedMin) ||
      Number.isFinite(priceIntelligence.recommendedMax)
    );
  }

  protected hasProfitPotentialSignal(priceIntelligence: WorkspaceStatisticsPriceIntelligenceDto): boolean {
    return Number.isFinite(priceIntelligence.profitPotentialScore);
  }

  protected hasOpportunityCategoryData(opportunityRadar: WorkspaceStatisticsOpportunityRadarItemDto[]): boolean {
    return opportunityRadar.some((item) => Boolean(item.categoryKey || item.category));
  }

  protected cityIdKey(value: string | null | undefined): string {
    return String(value ?? '').trim();
  }

  protected citySlugKey(value: string | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
  }

  protected cityNameKey(value: string | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
  }

  protected mergeCityRankingWithPublicOverview(params: {
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

  protected mergeCitySearchSignals(
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

  protected buildInsightsSnapshot(params: {
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
}
