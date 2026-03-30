import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import type { Model } from 'mongoose';
import { Request, RequestDocument } from '../requests/schemas/request.schema';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';
import { RedisService } from '../../infra/redis.service';
import {
  CreateSearchEventDto,
  SearchEventResponseDto,
  type SearchEventSource,
  type SearchEventTarget,
} from './dto/create-search-event.dto';
import {
  SearchAnalyticsAggregate,
  SearchAnalyticsAggregateDocument,
} from './schemas/search-analytics-aggregate.schema';

export type PlatformActivityRange = '24h' | '7d' | '30d' | '90d';
export type PlatformActivityInterval = 'hour' | 'day';

type PlatformActivityPoint = {
  timestamp: string;
  requests: number;
  offers: number;
};

export type PlatformActivityResponse = {
  range: PlatformActivityRange;
  interval: PlatformActivityInterval;
  source: 'real';
  data: PlatformActivityPoint[];
  updatedAt: string;
};

export type PlatformScopeFilters = {
  cityId?: string | null;
  categoryKey?: string | null;
  subcategoryKey?: string | null;
};

export type PlatformLiveFeedItem = {
  id: string;
  text: string;
  minutesAgo: number;
};

export type PlatformLiveFeedResponse = {
  source: 'real';
  updatedAt: string;
  data: PlatformLiveFeedItem[];
};

export type CitySearchCountsRow = {
  cityId: string | null;
  cityName: string;
  citySlug: string;
  requestSearchCount: number;
  providerSearchCount: number;
};

type SearchEventContext = {
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

type NormalizedSearchEvent = {
  target: SearchEventTarget;
  source: SearchEventSource | 'other';
  cityId: string | null;
  cityName: string | null;
  citySlug: string | null;
  categoryKey: string | null;
  subcategoryKey: string | null;
  query: string | null;
  sessionId: string | null;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(SearchAnalyticsAggregate.name)
    private readonly searchAggregateModel: Model<SearchAnalyticsAggregateDocument>,
  ) {}

  private getRangeConfig(range: PlatformActivityRange) {
    if (range === '24h') {
      return { points: 24, stepMs: 60 * 60 * 1000, interval: 'hour' as const };
    }
    if (range === '90d') {
      return { points: 90, stepMs: 24 * 60 * 60 * 1000, interval: 'day' as const };
    }
    if (range === '30d') {
      return { points: 30, stepMs: 24 * 60 * 60 * 1000, interval: 'day' as const };
    }
    return { points: 7, stepMs: 24 * 60 * 60 * 1000, interval: 'day' as const };
  }

  private normalizeScopeFilter(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeText(value: unknown, options?: { lowercase?: boolean; max?: number }): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const limited = typeof options?.max === 'number' ? trimmed.slice(0, options.max) : trimmed;
    return options?.lowercase ? limited.toLowerCase() : limited;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private getHashSalt(): string {
    const fromEnv = String(this.config.get('app.analyticsHashSalt') ?? '').trim();
    if (fromEnv) return fromEnv;
    const fromJwt = String(this.config.get('app.jwtSecret') ?? '').trim();
    return fromJwt || 'decizhen-analytics';
  }

  private hashValue(raw: string): string {
    return createHash('sha256').update(`${this.getHashSalt()}:${raw}`).digest('hex');
  }

  private getBucketSeconds(): number {
    const value = Number(this.config.get('app.searchAnalyticsBucketSeconds') ?? 900);
    if (!Number.isFinite(value) || value < 60) return 900;
    return Math.floor(value);
  }

  private getDedupeTtlSeconds(bucketSeconds: number): number {
    const configured = Number(this.config.get('app.searchAnalyticsDedupeTtlSeconds') ?? bucketSeconds + 120);
    if (!Number.isFinite(configured) || configured < 60) return bucketSeconds + 120;
    return Math.floor(configured);
  }

  private normalizeEvent(dto: CreateSearchEventDto): NormalizedSearchEvent {
    const target = dto.target;
    const source = (this.normalizeText(dto.source, { lowercase: true, max: 64 }) ?? 'other') as
      | SearchEventSource
      | 'other';

    const cityId = this.normalizeText(dto.cityId, { lowercase: true, max: 80 });
    const cityName = this.normalizeText(dto.cityName, { lowercase: false, max: 120 });
    const categoryKey = this.normalizeText(dto.categoryKey, { lowercase: true, max: 80 });
    const subcategoryKey = this.normalizeText(dto.subcategoryKey, { lowercase: true, max: 80 });
    const query = this.normalizeText(dto.query, { lowercase: true, max: 160 });
    const sessionId = this.normalizeText(dto.sessionId, { lowercase: false, max: 120 });

    if (!cityId && !cityName && !categoryKey && !subcategoryKey && !query) {
      throw new BadRequestException('At least one search criterion is required');
    }

    const citySlug = cityName ? this.slugify(cityName) : cityId;

    return {
      target,
      source,
      cityId,
      cityName,
      citySlug,
      categoryKey,
      subcategoryKey,
      query,
      sessionId,
    };
  }

  private resolveActorHash(event: NormalizedSearchEvent, context: SearchEventContext): string {
    const userId = this.normalizeText(context.userId, { lowercase: false, max: 120 });
    if (userId) {
      return this.hashValue(`user:${userId}`);
    }

    if (event.sessionId) {
      return this.hashValue(`session:${event.sessionId}`);
    }

    const ip = this.normalizeText(context.ip, { lowercase: false, max: 128 }) ?? 'unknown-ip';
    const ua = this.normalizeText(context.userAgent, { lowercase: false, max: 240 }) ?? 'unknown-ua';
    return this.hashValue(`ipua:${ip}|${ua}`);
  }

  private resolveQueryHash(event: NormalizedSearchEvent): string {
    const hashInput = JSON.stringify({
      target: event.target,
      cityId: event.cityId,
      citySlug: event.citySlug,
      categoryKey: event.categoryKey,
      subcategoryKey: event.subcategoryKey,
      query: event.query,
    });
    return this.hashValue(hashInput);
  }

  async trackSearchEvent(
    dto: CreateSearchEventDto,
    context: SearchEventContext = {},
  ): Promise<SearchEventResponseDto> {
    const now = new Date();
    const event = this.normalizeEvent(dto);

    const bucketSeconds = this.getBucketSeconds();
    const bucketMs = bucketSeconds * 1000;
    const bucketStartMs = Math.floor(now.getTime() / bucketMs) * bucketMs;
    const bucketStart = new Date(bucketStartMs);

    const actorHash = this.resolveActorHash(event, context);
    const queryHash = this.resolveQueryHash(event);
    const dedupeKey = `analytics:search:dedupe:${bucketStart.toISOString()}:${actorHash}:${queryHash}`;
    const dedupeTtlSeconds = this.getDedupeTtlSeconds(bucketSeconds);

    const isNewEvent = await this.redis.setIfAbsent(dedupeKey, '1', dedupeTtlSeconds);
    if (!isNewEvent) {
      return {
        accepted: true,
        deduped: true,
        bucketStart: bucketStart.toISOString(),
        recordedAt: now.toISOString(),
      };
    }

    const filter = {
      bucketStart,
      target: event.target,
      cityId: event.cityId,
      citySlug: event.citySlug,
      categoryKey: event.categoryKey,
      subcategoryKey: event.subcategoryKey,
    };

    const update = {
      $inc: { count: 1 },
      $setOnInsert: {
        bucketStart,
        target: event.target,
        cityId: event.cityId,
        citySlug: event.citySlug,
        categoryKey: event.categoryKey,
        subcategoryKey: event.subcategoryKey,
      },
      $set: {
        cityName: event.cityName,
        source: event.source,
        lastEventAt: now,
      },
    };

    try {
      await this.searchAggregateModel.updateOne(filter, update, { upsert: true }).exec();
    } catch (error: unknown) {
      const duplicateKey =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        Number((error as { code?: unknown }).code) === 11000;

      if (duplicateKey) {
        await this.searchAggregateModel.updateOne(filter, { $inc: { count: 1 }, $set: { lastEventAt: now } }).exec();
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to persist search aggregate: ${message}`);
      }
    }

    return {
      accepted: true,
      deduped: false,
      bucketStart: bucketStart.toISOString(),
      recordedAt: now.toISOString(),
    };
  }

  async getCitySearchCounts(
    range: PlatformActivityRange,
    filters?: PlatformScopeFilters,
  ): Promise<CitySearchCountsRow[]> {
    const now = Date.now();
    const cfg = this.getRangeConfig(range);
    const startMs = now - (cfg.points - 1) * cfg.stepMs;
    const start = new Date(startMs);
    const end = new Date(now);
    const cityId = this.normalizeScopeFilter(filters?.cityId);
    const categoryKey = this.normalizeScopeFilter(filters?.categoryKey);

    const match: Record<string, unknown> = {
      bucketStart: { $gte: start, $lte: end },
      $or: [{ cityId: { $nin: [null, ''] } }, { citySlug: { $nin: [null, ''] } }],
    };
    if (cityId) match.cityId = cityId;
    if (categoryKey) match.categoryKey = categoryKey;

    const rows = await this.searchAggregateModel
      .aggregate<{
        _id: { cityId?: string | null; cityName?: string | null; citySlug?: string | null };
        requestSearchCount: number;
        providerSearchCount: number;
      }>([
        {
          $match: {
            ...match,
          },
        },
        {
          $group: {
            _id: {
              cityId: '$cityId',
              cityName: '$cityName',
              citySlug: '$citySlug',
            },
            requestSearchCount: {
              $sum: {
                $cond: [{ $eq: ['$target', 'request'] }, '$count', 0],
              },
            },
            providerSearchCount: {
              $sum: {
                $cond: [{ $eq: ['$target', 'provider'] }, '$count', 0],
              },
            },
          },
        },
        {
          $sort: {
            requestSearchCount: -1,
            providerSearchCount: -1,
          },
        },
        { $limit: 50 },
      ])
      .exec();

    return rows
      .map((row) => {
        const citySlug = String(row._id?.citySlug ?? '').trim();
        const cityId = String(row._id?.cityId ?? '').trim();
        const cityName = String(row._id?.cityName ?? '').trim();
        return {
          citySlug: citySlug || cityId,
          cityId: cityId || null,
          cityName: cityName || citySlug || cityId,
          requestSearchCount: Math.max(0, Math.round(row.requestSearchCount ?? 0)),
          providerSearchCount: Math.max(0, Math.round(row.providerSearchCount ?? 0)),
        };
      })
      .filter((row) => row.citySlug.length > 0);
  }

  async getPlatformActivity(
    range: PlatformActivityRange,
    filters?: PlatformScopeFilters,
  ): Promise<PlatformActivityResponse> {
    const now = Date.now();
    const cfg = this.getRangeConfig(range);
    const startMs = now - (cfg.points - 1) * cfg.stepMs;
    const end = new Date(now);
    const start = new Date(startMs);
    const cityId = this.normalizeScopeFilter(filters?.cityId);
    const categoryKey = this.normalizeScopeFilter(filters?.categoryKey);
    const subcategoryKey = this.normalizeScopeFilter(filters?.subcategoryKey);
    const requestMatch: Record<string, unknown> = {
      status: 'published',
      createdAt: { $gte: start, $lte: end },
    };
    if (cityId) requestMatch.cityId = cityId;
    if (categoryKey) requestMatch.categoryKey = categoryKey;
    if (subcategoryKey) requestMatch.serviceKey = subcategoryKey;
    const requestRefMatch: Record<string, unknown> = {};
    if (cityId) requestRefMatch['requestRef.cityId'] = cityId;
    if (categoryKey) requestRefMatch['requestRef.categoryKey'] = categoryKey;
    if (subcategoryKey) requestRefMatch['requestRef.serviceKey'] = subcategoryKey;

    const requestQuery = this.requestModel.find(requestMatch).select({ createdAt: 1 }).lean().exec();
    const offerPipeline: any[] = [
      { $match: { createdAt: { $gte: start, $lte: end } } },
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
                categoryKey: '$categoryKey',
                serviceKey: '$serviceKey',
              },
            },
          ],
          as: 'requestRef',
        },
      },
      { $unwind: '$requestRef' },
    ];
    if (Object.keys(requestRefMatch).length > 0) {
      offerPipeline.push({ $match: requestRefMatch });
    }
    offerPipeline.push({ $project: { _id: 0, createdAt: 1 } });

    const [requestsRaw, offersRaw] = await Promise.all([
      requestQuery,
      this.offerModel.aggregate<{ createdAt?: Date | string }>(offerPipeline).exec(),
    ]);

    const requestCounts = new Array<number>(cfg.points).fill(0);
    const offerCounts = new Array<number>(cfg.points).fill(0);

    for (const row of requestsRaw as Array<{ createdAt?: Date | string }>) {
      const ts = row?.createdAt ? new Date(row.createdAt).getTime() : Number.NaN;
      if (!Number.isFinite(ts)) continue;
      const index = Math.floor((ts - startMs) / cfg.stepMs);
      if (index < 0 || index >= cfg.points) continue;
      requestCounts[index] += 1;
    }

    for (const row of offersRaw as Array<{ createdAt?: Date | string }>) {
      const ts = row?.createdAt ? new Date(row.createdAt).getTime() : Number.NaN;
      if (!Number.isFinite(ts)) continue;
      const index = Math.floor((ts - startMs) / cfg.stepMs);
      if (index < 0 || index >= cfg.points) continue;
      offerCounts[index] += 1;
    }

    const data: PlatformActivityPoint[] = Array.from({ length: cfg.points }, (_, i) => ({
      timestamp: new Date(startMs + i * cfg.stepMs).toISOString(),
      requests: requestCounts[i] ?? 0,
      offers: offerCounts[i] ?? 0,
    }));

    return {
      range,
      interval: cfg.interval,
      source: 'real',
      updatedAt: new Date().toISOString(),
      data,
    };
  }

  async getPlatformLiveFeed(limit = 4): Promise<PlatformLiveFeedResponse> {
    const safeLimit = Math.max(1, Math.min(20, Math.floor(Number(limit) || 4)));

    const [requests, offers] = await Promise.all([
      this.requestModel
        .find({})
        .sort({ createdAt: -1 })
        .limit(Math.max(safeLimit, 10))
        .select({ _id: 1, title: 1, cityName: 1, serviceKey: 1, createdAt: 1 })
        .lean()
        .exec(),
      this.offerModel
        .find({})
        .sort({ createdAt: -1 })
        .limit(Math.max(safeLimit, 10))
        .select({ _id: 1, createdAt: 1 })
        .lean()
        .exec(),
    ]);

    const now = Date.now();

    const requestEvents = (
      requests as Array<{ _id: unknown; title?: string; cityName?: string; serviceKey?: string; createdAt?: Date | string }>
    ).map((row) => {
      const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
      const city = String(row.cityName ?? '').trim();
      const title = String(row.title ?? '').trim();
      const serviceKey = String(row.serviceKey ?? '').trim();
      const message = title
        ? `Neue Anfrage: ${title}`
        : city
          ? `Neue Anfrage in ${city}`
          : serviceKey
            ? `Neue Anfrage (${serviceKey})`
            : 'Neue Anfrage erstellt';
      return {
        id: `req-${String(row._id)}`,
        text: message,
        createdAt,
      };
    });

    const offerEvents = (offers as Array<{ _id: unknown; createdAt?: Date | string }>).map((row) => ({
      id: `off-${String(row._id)}`,
      text: 'Neues Angebot gesendet',
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    }));

    const data = [...requestEvents, ...offerEvents]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, safeLimit)
      .map((item) => ({
        id: item.id,
        text: item.text,
        minutesAgo: Math.max(1, Math.round((now - item.createdAt.getTime()) / 60000)),
      }));

    return {
      source: 'real',
      updatedAt: new Date().toISOString(),
      data,
    };
  }
}
