import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { CitySearchCountsRow } from '../analytics/analytics.service';
import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspacePrivateOverviewResponseDto } from './dto/workspace-private-response.dto';
import type {
  WorkspaceStatisticsQueryDto,
  WorkspaceStatisticsRange,
} from './dto/workspace-statistics-query.dto';
import type {
  WorkspaceStatisticsCityDemandDto,
  WorkspaceStatisticsDecisionContextDto,
  WorkspaceStatisticsOverviewResponseDto,
  WorkspaceStatisticsPriceIntelligenceDto,
} from './dto/workspace-statistics-response.dto';
import { InsightsService } from './insights.service';
import {
  type FunnelStageCounts,
} from './workspace-statistics.support';
import { WorkspaceStatisticsMarketSnapshotsService } from './workspace-statistics-market-snapshots.service';
import { WorkspaceStatisticsOverviewSupport } from './workspace-statistics-overview.support';
import {
  WorkspaceStatisticsViewerSnapshotsService,
} from './workspace-statistics-viewer-snapshots.service';
import { WorkspaceService } from './workspace.service';

@Injectable()
export class WorkspaceStatisticsService extends WorkspaceStatisticsOverviewSupport {
  private static readonly CATEGORY_RESPONSE_LIMIT = 50;
  private static readonly ALL_CITIES_LABEL = 'Alle Städte';
  private static readonly ALL_CATEGORIES_LABEL = 'Alle Kategorien';
  private static readonly ALL_REGIONS_LABEL = 'Alle Regionen';
  private static readonly ALL_SERVICES_LABEL = 'Alle Services';

  constructor(
    private readonly config: ConfigService,
    private readonly workspace: WorkspaceService,
    private readonly insightsService: InsightsService,
    private readonly marketSnapshots: WorkspaceStatisticsMarketSnapshotsService,
    private readonly viewerSnapshots: WorkspaceStatisticsViewerSnapshotsService,
  ) {
    super();
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

    const viewerSnapshotsPromise = this.viewerSnapshots.loadViewerSnapshots({
      hasActorScope,
      viewerMode,
      normalizedUserId,
      cityId,
      categoryKey,
      subcategoryKey,
      start,
      end,
      requestRefScopeMatch,
      funnelRequestRefScopeMatch,
    });
    const marketSnapshotsPromise = this.marketSnapshots.loadMarketSnapshots({
      range,
      filterOptionsRange,
      start,
      end,
      filterOptionsStart,
      filterOptionsEnd,
      cityId,
      categoryKey,
      subcategoryKey,
      hasActorScope,
      requestFunnelMatch,
      offerFunnelMatch,
      contractFunnelMatch,
      scopedRequestMatch,
      requestRefScopeMatch,
      funnelRequestRefScopeMatch,
    });

    const [
      {
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
      },
      viewerSnapshots,
    ] = await Promise.all([marketSnapshotsPromise, viewerSnapshotsPromise]);

    const unansweredThreshold = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const {
      viewerScopedResponseMinutes,
      viewerScopedUnansweredOver24h,
    } = await this.viewerSnapshots.loadViewerDecisionSnapshot({
      hasActorScope,
      viewerMode,
      normalizedUserId,
      cityId,
      categoryKey,
      subcategoryKey,
      start,
      end,
      funnelRequestRefScopeMatch,
      unansweredThreshold,
    });
    const {
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
    } = viewerSnapshots;

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
    const takeRatePercent = this.getPlatformTakeRatePercent(this.config);
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
    let { opportunityRadar, topOpportunity } = this.buildInitialOpportunityRadar({
      cities,
      growthIndex,
      responseSpeedIndex,
      categoryLeaders,
    });
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
    const {
      profileFunnel,
      funnelComparison,
      decisionLayer,
      selectedUserAverageOrderValue,
      conversionRatePercent,
    } = this.buildProfileFunnelContext({
      range,
      mode,
      viewerMode,
      marketCounts,
      marketRevenueAmount,
      providerCounts,
      providerRevenueAmount,
      customerCounts,
      customerRevenueAmount,
      viewerScopedResponseMinutes,
      viewerScopedUnansweredOver24h,
      activityMetrics,
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
