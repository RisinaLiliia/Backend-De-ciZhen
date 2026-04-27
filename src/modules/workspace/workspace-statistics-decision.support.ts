import type {
  WorkspaceStatisticsActivityComparisonDto,
  WorkspaceStatisticsCategoryDemandDto,
  WorkspaceStatisticsCategoryFitDto,
  WorkspaceStatisticsCityDemandDto,
  WorkspaceStatisticsCityComparisonDto,
  WorkspaceStatisticsInsightDto,
  WorkspaceStatisticsDecisionLayerDto,
  WorkspaceStatisticsOverviewResponseDto,
  WorkspaceStatisticsPersonalizedPricingDto,
  WorkspaceStatisticsPriceIntelligenceDto,
  WorkspaceStatisticsRecommendationSectionDto,
} from './dto/workspace-statistics-response.dto';
import type { WorkspaceStatisticsViewerMode } from './dto/workspace-statistics-query.dto';
import {
  WorkspaceStatisticsSupport,
  type FunnelStageCounts,
} from './workspace-statistics.support';

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

export class WorkspaceStatisticsDecisionSupport extends WorkspaceStatisticsSupport {
  protected resolvePriceSmartSignalTone(params: {
    smartRecommendedPrice: number | null;
    marketAverage: number | null;
  }): WorkspaceStatisticsPriceIntelligenceDto['smartSignalTone'] {
    if (params.smartRecommendedPrice === null || params.marketAverage === null) return null;
    const delta = params.smartRecommendedPrice - params.marketAverage;
    if (delta <= -10) return 'visibility';
    if (delta >= 10) return 'premium';
    return 'balanced';
  }

  protected resolvePriceConfidenceLevel(
    analyzedRequestsCount: number | null,
  ): WorkspaceStatisticsPriceIntelligenceDto['confidenceLevel'] {
    if (analyzedRequestsCount === null || analyzedRequestsCount <= 0) return null;
    if (analyzedRequestsCount >= 100) return 'high';
    if (analyzedRequestsCount >= 40) return 'medium';
    return 'low';
  }

  protected buildDecisionInsight(params: {
    activityMetrics: WorkspaceStatisticsOverviewResponseDto['activity']['metrics'];
    conversionRatePercent: number;
  }): string {
    const offerRatePercent = this.clampPercent(Number(params.activityMetrics.offerRatePercent ?? 0));
    const unansweredRequests24h = Math.max(
      0,
      Math.round(Number(params.activityMetrics.unansweredRequests24h ?? 0)),
    );
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

  protected computeRelativeGap(userValue: number | null, marketValue: number | null): number | null {
    if (typeof userValue !== 'number' || typeof marketValue !== 'number' || marketValue === 0) {
      return null;
    }
    return this.roundPercent(((userValue - marketValue) / Math.abs(marketValue)) * 100);
  }

  protected resolveDecisionMetric(
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
    const hasComparison =
      typeof params.userValue === 'number' && typeof params.marketValue === 'number';
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

  protected buildDecisionLayer(params: {
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

    const marketOfferRate = this.computeRate(
      params.marketCounts.offers,
      params.marketCounts.requests,
    );
    const userOfferRate = this.computeRate(params.userCounts.offers, params.userCounts.requests);

    const isCustomerMode = params.viewerMode === 'customer';
    const lowConfidenceSummary =
      'Vergleich basiert aktuell auf begrenzten viewer-spezifischen Daten.';
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
        signalCodes:
          userOfferRate !== null &&
          marketOfferRate !== null &&
          userOfferRate >= marketOfferRate
            ? ['strong_position']
            : ['low_visibility'],
        primaryActionCode:
          userOfferRate !== null &&
          marketOfferRate !== null &&
          userOfferRate < marketOfferRate
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
        signalCodes:
          params.userCounts.completed >= params.marketCounts.completed ? ['strong_position'] : [],
        primaryActionCode:
          params.userCounts.completed < params.marketCounts.completed ? 'focus_market' : null,
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
        signalCodes:
          params.userRevenueAmount >= params.marketRevenueAmount ? ['strong_position'] : [],
        primaryActionCode:
          params.userRevenueAmount < params.marketRevenueAmount && !isCustomerMode
            ? 'focus_market'
            : null,
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
      ? metrics
          .filter((metric) => metric.status === 'critical' || metric.status === 'warning')
          .sort((left, right) => {
            const leftPriority = left.status === 'critical' ? 2 : 1;
            const rightPriority = right.status === 'critical' ? 2 : 1;
            return rightPriority - leftPriority;
          })[0] ??
        metrics.find((metric) => metric.status === 'good') ??
        metrics.find((metric) => Boolean(metric.summary)) ??
        metrics[0] ??
        null
      : null;

    const primaryInsight = params.reliableComparison
      ? rankedMetric?.summary ?? null
      : lowConfidenceSummary;
    const primaryAction =
      params.reliableComparison && rankedMetric?.primaryActionCode
        ? {
            code: rankedMetric.primaryActionCode,
            label:
              rankedMetric.primaryActionCode === 'respond_faster'
                ? 'Schneller reagieren'
                : rankedMetric.primaryActionCode === 'follow_up_unanswered'
                  ? 'Offene Vorgänge priorisieren'
                  : rankedMetric.primaryActionCode === 'adjust_price'
                    ? 'Preisstrategie prüfen'
                    : rankedMetric.primaryActionCode === 'complete_profile'
                      ? 'Profil vervollständigen'
                      : 'Marktfokus schärfen',
            target:
              rankedMetric.primaryActionCode === 'focus_market'
                ? '/workspace?section=stats&focus=cities'
                : '/workspace?section=requests&scope=my&period=90d&range=90d',
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

  protected toActivityLevel(
    value: number,
    maxValue: number,
  ): 'high' | 'medium' | 'low' | 'unknown' {
    if (maxValue <= 0 || value <= 0) return maxValue <= 0 ? 'unknown' : 'low';
    const ratio = value / maxValue;
    if (ratio >= 0.66) return 'high';
    if (ratio >= 0.33) return 'medium';
    return 'low';
  }

  protected resolvePricingComparisonReliability(params: {
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

  protected resolveFitReliability(params: {
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

  protected resolveInsightReliability(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.65) return 'medium';
    return 'low';
  }

  protected resolveInsightActionCode(insight: WorkspaceStatisticsInsightDto): string | null {
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

  protected toRecommendationAction(
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
        target: '/workspace?section=requests&scope=my&period=90d&range=90d',
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

  protected buildRecommendationSection(params: {
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
      hasReliableItems: items.some(
        (item) => item.reliability === 'high' || item.reliability === 'medium',
      ),
      items,
    };
  }

  protected buildPersonalizedPricing(params: {
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
        ? position === 'within'
          ? 'positive'
          : position === 'above'
            ? 'warning'
            : 'neutral'
        : 'neutral';
    const actionCode =
      comparisonReliability === 'high' || comparisonReliability === 'medium'
        ? position === 'within' || position === 'unknown'
          ? null
          : 'adjust_price'
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

  protected buildCategoryFit(params: {
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
      hasReliableItems: items.some(
        (item) => item.reliability === 'high' || item.reliability === 'medium',
      ),
      items,
    };
  }

  protected buildCityComparison(params: {
    mode: 'platform' | 'personalized';
    cities: WorkspaceStatisticsCityDemandDto[];
    userRows: UserCityActivityRow[];
  }): WorkspaceStatisticsCityComparisonDto | null {
    if (params.mode !== 'personalized') return null;

    const userByCity = new Map<string, UserCityActivityRow>();
    for (const row of params.userRows) {
      const key =
        this.normalizeScopeFilter(row.cityId) ??
        this.normalizeScopeFilter(row.cityName) ??
        '__null__';
      userByCity.set(key, row);
    }
    const maxBase = Math.max(0, ...params.userRows.map((row) => row.baseCount));
    const items = params.cities.slice(0, 5).map((city) => {
      const key =
        this.normalizeScopeFilter(city.cityId) ??
        this.normalizeScopeFilter(city.cityName) ??
        '__null__';
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
      hasReliableItems: items.some(
        (item) => item.reliability === 'high' || item.reliability === 'medium',
      ),
      items,
    };
  }

  protected toProfitPotentialStatus(
    score: number | null,
  ): WorkspaceStatisticsPriceIntelligenceDto['profitPotentialStatus'] {
    if (typeof score !== 'number' || !Number.isFinite(score)) return null;
    if (score >= 7.5) return 'high';
    if (score >= 5.5) return 'medium';
    return 'low';
  }

  protected buildPriceIntelligence(params: {
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
      typeof params.topOpportunity?.score === 'number' &&
      Number.isFinite(params.topOpportunity.score)
        ? Math.max(0, Math.min(10, params.topOpportunity.score))
        : null;
    const demandFactor =
      typeof params.topOpportunity?.demandScore === 'number' &&
      Number.isFinite(params.topOpportunity.demandScore)
        ? Math.max(0.35, Math.min(1.25, params.topOpportunity.demandScore / 10))
        : 0.75;
    const competitionFactor =
      typeof params.topOpportunity?.competitionScore === 'number' &&
      Number.isFinite(params.topOpportunity.competitionScore)
        ? Math.max(0.45, Math.min(1.35, params.topOpportunity.competitionScore / 10))
        : 0.8;

    const hasAverageRevenue =
      typeof params.avgRevenue === 'number' &&
      Number.isFinite(params.avgRevenue) &&
      params.avgRevenue > 0;
    const averageRevenueValue = hasAverageRevenue ? params.avgRevenue : null;
    const recommendedMin =
      averageRevenueValue !== null
        ? this.roundToNearestStep(averageRevenueValue * 0.85, 5)
        : null;
    const recommendedMax =
      averageRevenueValue !== null
        ? this.roundToNearestStep(averageRevenueValue * 1.15, 5)
        : null;
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
            const normalized = Math.max(
              0,
              Math.min(1, 1 - distance / Math.max(1, halfRange)),
            );
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
                  (((opportunityScore / 10) * priceScore * (0.72 + demandFactor * 0.28)) /
                    competitionFactor) *
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

  protected toMedian(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return this.roundMoney((sorted[middle - 1] + sorted[middle]) / 2);
    }
    return this.roundMoney(sorted[middle]);
  }

  protected toActivityTotals(points: Array<{ timestamp: string; requests: number; offers: number }>) {
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

  protected buildActivityComparisonSeries(params: {
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

  protected buildActivityComparison(params: {
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
    const totalProviderActivity = providerSeries.reduce<number>(
      (sum, value) => sum + (value ?? 0),
      0,
    );
    const hasReliableSeries = totalClientActivity > 0 || totalProviderActivity > 0;

    const combinedSeries = params.marketPoints.map((point, index) => ({
      timestamp: point.timestamp,
      score: (clientSeries[index] ?? 0) + (providerSeries[index] ?? 0),
    }));
    const userPeak = combinedSeries.reduce<{ timestamp: string; score: number } | null>(
      (acc, point) => {
        if (!acc || point.score > acc.score) return point;
        return acc;
      },
      null,
    );

    const summary = !hasReliableSeries
      ? 'Noch keine eigene Aktivität im gewählten Zeitraum.'
      : userPeak?.timestamp &&
          params.activityTotals.peakTimestamp &&
          userPeak.timestamp === params.activityTotals.peakTimestamp
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
}
