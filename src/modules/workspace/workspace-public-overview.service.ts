import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AnalyticsService, type PlatformActivityRange } from '../analytics/analytics.service';
import { RequestsService } from '../requests/requests.service';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { ProviderProfile, type ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import type { WorkspacePublicQueryDto } from './dto/workspace-public-query.dto';
import type { WorkspacePublicOverviewResponseDto } from './dto/workspace-public-response.dto';
import type { RequestPublicDto } from '../requests/dto/request-public.dto';
import type { WorkspacePublicRequestsBatchResponseDto } from './dto/workspace-public-requests-batch.dto';
import { WorkspacePublicRequestEnricherService } from './workspace-public-request-enricher.service';
import { WorkspacePublicCityActivityService } from './workspace-public-city-activity.service';

@Injectable()
export class WorkspacePublicOverviewService {
  constructor(
    private readonly requests: RequestsService,
    private readonly analytics: AnalyticsService,
    private readonly enricher: WorkspacePublicRequestEnricherService,
    private readonly cityActivity: WorkspacePublicCityActivityService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(ProviderProfile.name) private readonly providerModel: Model<ProviderProfileDocument>,
  ) {}

  async getPublicOverview(query: WorkspacePublicQueryDto): Promise<WorkspacePublicOverviewResponseDto> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const cityActivityLimit = Math.min(Math.max(query.cityActivityLimit ?? 20, 1), 5000);
    const activityRange: PlatformActivityRange = query.activityRange ?? '30d';

    const filters = {
      cityId: query.cityId,
      categoryKey: query.categoryKey,
      subcategoryKey: query.subcategoryKey,
      sort: query.sort,
      state: query.state,
      period: query.period,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      page,
      limit,
    };

    const [requestDocs, total, totalPublishedRequests, totalActiveProviders, activity, cityActivity] = await Promise.all([
      this.requests.listPublic(filters),
      this.requests.countPublic(filters),
      this.requestModel.countDocuments({ status: 'published', archivedAt: null }).exec(),
      this.providerModel.countDocuments({ status: 'active', isBlocked: false }).exec(),
      this.analytics.getPlatformActivity(activityRange),
      this.cityActivity.getCityActivity({ activityRange, cityActivityLimit }),
    ]);

    const requestItems = await this.enricher.enrichPublicRequests(requestDocs);

    return {
      updatedAt: new Date().toISOString(),
      summary: {
        totalPublishedRequests,
        totalActiveProviders,
      },
      activity,
      cityActivity,
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
