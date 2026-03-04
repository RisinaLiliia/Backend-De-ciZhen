import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AnalyticsService, type PlatformActivityRange } from '../analytics/analytics.service';
import { RequestsService } from '../requests/requests.service';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { PresenceService } from '../presence/presence.service';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { ProviderProfile, type ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import { Favorite, type FavoriteDocument } from '../favorites/schemas/favorite.schema';
import { Review, type ReviewDocument } from '../reviews/schemas/review.schema';
import { ClientProfile, type ClientProfileDocument } from '../users/schemas/client-profile.schema';
import type { AppRole } from '../users/schemas/user.schema';
import type {
  WorkspacePublicQueryDto,
} from './dto/workspace-public-query.dto';
import type {
  WorkspacePublicOverviewResponseDto,
  WorkspacePublicCityActivityItemDto,
} from './dto/workspace-public-response.dto';
import type { RequestPublicDto } from '../requests/dto/request-public.dto';
import type { WorkspacePublicRequestsBatchResponseDto } from './dto/workspace-public-requests-batch.dto';
import type { WorkspacePrivateOverviewResponseDto } from './dto/workspace-private-response.dto';

const REQUEST_STATUSES = ['draft', 'published', 'paused', 'matched', 'closed', 'cancelled'] as const;
const OFFER_STATUSES = ['sent', 'accepted', 'declined', 'withdrawn'] as const;
const CONTRACT_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;

const CITY_COORDINATE_FALLBACK: Record<string, { lat: number; lng: number }> = {
  hamburg: { lat: 53.5511, lng: 9.9937 },
  berlin: { lat: 52.52, lng: 13.405 },
  bremen: { lat: 53.0793, lng: 8.8017 },
  hannover: { lat: 52.3759, lng: 9.732 },
  dortmund: { lat: 51.5136, lng: 7.4653 },
  duisburg: { lat: 51.4344, lng: 6.7623 },
  essen: { lat: 51.4556, lng: 7.0116 },
  dusseldorf: { lat: 51.2277, lng: 6.7735 },
  koln: { lat: 50.9375, lng: 6.9603 },
  bonn: { lat: 50.7374, lng: 7.0982 },
  mannheim: { lat: 49.4875, lng: 8.466 },
  heidelberg: { lat: 49.3988, lng: 8.6724 },
  karlsruhe: { lat: 49.0069, lng: 8.4037 },
  ludwigshafen: { lat: 49.4774, lng: 8.4452 },
  darmstadt: { lat: 49.8728, lng: 8.6512 },
  frankfurt: { lat: 50.1109, lng: 8.6821 },
  wiesbaden: { lat: 50.0782, lng: 8.2398 },
  mainz: { lat: 49.9929, lng: 8.2473 },
  stuttgart: { lat: 48.7758, lng: 9.1829 },
  nurnberg: { lat: 49.4521, lng: 11.0767 },
  leipzig: { lat: 51.3397, lng: 12.3731 },
  dresden: { lat: 51.0504, lng: 13.7373 },
  augsburg: { lat: 48.3705, lng: 10.8978 },
  munchen: { lat: 48.1351, lng: 11.582 },
};

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly requests: RequestsService,
    private readonly analytics: AnalyticsService,
    private readonly users: UsersService,
    private readonly clientProfiles: ClientProfilesService,
    private readonly presence: PresenceService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(ProviderProfile.name) private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(ClientProfile.name) private readonly clientProfileModel: Model<ClientProfileDocument>,
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

  private roundCoord(n: number, decimals = 2): number {
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
  }

  private toPublicRequestDto(
    doc: any,
    client?: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
      city: string | null;
      ratingAvg: number | null;
      ratingCount: number | null;
      isOnline?: boolean | null;
      lastSeenAt?: Date | null;
    },
  ): RequestPublicDto {
    const loc = doc.location?.coordinates;
    const location =
      Array.isArray(loc) && loc.length === 2
        ? ({
            type: 'Point' as const,
            coordinates: [this.roundCoord(loc[0]), this.roundCoord(loc[1])] as [number, number],
          } as const)
        : null;

    return {
      id: doc._id?.toString?.() ?? String(doc.id),
      title: doc.title,
      serviceKey: doc.serviceKey,
      cityId: doc.cityId,
      cityName: doc.cityName,
      location,
      clientId: client?.id ?? this.normalizeId(doc.clientId),
      clientName: client?.name ?? null,
      clientAvatarUrl: client?.avatarUrl ?? null,
      clientCity: client?.city ?? null,
      clientRatingAvg: client?.ratingAvg ?? null,
      clientRatingCount: client?.ratingCount ?? null,
      clientIsOnline: client?.isOnline ?? null,
      clientLastSeenAt: client?.lastSeenAt ?? null,
      categoryKey: doc.categoryKey ?? null,
      categoryName: doc.categoryName ?? null,
      subcategoryName: doc.subcategoryName ?? null,
      propertyType: doc.propertyType,
      area: doc.area,
      price: doc.price ?? null,
      previousPrice: doc.previousPrice ?? null,
      priceTrend: doc.priceTrend ?? null,
      preferredDate: doc.preferredDate,
      isRecurring: doc.isRecurring,
      comment: doc.comment ?? null,
      description: doc.description ?? null,
      photos: doc.photos ?? [],
      imageUrl: doc.imageUrl ?? null,
      tags: doc.tags ?? [],
      status: doc.status,
      createdAt: doc.createdAt,
    };
  }

  private async enrichPublicRequests(items: RequestDocument[]): Promise<RequestPublicDto[]> {
    if (items.length === 0) return [];

    const clientIds = Array.from(
      new Set(
        items
          .map((x) => this.normalizeId((x as any).clientId))
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    );

    const [users, clientProfiles] =
      clientIds.length > 0
        ? await Promise.all([
            this.users.findPublicByIds(clientIds),
            this.clientProfiles.getByUserIds(clientIds),
          ])
        : [[], []];

    const userById = new Map(
      users.map((u) => [
        u._id.toString(),
        {
          id: u._id.toString(),
          name: u.name ?? null,
          avatarUrl: u.avatar?.url ?? null,
          city: u.city ?? null,
          lastSeenAt: u.lastSeenAt ?? null,
        },
      ]),
    );
    const profileById = new Map(clientProfiles.map((p) => [p.userId, p]));
    const onlineById = await this.presence.getOnlineMap(clientIds);

    return items.map((item) => {
      const clientId = this.normalizeId((item as any).clientId);
      if (!clientId) return this.toPublicRequestDto(item);
      const user = userById.get(clientId);
      if (!user) return this.toPublicRequestDto(item);
      const profile = profileById.get(clientId);
      return this.toPublicRequestDto(item, {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        city: user.city,
        ratingAvg: profile?.ratingAvg ?? null,
        ratingCount: profile?.ratingCount ?? null,
        isOnline: onlineById.get(clientId) ?? false,
        lastSeenAt: user.lastSeenAt,
      });
    });
  }

  private slugifyCityName(cityName: string): string {
    return cityName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private toValidLatLng(
    latRaw: unknown,
    lngRaw: unknown,
  ): { lat: number; lng: number } | null {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90) return null;
    if (lng < -180 || lng > 180) return null;
    // Treat 0,0 as an unset placeholder and force city fallback coordinates.
    if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return null;
    return {
      lat: this.roundCoord(lat, 6),
      lng: this.roundCoord(lng, 6),
    };
  }

  private toStatusCounts<T extends string>(
    rows: Array<{ _id: string; count: number }>,
    statuses: readonly T[],
  ): Record<T | 'total', number> {
    const initial = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<T, number>;
    let total = 0;

    for (const row of rows) {
      const key = row?._id;
      const count = Number(row?.count ?? 0);
      if (!key || !Number.isFinite(count)) continue;
      if ((statuses as readonly string[]).includes(key)) {
        initial[key as T] = Math.max(0, Math.round(count));
        total += Math.max(0, Math.round(count));
      }
    }

    return {
      ...initial,
      total,
    };
  }

  private monthBoundsUTC(offsetFromCurrent: number): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetFromCurrent, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetFromCurrent + 1, 1, 0, 0, 0, 0));
    return { start, end };
  }

  private buildDelta(current: number, previous: number): { kind: 'percent' | 'new' | 'none'; percent: number | null } {
    if (previous <= 0) {
      if (current <= 0) return { kind: 'none', percent: null };
      return { kind: 'new', percent: null };
    }
    const raw = ((current - previous) / previous) * 100;
    const rounded = Math.round(raw);
    const safe = Object.is(rounded, -0) ? 0 : rounded;
    return { kind: 'percent', percent: safe };
  }

  private computeProviderCompleteness(profile: any | null): number {
    if (!profile) return 0;
    let score = 0;
    if (profile.displayName?.trim()) score += 15;
    if (profile.bio?.trim()) score += 15;
    if (profile.cityId?.trim()) score += 15;
    if ((profile.serviceKeys?.length ?? 0) > 0) score += 25;
    if (typeof profile.basePrice === 'number' && profile.basePrice > 0) score += 10;
    if (profile.companyName?.trim() || profile.vatId?.trim()) score += 10;
    if (profile.status === 'active' && !profile.isBlocked) score += 10;
    return Math.max(0, Math.min(100, score));
  }

  private computeClientCompleteness(user: any | null, hasClientProfile: boolean): number {
    if (!user) return 0;
    let score = 0;
    if (user.name?.trim()) score += 20;
    if (user.email?.trim()) score += 20;
    if (user.city?.trim()) score += 20;
    if (user.phone?.trim()) score += 15;
    if (user.avatar?.url?.trim()) score += 15;
    if (user.acceptedPrivacyPolicy) score += 5;
    if (hasClientProfile) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  async getPublicOverview(query: WorkspacePublicQueryDto): Promise<WorkspacePublicOverviewResponseDto> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const cityActivityLimit = Math.min(Math.max(query.cityActivityLimit ?? 20, 1), 100);
    const cityAggregationLimit = Math.min(cityActivityLimit * 5, 500);
    const activityRange: PlatformActivityRange = query.activityRange ?? '30d';

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
      this.requestModel.countDocuments({ status: 'published' }).exec(),
      this.providerModel.countDocuments({ status: 'active', isBlocked: false }).exec(),
      this.analytics.getPlatformActivity(activityRange),
      this.requestModel
        .aggregate<{ _id: { cityName?: string | null; cityId?: string | null }; count: number; lat?: number | null; lng?: number | null }>([
          { $match: { status: 'published' } },
          {
            $group: {
              _id: { cityId: '$cityId', cityName: '$cityName' },
              count: { $sum: 1 },
              lng: { $avg: { $arrayElemAt: ['$location.coordinates', 0] } },
              lat: { $avg: { $arrayElemAt: ['$location.coordinates', 1] } },
            },
          },
          { $sort: { count: -1 } },
          { $limit: cityAggregationLimit },
        ])
        .exec(),
    ]);

    const requestItems = await this.enrichPublicRequests(requestDocs);

    const cityAcc = new Map<
      string,
      {
        citySlug: string;
        cityName: string;
        cityId: string | null;
        requestCount: number;
        weightedLatSum: number;
        weightedLngSum: number;
        weightedPointCount: number;
        fallbackCoords: { lat: number; lng: number } | null;
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
      const aggregatedCoords = this.toValidLatLng(row?.lat, row?.lng);
      const fallbackCoords = CITY_COORDINATE_FALLBACK[citySlug] ?? null;

      let current = cityAcc.get(citySlug);
      if (!current) {
        current = {
          citySlug,
          cityName,
          cityId: cityId ?? null,
          requestCount: 0,
          weightedLatSum: 0,
          weightedLngSum: 0,
          weightedPointCount: 0,
          fallbackCoords,
        };
        cityAcc.set(citySlug, current);
      } else if (cityId && current.cityId && current.cityId !== cityId) {
        // Conflicting ids for the same normalized city name: expose as ambiguous.
        current.cityId = null;
      } else if (!current.cityId && cityId) {
        current.cityId = cityId;
      }

      current.requestCount += requestCount;

      if (aggregatedCoords) {
        current.weightedLatSum += aggregatedCoords.lat * requestCount;
        current.weightedLngSum += aggregatedCoords.lng * requestCount;
        current.weightedPointCount += requestCount;
      } else if (!current.fallbackCoords && fallbackCoords) {
        current.fallbackCoords = fallbackCoords;
      }
    });

    const cityItems: WorkspacePublicCityActivityItemDto[] = Array.from(cityAcc.values())
      .map((item) => {
        const averagedCoords =
          item.weightedPointCount > 0
            ? {
                lat: this.roundCoord(item.weightedLatSum / item.weightedPointCount, 6),
                lng: this.roundCoord(item.weightedLngSum / item.weightedPointCount, 6),
              }
            : null;

        const resolvedCoords = averagedCoords ?? item.fallbackCoords;
        return {
          citySlug: item.citySlug,
          cityName: item.cityName,
          cityId: item.cityId,
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
    const enriched = await this.enrichPublicRequests(docs);

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

  async getPrivateOverview(userId: string, role: AppRole): Promise<WorkspacePrivateOverviewResponseDto> {
    const uid = String(userId ?? '').trim();

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = this.monthBoundsUTC(0);
    const lastMonth = this.monthBoundsUTC(-1);

    const sixMonthStart = this.monthBoundsUTC(-5).start;

    const [
      requestStatusRows,
      providerOfferStatusRows,
      clientOfferStatusRows,
      providerContractStatusRows,
      clientContractStatusRows,
      favoriteRows,
      reviewRows,
      providerProfile,
      user,
      clientProfile,
      providerCompletedThisMonth,
      providerCompletedLastMonth,
      recentOffers7d,
      avgResponseRows,
      providerCompletedContracts,
      myRequests,
      clientCompletedContracts,
    ] = await Promise.all([
      this.requestModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { clientId: uid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.offerModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { providerUserId: uid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.offerModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { clientUserId: uid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.contractModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { providerUserId: uid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.contractModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { clientId: uid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.favoriteModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { userId: uid } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ])
        .exec(),
      this.reviewModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { targetUserId: uid } },
          { $group: { _id: '$targetRole', count: { $sum: 1 } } },
        ])
        .exec(),
      this.providerModel.findOne({ userId: uid }).lean().exec(),
      this.users.findById(uid),
      this.clientProfileModel.findOne({ userId: uid }).lean().exec(),
      this.contractModel
        .countDocuments({
          providerUserId: uid,
          status: 'completed',
          completedAt: { $gte: thisMonth.start, $lt: thisMonth.end },
        })
        .exec(),
      this.contractModel
        .countDocuments({
          providerUserId: uid,
          status: 'completed',
          completedAt: { $gte: lastMonth.start, $lt: lastMonth.end },
        })
        .exec(),
      this.offerModel.countDocuments({ providerUserId: uid, createdAt: { $gte: sevenDaysAgo } }).exec(),
      this.offerModel
        .aggregate<{ _id: null; avgMs: number }>([
          { $match: { providerUserId: uid } },
          { $project: { diffMs: { $subtract: ['$updatedAt', '$createdAt'] } } },
          { $match: { diffMs: { $gt: 0 } } },
          { $group: { _id: null, avgMs: { $avg: '$diffMs' } } },
        ])
        .exec(),
      this.contractModel
        .find({
          providerUserId: uid,
          status: 'completed',
          completedAt: { $gte: sixMonthStart },
        })
        .select({ completedAt: 1, priceAmount: 1 })
        .lean()
        .exec(),
      this.requestModel
        .find({
          clientId: uid,
          createdAt: { $gte: sixMonthStart },
        })
        .select({ createdAt: 1, status: 1 })
        .lean()
        .exec(),
      this.contractModel
        .find({
          clientId: uid,
          status: 'completed',
          completedAt: { $gte: sixMonthStart },
        })
        .select({ completedAt: 1 })
        .lean()
        .exec(),
    ]);

    const requestsByStatus = this.toStatusCounts(requestStatusRows, REQUEST_STATUSES);
    const providerOffersByStatus = this.toStatusCounts(providerOfferStatusRows, OFFER_STATUSES);
    const clientOffersByStatus = this.toStatusCounts(clientOfferStatusRows, OFFER_STATUSES);
    const providerContractsByStatus = this.toStatusCounts(providerContractStatusRows, CONTRACT_STATUSES);
    const clientContractsByStatus = this.toStatusCounts(clientContractStatusRows, CONTRACT_STATUSES);

    const favorites = {
      requests: favoriteRows.find((row) => row._id === 'request')?.count ?? 0,
      providers: favoriteRows.find((row) => row._id === 'provider')?.count ?? 0,
    };

    const reviews = {
      asProvider: reviewRows.find((row) => row._id === 'provider')?.count ?? 0,
      asClient: reviewRows.find((row) => row._id === 'client')?.count ?? 0,
    };

    const providerCompleteness = this.computeProviderCompleteness(providerProfile);
    const clientCompleteness = this.computeClientCompleteness(user, Boolean(clientProfile));

    const myOpenRequests =
      requestsByStatus.draft +
      requestsByStatus.published +
      requestsByStatus.paused +
      requestsByStatus.matched;

    const providerActiveContracts =
      providerContractsByStatus.pending +
      providerContractsByStatus.confirmed +
      providerContractsByStatus.in_progress;

    const clientActiveContracts =
      clientContractsByStatus.pending +
      clientContractsByStatus.confirmed +
      clientContractsByStatus.in_progress;

    const acceptedCount = providerOffersByStatus.accepted;
    const sentCount = providerOffersByStatus.sent;
    const declinedCount = providerOffersByStatus.declined;

    const acceptedDecidedDenominator = acceptedCount + declinedCount;
    const acceptanceRate = Math.round((acceptedCount / Math.max(acceptedDecidedDenominator, 1)) * 100);

    const activityBase = sentCount + acceptedCount;
    const activityProgress = activityBase > 0 ? Math.round((acceptedCount / activityBase) * 100) : 12;

    const avgMs = Number(avgResponseRows[0]?.avgMs ?? Number.NaN);
    const avgResponseMinutes = Number.isFinite(avgMs) ? Math.max(1, Math.round(avgMs / (1000 * 60))) : null;

    const delta = this.buildDelta(providerCompletedThisMonth, providerCompletedLastMonth);

    const providerCompletedSeriesSource = providerCompletedContracts as Array<{ completedAt?: Date | string | null; priceAmount?: number | null }>;
    const clientRequestsSeriesSource = myRequests as Array<{ createdAt?: Date | string | null }>;
    const clientCompletedSeriesSource = clientCompletedContracts as Array<{ completedAt?: Date | string | null }>;

    const providerMonthlySeries = Array.from({ length: 6 }, (_, index) => {
      const monthOffset = index - 5;
      const { start, end } = this.monthBoundsUTC(monthOffset);
      const bars = providerCompletedSeriesSource.filter((item) => {
        if (!item.completedAt) return false;
        const ts = new Date(item.completedAt).getTime();
        return ts >= start.getTime() && ts < end.getTime();
      }).length;

      const line = providerCompletedSeriesSource.reduce((sum, item) => {
        if (!item.completedAt || typeof item.priceAmount !== 'number') return sum;
        const ts = new Date(item.completedAt).getTime();
        if (ts < start.getTime() || ts >= end.getTime()) return sum;
        return sum + item.priceAmount;
      }, 0);

      return {
        monthStart: start.toISOString(),
        bars,
        line,
      };
    });

    const clientMonthlySeries = Array.from({ length: 6 }, (_, index) => {
      const monthOffset = index - 5;
      const { start, end } = this.monthBoundsUTC(monthOffset);
      const bars = clientRequestsSeriesSource.filter((item) => {
        if (!item.createdAt) return false;
        const ts = new Date(item.createdAt).getTime();
        return ts >= start.getTime() && ts < end.getTime();
      }).length;

      const line = clientCompletedSeriesSource.filter((item) => {
        if (!item.completedAt) return false;
        const ts = new Date(item.completedAt).getTime();
        return ts >= start.getTime() && ts < end.getTime();
      }).length;

      return {
        monthStart: start.toISOString(),
        bars,
        line,
      };
    });

    return {
      updatedAt: new Date().toISOString(),
      user: {
        userId: uid,
        role,
      },
      requestsByStatus,
      providerOffersByStatus,
      clientOffersByStatus,
      providerContractsByStatus,
      clientContractsByStatus,
      favorites,
      reviews,
      profiles: {
        providerCompleteness,
        clientCompleteness,
      },
      kpis: {
        myOpenRequests,
        providerActiveContracts,
        clientActiveContracts,
        acceptanceRate,
        activityProgress,
        avgResponseMinutes,
        recentOffers7d,
      },
      insights: {
        providerCompletedThisMonth,
        providerCompletedLastMonth,
        providerCompletedDeltaKind: delta.kind,
        providerCompletedDeltaPercent: delta.percent,
      },
      providerMonthlySeries,
      clientMonthlySeries,
    };
  }
}
