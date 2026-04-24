import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AnalyticsService, type PlatformActivityRange } from '../analytics/analytics.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { RequestsService } from '../requests/requests.service';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { PresenceService } from '../presence/presence.service';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { Booking, type BookingDocument } from '../bookings/schemas/booking.schema';
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
import type {
  WorkspacePrivateOverviewResponseDto,
  WorkspacePrivatePreferredRole,
} from './dto/workspace-private-response.dto';
import type { WorkspaceRequestsQueryDto } from './dto/workspace-requests-query.dto';
import type { WorkspaceRequestsResponseDto } from './dto/workspace-requests-response.dto';
import { WorkspaceRequestsService } from './workspace-requests.service';

const REQUEST_STATUSES = ['draft', 'published', 'paused', 'matched', 'closed', 'cancelled'] as const;
const OFFER_STATUSES = ['sent', 'accepted', 'declined', 'withdrawn'] as const;
const CONTRACT_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;
const PRIVATE_OVERVIEW_PERIOD_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
} as const;
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly requests: RequestsService,
    private readonly analytics: AnalyticsService,
    private readonly cities: CitiesService,
    private readonly users: UsersService,
    private readonly clientProfiles: ClientProfilesService,
    private readonly presence: PresenceService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(ProviderProfile.name) private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(ClientProfile.name) private readonly clientProfileModel: Model<ClientProfileDocument>,
    private readonly workspaceRequests: WorkspaceRequestsService,
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
      publishedAt: doc.publishedAt ?? null,
      purgeAt: doc.purgeAt ?? null,
      isInactive: doc.status === 'cancelled',
      inactiveReason: doc.inactiveReason ?? null,
      inactiveMessage: doc.inactiveMessage ?? null,
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

  private resolvePrivateOverviewPeriodStart(period: keyof typeof PRIVATE_OVERVIEW_PERIOD_MS): Date {
    return new Date(Date.now() - PRIVATE_OVERVIEW_PERIOD_MS[period]);
  }

  private parseActivityAt(value: Date | string | null | undefined): number | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  private countItemsWithinPeriod<T extends { updatedAt?: Date | string | null; createdAt?: Date | string | null }>(
    items: T[],
    cutoffMs: number,
  ) {
    return items.reduce((count, item) => {
      const activityAt = this.parseActivityAt(item.updatedAt) ?? this.parseActivityAt(item.createdAt);
      return activityAt !== null && activityAt >= cutoffMs ? count + 1 : count;
    }, 0);
  }

  private resolvePrivateOverviewPreferredRole(params: {
    period: keyof typeof PRIVATE_OVERVIEW_PERIOD_MS;
    requests: Array<{ createdAt?: Date | string | null }>;
    providerOffers: Array<{ updatedAt?: Date | string | null; createdAt?: Date | string | null }>;
    clientOffers: Array<{ updatedAt?: Date | string | null; createdAt?: Date | string | null }>;
    providerContracts: Array<{ updatedAt?: Date | string | null; createdAt?: Date | string | null }>;
    clientContracts: Array<{ updatedAt?: Date | string | null; createdAt?: Date | string | null }>;
    userRole: AppRole;
  }): WorkspacePrivatePreferredRole {
    const cutoffMs = this.resolvePrivateOverviewPeriodStart(params.period).getTime();
    const customerLoad =
      this.countItemsWithinPeriod(params.requests, cutoffMs) +
      this.countItemsWithinPeriod(params.clientOffers, cutoffMs) +
      this.countItemsWithinPeriod(params.clientContracts, cutoffMs);
    const providerLoad =
      this.countItemsWithinPeriod(params.providerOffers, cutoffMs) +
      this.countItemsWithinPeriod(params.providerContracts, cutoffMs);

    if (customerLoad > providerLoad) return 'customer';
    if (providerLoad > customerLoad) return 'provider';

    return params.userRole === 'provider' ? 'provider' : 'customer';
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

    const requestItems = await this.enrichPublicRequests(requestDocs);

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
        // Conflicting ids for the same normalized city name: expose as ambiguous.
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

  async getPrivateOverview(
    userId: string,
    role: AppRole,
    period: keyof typeof PRIVATE_OVERVIEW_PERIOD_MS = '30d',
  ): Promise<WorkspacePrivateOverviewResponseDto> {
    const uid = String(userId ?? '').trim();

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = this.monthBoundsUTC(0);
    const lastMonth = this.monthBoundsUTC(-1);

    const sixMonthStart = this.monthBoundsUTC(-5).start;
    const roleWindowStart = this.resolvePrivateOverviewPeriodStart(period);

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
      providerOfferActivityRows,
      clientOfferActivityRows,
      providerContractActivityRows,
      clientContractActivityRows,
    ] = await Promise.all([
      this.requestModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { clientId: uid, archivedAt: null } },
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
      this.offerModel
        .find({
          providerUserId: uid,
          $or: [
            { updatedAt: { $gte: roleWindowStart } },
            { createdAt: { $gte: roleWindowStart } },
          ],
        })
        .select({ updatedAt: 1, createdAt: 1 })
        .lean()
        .exec(),
      this.offerModel
        .find({
          clientUserId: uid,
          $or: [
            { updatedAt: { $gte: roleWindowStart } },
            { createdAt: { $gte: roleWindowStart } },
          ],
        })
        .select({ updatedAt: 1, createdAt: 1 })
        .lean()
        .exec(),
      this.contractModel
        .find({
          providerUserId: uid,
          $or: [
            { updatedAt: { $gte: roleWindowStart } },
            { createdAt: { $gte: roleWindowStart } },
          ],
        })
        .select({ updatedAt: 1, createdAt: 1 })
        .lean()
        .exec(),
      this.contractModel
        .find({
          clientId: uid,
          $or: [
            { updatedAt: { $gte: roleWindowStart } },
            { createdAt: { $gte: roleWindowStart } },
          ],
        })
        .select({ updatedAt: 1, createdAt: 1 })
        .lean()
        .exec(),
    ]);

    const requestsByStatus = this.toStatusCounts(requestStatusRows, REQUEST_STATUSES);
    const providerOffersByStatus = this.toStatusCounts(providerOfferStatusRows, OFFER_STATUSES);
    const clientOffersByStatus = this.toStatusCounts(clientOfferStatusRows, OFFER_STATUSES);
    const providerContractsByStatus = this.toStatusCounts(providerContractStatusRows, CONTRACT_STATUSES);
    const clientContractsByStatus = this.toStatusCounts(clientContractStatusRows, CONTRACT_STATUSES);
    const preferredRole = this.resolvePrivateOverviewPreferredRole({
      period,
      requests: myRequests as Array<{ createdAt?: Date | string | null }>,
      providerOffers: providerOfferActivityRows as Array<{ updatedAt?: Date | string | null; createdAt?: Date | string | null }>,
      clientOffers: clientOfferActivityRows as Array<{ updatedAt?: Date | string | null; createdAt?: Date | string | null }>,
      providerContracts: providerContractActivityRows as Array<{ updatedAt?: Date | string | null; createdAt?: Date | string | null }>,
      clientContracts: clientContractActivityRows as Array<{ updatedAt?: Date | string | null; createdAt?: Date | string | null }>,
      userRole: role,
    });

    const favorites = {
      requests: favoriteRows.find((row) => row._id === 'request')?.count ?? 0,
      providers: favoriteRows.find((row) => row._id === 'provider')?.count ?? 0,
    };

    const reviews = {
      asProvider: reviewRows.find((row) => row._id === 'provider')?.count ?? 0,
      asClient: reviewRows.find((row) => row._id === 'client')?.count ?? 0,
    };
    const ratingSummary = {
      average: Number(providerProfile?.ratingAvg ?? 0),
      count: Number(providerProfile?.ratingCount ?? reviews.asProvider ?? 0),
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
      preferredRole,
      requestsByStatus,
      providerOffersByStatus,
      clientOffersByStatus,
      providerContractsByStatus,
      clientContractsByStatus,
      favorites,
      reviews,
      ratingSummary,
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

  async getRequestsOverview(
    userId: string,
    role: AppRole,
    query: WorkspaceRequestsQueryDto,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceRequestsResponseDto> {
    return this.workspaceRequests.getRequestsOverview(userId, role, query, acceptLanguage);
  }
}
