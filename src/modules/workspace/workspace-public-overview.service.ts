import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AnalyticsService, type PlatformActivityRange } from '../analytics/analytics.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { RequestsService } from '../requests/requests.service';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { ProviderProfile, type ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import type {
  WorkspacePublicQueryDto,
} from './dto/workspace-public-query.dto';
import type {
  WorkspacePublicOverviewResponseDto,
  WorkspacePublicCityActivityItemDto,
} from './dto/workspace-public-response.dto';
import type { RequestPublicDto } from '../requests/dto/request-public.dto';
import type { WorkspacePublicRequestsBatchResponseDto } from './dto/workspace-public-requests-batch.dto';
import { WorkspacePublicRequestEnricherService } from './workspace-public-request-enricher.service';

@Injectable()
export class WorkspacePublicOverviewService {
  private normalizeId(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    const str = (value as any)?.toString?.();
    if (typeof str !== 'string') return null;
    const trimmed = str.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  constructor(
    private readonly requests: RequestsService,
    private readonly analytics: AnalyticsService,
    private readonly cities: CitiesService,
    private readonly enricher: WorkspacePublicRequestEnricherService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(ProviderProfile.name) private readonly providerModel: Model<ProviderProfileDocument>,
  ) {}


  private slugifyCityName(cityName: string): string {
    return cityName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private resolveRangeWindow(range: PlatformActivityRange): { start: Date; end: Date } {
    const now = new Date();
    const end = now;
    const start = new Date(now);
    if (range === '24h') {
      start.setHours(now.getHours() - 24);
    } else if (range === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (range === '90d') {
      start.setDate(now.getDate() - 90);
    } else {
      start.setDate(now.getDate() - 30);
    }
    return { start, end };
  }

  async getPublicOverview(query: WorkspacePublicQueryDto): Promise<WorkspacePublicOverviewResponseDto> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const cityActivityLimit = Math.min(Math.max(query.cityActivityLimit ?? 20, 1), 5000);
    const cityAggregationLimit = Math.min(cityActivityLimit * 5, 25000);
    const activityRange: PlatformActivityRange = query.activityRange ?? '30d';
    const { start: cityStart, end: cityEnd } = this.resolveRangeWindow(activityRange);

    const filters = {
      cityId: query.cityId,
      categoryKey: query.categoryKey,
      subcategoryKey: query.subcategoryKey,
      sort: query.sort,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      page,
      limit,
    };

    const [requestDocs, total, totalPublishedRequests, totalActiveProviders, activity, cityRows] = await Promise.all([
      this.requests.listPublic(filters),
      this.requests.countPublic(filters),
      this.requestModel.countDocuments({ status: 'published', archivedAt: null }).exec(),
      this.providerModel.countDocuments({ status: 'active', isBlocked: false }).exec(),
      this.analytics.getPlatformActivity(activityRange),
      this.requestModel
        .aggregate<{ _id: { cityName?: string | null; cityId?: string | null }; count: number }>([
          {
            $match: {
              status: 'published',
              archivedAt: null,
              createdAt: { $gte: cityStart, $lte: cityEnd },
            },
          },
          {
            $group: {
              _id: { cityId: '$cityId', cityName: '$cityName' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: cityAggregationLimit },
        ])
        .exec(),
    ]);

    const requestItems = await this.enricher.enrichPublicRequests(requestDocs);

    const cityAcc = new Map<
      string,
      {
        citySlug: string;
        cityName: string;
        cityId: string | null;
        requestCount: number;
      }
    >();

    cityRows.forEach((row) => {
      const cityName = String(row?._id?.cityName ?? '').trim();
      if (!cityName) return;

      const citySlug = this.slugifyCityName(cityName);
      if (!citySlug) return;

      const requestCount = Math.max(0, Math.round(Number(row.count) || 0));
      if (requestCount <= 0) return;

      const cityId = this.normalizeId(row?._id?.cityId);
      let current = cityAcc.get(citySlug);
      if (!current) {
        current = {
          citySlug,
          cityName,
          cityId: cityId ?? null,
          requestCount: 0,
        };
        cityAcc.set(citySlug, current);
      } else if (cityId && current.cityId && current.cityId !== cityId) {
        current.cityId = null;
      } else if (!current.cityId && cityId) {
        current.cityId = cityId;
      }

      current.requestCount += requestCount;
    });

    const cityGeoBySlug = await this.cities.resolveActivityCoords(
      Array.from(cityAcc.values()).map((item) => ({
        cityId: item.cityId,
        citySlug: item.citySlug,
        cityName: item.cityName,
        countryCode: 'DE',
      })),
    );

    const cityItems: WorkspacePublicCityActivityItemDto[] = Array.from(cityAcc.values())
      .map((item) => {
        const resolvedCoords = cityGeoBySlug.get(item.citySlug) ?? null;
        return {
          citySlug: item.citySlug,
          cityName: item.cityName,
          cityId: resolvedCoords?.cityId ?? item.cityId,
          requestCount: item.requestCount,
          lat: resolvedCoords?.lat ?? null,
          lng: resolvedCoords?.lng ?? null,
        };
      })
      .sort((a, b) => (b.requestCount - a.requestCount) || a.cityName.localeCompare(b.cityName))
      .slice(0, cityActivityLimit);

    const totalActiveRequests = cityItems.reduce((sum, item) => sum + item.requestCount, 0);

    return {
      updatedAt: new Date().toISOString(),
      summary: {
        totalPublishedRequests,
        totalActiveProviders,
      },
      activity,
      cityActivity: {
        totalActiveCities: cityItems.length,
        totalActiveRequests,
        items: cityItems,
      },
      requests: {
        items: requestItems,
        total,
        page,
        limit,
      },
    };
  }

  async getPublicRequestsBatch(ids: string[]): Promise<WorkspacePublicRequestsBatchResponseDto> {
    const inputIds = Array.isArray(ids)
      ? Array.from(
          new Set(
            ids
              .map((x) => String(x ?? '').trim())
              .filter((x) => x.length > 0),
          ),
        )
      : [];

    if (inputIds.length === 0) {
      return { items: [], missingIds: [] };
    }

    const docs = await this.requests.listPublicByIds(inputIds);
    const enriched = await this.enricher.enrichPublicRequests(docs);

    const itemById = new Map(enriched.map((item) => [item.id, item]));
    const orderedItems = inputIds
      .map((id) => itemById.get(id) ?? null)
      .filter((item): item is RequestPublicDto => item !== null);

    const missingIds = inputIds.filter((id) => !itemById.has(id));

    return {
      items: orderedItems,
      missingIds,
    };
  }
}
