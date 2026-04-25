import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspacePrivatePreferredRole } from './dto/workspace-private-response.dto';

export const REQUEST_STATUSES = ['draft', 'published', 'paused', 'matched', 'closed', 'cancelled'] as const;
export const OFFER_STATUSES = ['sent', 'accepted', 'declined', 'withdrawn'] as const;
export const CONTRACT_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;
export const PRIVATE_OVERVIEW_PERIOD_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
} as const;

export class WorkspacePrivateOverviewSupport {
  toStatusCounts<T extends string>(
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

  monthBoundsUTC(offsetFromCurrent: number): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetFromCurrent, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetFromCurrent + 1, 1, 0, 0, 0, 0));
    return { start, end };
  }

  buildDelta(current: number, previous: number): { kind: 'percent' | 'new' | 'none'; percent: number | null } {
    if (previous <= 0) {
      if (current <= 0) return { kind: 'none', percent: null };
      return { kind: 'new', percent: null };
    }
    const raw = ((current - previous) / previous) * 100;
    const rounded = Math.round(raw);
    const safe = Object.is(rounded, -0) ? 0 : rounded;
    return { kind: 'percent', percent: safe };
  }

  resolvePrivateOverviewPeriodStart(period: keyof typeof PRIVATE_OVERVIEW_PERIOD_MS): Date {
    return new Date(Date.now() - PRIVATE_OVERVIEW_PERIOD_MS[period]);
  }

  parseActivityAt(value: Date | string | null | undefined): number | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  countItemsWithinPeriod<T extends { updatedAt?: Date | string | null; createdAt?: Date | string | null }>(
    items: T[],
    cutoffMs: number,
  ) {
    return items.reduce((count, item) => {
      const activityAt = this.parseActivityAt(item.updatedAt) ?? this.parseActivityAt(item.createdAt);
      return activityAt !== null && activityAt >= cutoffMs ? count + 1 : count;
    }, 0);
  }

  resolvePrivateOverviewPreferredRole(params: {
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

  computeProviderCompleteness(profile: any | null): number {
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

  computeClientCompleteness(user: any | null, hasClientProfile: boolean): number {
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
}
