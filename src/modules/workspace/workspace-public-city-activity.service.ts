import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { CitiesService } from '../catalog/cities/cities.service';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import type { PlatformActivityRange } from '../analytics/analytics.service';
import type { WorkspacePublicCityActivityItemDto } from './dto/workspace-public-response.dto';

@Injectable()
export class WorkspacePublicCityActivityService {
  constructor(
    private readonly cities: CitiesService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
  ) {}

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

  async getCityActivity(args: {
    activityRange: PlatformActivityRange;
    cityActivityLimit: number;
  }): Promise<{
    totalActiveCities: number;
    totalActiveRequests: number;
    items: WorkspacePublicCityActivityItemDto[];
  }> {
    const cityActivityLimit = Math.min(Math.max(args.cityActivityLimit, 1), 5000);
    const cityAggregationLimit = Math.min(cityActivityLimit * 5, 25000);
    const { start: cityStart, end: cityEnd } = this.resolveRangeWindow(args.activityRange);

    const cityRows = await this.requestModel
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
      .exec();

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
        current = { citySlug, cityName, cityId: cityId ?? null, requestCount: 0 };
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

    const items: WorkspacePublicCityActivityItemDto[] = Array.from(cityAcc.values())
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

    return {
      totalActiveCities: items.length,
      totalActiveRequests: items.reduce((sum, item) => sum + item.requestCount, 0),
      items,
    };
  }
}
