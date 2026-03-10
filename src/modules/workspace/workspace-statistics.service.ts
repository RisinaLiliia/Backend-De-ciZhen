import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AnalyticsService } from '../analytics/analytics.service';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Review, type ReviewDocument } from '../reviews/schemas/review.schema';
import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspacePrivateOverviewResponseDto } from './dto/workspace-private-response.dto';
import type { WorkspaceStatisticsRange } from './dto/workspace-statistics-query.dto';
import type {
  WorkspaceStatisticsCityDemandDto,
  WorkspaceStatisticsInsightDto,
  WorkspaceStatisticsOverviewResponseDto,
} from './dto/workspace-statistics-response.dto';
import { WorkspaceService } from './workspace.service';

@Injectable()
export class WorkspaceStatisticsService {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly analytics: AnalyticsService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
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

  private buildInsights(params: {
    mode: 'platform' | 'personalized';
    profileCompleteness: number | null;
    successRate: number;
    avgResponseMinutes: number | null;
    topCategoryName: string | null;
    topCityName: string | null;
  }): WorkspaceStatisticsInsightDto[] {
    const items: WorkspaceStatisticsInsightDto[] = [];

    if (params.mode === 'personalized' && params.profileCompleteness !== null && params.profileCompleteness < 80) {
      items.push({ level: 'warning', code: 'profile_incomplete', context: String(params.profileCompleteness) });
    }

    if (params.mode === 'personalized' && params.successRate < 25) {
      items.push({ level: 'warning', code: 'low_success_rate', context: String(params.successRate) });
    }

    if (params.mode === 'personalized' && params.avgResponseMinutes !== null) {
      if (params.avgResponseMinutes <= 30) {
        items.push({ level: 'trend', code: 'strong_response_time', context: String(params.avgResponseMinutes) });
      } else {
        items.push({ level: 'info', code: 'slow_response_time', context: String(params.avgResponseMinutes) });
      }
    }

    if (params.topCategoryName) {
      items.push({ level: 'trend', code: 'high_category_demand', context: params.topCategoryName });
    }

    if (params.topCityName) {
      items.push({ level: 'info', code: 'top_city_demand', context: params.topCityName });
    }

    if (items.length === 0) {
      items.push({ level: 'info', code: 'insufficient_data', context: null });
    }

    return items.slice(0, 4);
  }

  private buildGrowthCards() {
    return [
      { key: 'highlight_profile', href: '/workspace?section=profile' },
      { key: 'local_ads', href: '/workspace?section=requests' },
      { key: 'premium_tools', href: '/provider/onboarding' },
    ];
  }

  async getStatisticsOverview(
    rangeInput: WorkspaceStatisticsRange | undefined,
    userId?: string | null,
    role?: AppRole | null,
  ): Promise<WorkspaceStatisticsOverviewResponseDto> {
    const range = this.resolveRange(rangeInput);
    const { start, end } = this.resolveWindow(range);

    const [publicOverview, activity, categoryRows, cityRows, completedJobsRange, reviewSummary] = await Promise.all([
      this.workspace.getPublicOverview({
        page: 1,
        limit: 100,
        cityActivityLimit: 50,
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
          { $limit: 8 },
        ])
        .exec(),
      this.requestModel
        .aggregate<{ _id: { cityId?: string | null; cityName?: string | null }; count: number }>([
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
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ])
        .exec(),
      this.contractModel
        .countDocuments({
          status: 'completed',
          completedAt: { $gte: start, $lte: end },
        })
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
    ]);

    const activityTotals = this.toActivityTotals(activity.data);
    const categoryTotal = categoryRows.reduce((sum, row) => sum + row.count, 0);

    const categories = categoryRows.map((row) => {
      const categoryName =
        String(row._id?.categoryName ?? '').trim() ||
        String(row._id?.subcategoryName ?? '').trim() ||
        String(row._id?.serviceKey ?? '').trim() ||
        'Other';

      return {
        categoryKey: row._id?.categoryKey ?? null,
        categoryName,
        requestCount: Math.max(0, Math.round(row.count || 0)),
        sharePercent: categoryTotal > 0 ? this.clampPercent((row.count / categoryTotal) * 100) : 0,
      };
    });

    const coordsBySlug = new Map(
      publicOverview.cityActivity.items.map((item) => [
        item.citySlug,
        { cityId: item.cityId, lat: item.lat, lng: item.lng },
      ]),
    );

    const cities: WorkspaceStatisticsCityDemandDto[] = cityRows.map((row) => {
      const cityName = String(row._id?.cityName ?? '').trim();
      const citySlug = this.slugifyCityName(cityName);
      const coords = coordsBySlug.get(citySlug);

      const resolvedCityId = String(row._id?.cityId ?? '').trim();

      return {
        citySlug,
        cityName,
        cityId: resolvedCityId.length > 0 ? resolvedCityId : (coords?.cityId ?? null),
        requestCount: Math.max(0, Math.round(row.count || 0)),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      };
    });

    const ratingAgg = reviewSummary[0] ?? { total: 0, average: 0 };

    let mode: 'platform' | 'personalized' = 'platform';
    let privateOverview: WorkspacePrivateOverviewResponseDto | null = null;

    const normalizedUserId = String(userId ?? '').trim();
    if (normalizedUserId) {
      privateOverview = await this.workspace.getPrivateOverview(normalizedUserId, role ?? 'client');
      mode = 'personalized';
    }

    const summary = {
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
        : Math.max(0, Math.round(completedJobsRange)),
      successRate: mode === 'personalized'
        ? privateOverview?.kpis.acceptanceRate ?? 0
        : this.clampPercent(
            (Math.max(0, Math.round(completedJobsRange)) / Math.max(1, activityTotals.requestsTotal)) * 100,
          ),
      avgResponseMinutes: mode === 'personalized' ? privateOverview?.kpis.avgResponseMinutes ?? null : null,
      profileCompleteness: mode === 'personalized' ? personalizedProfileCompleteness : null,
      openRequests: mode === 'personalized' ? privateOverview?.kpis.myOpenRequests ?? null : null,
      recentOffers7d: mode === 'personalized' ? privateOverview?.kpis.recentOffers7d ?? null : null,
    };

    const profileFunnel = mode === 'personalized'
      ? {
          stage1: privateOverview?.kpis.myOpenRequests ?? 0,
          stage2: privateOverview?.providerOffersByStatus.sent ?? 0,
          stage3: privateOverview?.providerOffersByStatus.accepted ?? 0,
          stage4: personalizedCompletedJobs,
          conversionRate: privateOverview?.kpis.acceptanceRate ?? 0,
        }
      : {
          stage1: activityTotals.requestsTotal,
          stage2: activityTotals.offersTotal,
          stage3: Math.max(0, Math.round(completedJobsRange)),
          stage4: Math.max(0, Math.round(completedJobsRange)),
          conversionRate: this.clampPercent(
            (Math.max(0, Math.round(completedJobsRange)) / Math.max(1, activityTotals.requestsTotal)) * 100,
          ),
        };

    const insights = this.buildInsights({
      mode,
      profileCompleteness: kpis.profileCompleteness,
      successRate: kpis.successRate,
      avgResponseMinutes: kpis.avgResponseMinutes,
      topCategoryName: categories[0]?.categoryName ?? null,
      topCityName: cities[0]?.cityName ?? null,
    });

    return {
      updatedAt: new Date().toISOString(),
      mode,
      range,
      summary,
      kpis,
      activity: {
        range,
        interval: activity.interval,
        points: activity.data,
        totals: activityTotals,
      },
      demand: {
        categories,
        cities,
      },
      profileFunnel,
      insights,
      growthCards: this.buildGrowthCards(),
    };
  }
}
