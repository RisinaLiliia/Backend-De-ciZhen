import type { ConfigService } from '@nestjs/config';

import type { WorkspaceStatisticsRange } from './dto/workspace-statistics-query.dto';
import type { WorkspacePublicCityActivityItemDto } from './dto/workspace-public-response.dto';
import type {
  WorkspaceStatisticsCategoryDemandDto,
  WorkspaceStatisticsContextHealthDto,
  WorkspaceStatisticsCityDemandDto,
  WorkspaceStatisticsDecisionContextDto,
  WorkspaceStatisticsFilterOptionDto,
  WorkspaceStatisticsOpportunityRadarItemDto,
  WorkspaceStatisticsOverviewResponseDto,
  WorkspaceStatisticsSectionMetaDto,
} from './dto/workspace-statistics-response.dto';
import type { WorkspaceStatisticsCategoryAggregateRow } from './workspace-statistics-market-snapshots.service';
import { WorkspaceStatisticsProfileSupport } from './workspace-statistics-profile.support';

export class WorkspaceStatisticsOverviewSupport extends WorkspaceStatisticsProfileSupport {
  protected buildFilterOptions(params: {
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

  protected buildContextHealth(params: {
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

  protected buildSectionMeta(context: WorkspaceStatisticsDecisionContextDto): WorkspaceStatisticsSectionMetaDto {
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

  protected buildExportMeta(params: {
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

  protected getPlatformTakeRatePercent(config: ConfigService): number {
    const raw = Number(config.get('app.platformTakeRatePercent') ?? 10);
    if (!Number.isFinite(raw)) return 10;
    return Math.max(0, Math.min(100, this.roundMoney(raw)));
  }
}
