import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { UsersService } from '../users/users.service';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { ProviderProfile, type ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import { Favorite, type FavoriteDocument } from '../favorites/schemas/favorite.schema';
import { Review, type ReviewDocument } from '../reviews/schemas/review.schema';
import { ClientProfile, type ClientProfileDocument } from '../users/schemas/client-profile.schema';
import type { AppRole } from '../users/schemas/user.schema';
import type {
  WorkspacePrivateOverviewResponseDto,
  WorkspacePrivatePreferredRole,
} from './dto/workspace-private-response.dto';

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
export class WorkspacePrivateOverviewService {
  constructor(
    private readonly users: UsersService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(ProviderProfile.name) private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(ClientProfile.name) private readonly clientProfileModel: Model<ClientProfileDocument>,
  ) {}

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
}
