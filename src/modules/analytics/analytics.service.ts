import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Request, RequestDocument } from '../requests/schemas/request.schema';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';

export type PlatformActivityRange = '24h' | '7d' | '30d';
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

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
  ) {}

  private getRangeConfig(range: PlatformActivityRange) {
    if (range === '24h') {
      return { points: 24, stepMs: 60 * 60 * 1000, interval: 'hour' as const };
    }
    if (range === '30d') {
      return { points: 30, stepMs: 24 * 60 * 60 * 1000, interval: 'day' as const };
    }
    return { points: 7, stepMs: 24 * 60 * 60 * 1000, interval: 'day' as const };
  }

  async getPlatformActivity(range: PlatformActivityRange): Promise<PlatformActivityResponse> {
    const now = Date.now();
    const cfg = this.getRangeConfig(range);
    const startMs = now - (cfg.points - 1) * cfg.stepMs;
    const end = new Date(now);
    const start = new Date(startMs);

    const [requestsRaw, offersRaw] = await Promise.all([
      this.requestModel.find({ createdAt: { $gte: start, $lte: end } }).select({ createdAt: 1 }).lean().exec(),
      this.offerModel.find({ createdAt: { $gte: start, $lte: end } }).select({ createdAt: 1 }).lean().exec(),
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

    const requestEvents = (requests as Array<{ _id: unknown; title?: string; cityName?: string; serviceKey?: string; createdAt?: Date | string }>).map((row) => {
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
