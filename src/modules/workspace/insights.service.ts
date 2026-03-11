import { Injectable } from '@nestjs/common';

import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspaceStatisticsInsightDto } from './dto/workspace-statistics-response.dto';

type InsightType = 'demand' | 'opportunity' | 'performance' | 'growth' | 'risk' | 'promotion';
type InsightPriority = 'high' | 'medium' | 'low';
type InsightAudience = 'all' | 'provider' | 'client' | 'guest';
type InsightActionType = 'internal_link' | 'modal' | 'promotion' | 'none';

type InsightMetric = { key: string; value: string | number };
type InsightAction = {
  label: string;
  actionType: InsightActionType;
  href?: string;
  payload?: Record<string, unknown>;
};

export type AnalyticsSnapshot = {
  period: '24h' | '7d' | '30d' | '90d';
  generatedAt: string;
  market: {
    totalRequests: number;
    totalOffers: number;
    totalContracts: number;
    totalCompleted: number;
    totalRevenue: number;
    averageRating: number | null;
    activeProviders: number;
    activeCities: number;
    unansweredRequestsOver24h: number;
    medianResponseTimeMinutes: number | null;
    successRatePercent: number;
  };
  categories: Array<{
    categoryKey: string;
    categoryLabel: string;
    requests: number;
    offers: number;
    activeProviders: number;
    growthPercentVsPrevPeriod: number | null;
    searchCount: number;
    providerSearchCount: number;
    demandSharePercent: number;
  }>;
  cities: Array<{
    cityKey: string;
    cityLabel: string;
    requests: number;
    offers: number;
    activeProviders: number;
    serviceSearchCount: number;
    providerSearchCount: number;
    growthPercentVsPrevPeriod: number | null;
    demandSupplyRatio: number | null;
    offerCoverageRate: number | null;
  }>;
  user?: {
    role: 'provider' | 'client' | 'guest';
    profileCompleteness: number;
    hasProfilePhoto: boolean;
    rating: number | null;
    reviewCount: number;
    medianResponseTimeMinutes: number | null;
    offersSent: number;
    confirmations: number;
    contracts: number;
    completed: number;
    revenue: number;
    profileViews: number;
    profileViewsGrowthPercent: number | null;
  };
};

type RawInsight = {
  type: InsightType;
  audience: InsightAudience;
  templateKey: string;
  scoreBase: number;
  businessImpact: number;
  userRelevance: number;
  confidence: number;
  freshness: number;
  title: string;
  body: string;
  shortLabel?: string;
  icon: string;
  metrics: InsightMetric[];
  contextKey: string;
  context: string | null;
  action?: InsightAction;
  validUntil?: string;
};

type ScoredInsight = RawInsight & {
  score: number;
  priority: InsightPriority;
  level: 'info' | 'trend' | 'warning';
};

@Injectable()
export class InsightsService {
  private static readonly MAX_INSIGHTS = 4;

  getInsights(snapshot: AnalyticsSnapshot, role?: AppRole | null): WorkspaceStatisticsInsightDto[] {
    const audienceRole = this.resolveAudienceRole(role, snapshot.user?.role);
    const raw = this.buildRawInsights(snapshot, audienceRole);
    const scored = raw.map((item) => this.scoreInsight(item));
    const deduped = this.dedupeInsights(scored);
    const ranked = this.limitByPriorityAndType(
      deduped.filter((item) => this.isAudienceAllowed(item.audience, audienceRole)),
    );

    if (ranked.length === 0) {
      return [
        {
          id: 'fallback_not_enough_data',
          type: 'growth',
          priority: 'low',
          audience: 'all',
          score: 10,
          title: 'Noch nicht genug Daten',
          body: 'Sobald mehr Aktivität auf der Plattform vorliegt, erscheinen hier personalisierte Empfehlungen.',
          shortLabel: 'Info',
          icon: 'info',
          confidence: 1,
          metrics: [],
          level: 'info',
          code: 'insufficient_data',
          context: null,
          action: { label: 'none', actionType: 'none' },
          validUntil: snapshot.generatedAt,
        },
      ];
    }

    return ranked.map((item) => this.toDto(item));
  }

  private buildRawInsights(snapshot: AnalyticsSnapshot, audienceRole: 'provider' | 'client' | 'guest'): RawInsight[] {
    return [
      ...this.buildDemandInsights(snapshot),
      ...this.buildOpportunityInsights(snapshot, audienceRole),
      ...this.buildPerformanceInsights(snapshot, audienceRole),
      ...this.buildGrowthInsights(snapshot, audienceRole),
      ...this.buildRiskInsights(snapshot),
      ...this.buildPromotionInsights(snapshot, audienceRole),
    ];
  }

  private buildDemandInsights(snapshot: AnalyticsSnapshot): RawInsight[] {
    const items: RawInsight[] = [];
    const topCategory = snapshot.categories[0];
    if (topCategory && topCategory.requests >= 3) {
      items.push({
        type: 'demand',
        audience: 'all',
        templateKey: 'top_category_demand',
        scoreBase: 72,
        businessImpact: 75,
        userRelevance: 70,
        confidence: 85,
        freshness: 72,
        title: `Hohe Nachfrage in ${topCategory.categoryLabel}`,
        body: `Die Kategorie ${topCategory.categoryLabel} zeigt aktuell besonders hohe Nachfrage.`,
        shortLabel: 'Nachfrage',
        icon: 'trend-up',
        metrics: [
          { key: 'requests', value: topCategory.requests },
          { key: 'sharePercent', value: topCategory.demandSharePercent },
        ],
        contextKey: `category:${topCategory.categoryKey}`,
        context: topCategory.categoryLabel,
        action: {
          label: 'Kategorien ansehen',
          actionType: 'internal_link',
          href: '/workspace?section=stats&focus=categories',
        },
        validUntil: snapshot.generatedAt,
      });
    }

    const topCity = snapshot.cities[0];
    if (topCity && topCity.requests >= 3) {
      items.push({
        type: 'demand',
        audience: 'all',
        templateKey: 'top_city_demand',
        scoreBase: 70,
        businessImpact: 74,
        userRelevance: 68,
        confidence: 82,
        freshness: 72,
        title: `Starke Nachfrage in ${topCity.cityLabel}`,
        body: `In ${topCity.cityLabel} ist die Nachfrage aktuell am höchsten.`,
        shortLabel: 'Stadt',
        icon: 'pin',
        metrics: [{ key: 'requests', value: topCity.requests }],
        contextKey: `city:${topCity.cityKey}`,
        context: topCity.cityLabel,
        action: {
          label: 'Städte ansehen',
          actionType: 'internal_link',
          href: '/workspace?section=stats&focus=cities',
        },
        validUntil: snapshot.generatedAt,
      });
    }

    return items;
  }

  private buildOpportunityInsights(
    snapshot: AnalyticsSnapshot,
    audienceRole: 'provider' | 'client' | 'guest',
  ): RawInsight[] {
    if (audienceRole === 'client') return [];

    const items: RawInsight[] = [];
    const cityOpportunity = snapshot.cities.find((city) => (city.demandSupplyRatio ?? 0) >= 1.5);
    if (cityOpportunity) {
      items.push({
        type: 'opportunity',
        audience: audienceRole === 'guest' ? 'guest' : 'provider',
        templateKey: 'city_opportunity_high',
        scoreBase: 84,
        businessImpact: 88,
        userRelevance: 84,
        confidence: 83,
        freshness: 75,
        title: `Gute Chance in ${cityOpportunity.cityLabel}`,
        body: `In ${cityOpportunity.cityLabel} gibt es aktuell mehr Nachfrage als Anbieter.`,
        shortLabel: 'Marktchance',
        icon: 'spark',
        metrics: [
          { key: 'requests', value: cityOpportunity.requests },
          { key: 'ratio', value: this.round(cityOpportunity.demandSupplyRatio ?? 0, 2) },
        ],
        contextKey: `city-opportunity:${cityOpportunity.cityKey}`,
        context: cityOpportunity.cityLabel,
        action: {
          label: 'Städte ansehen',
          actionType: 'internal_link',
          href: '/workspace?section=stats&focus=cities',
        },
        validUntil: snapshot.generatedAt,
      });
    }

    const categoryOpportunity = snapshot.categories.find((category) => category.demandSharePercent >= 15);
    if (categoryOpportunity) {
      items.push({
        type: 'opportunity',
        audience: audienceRole === 'guest' ? 'guest' : 'provider',
        templateKey: 'category_opportunity_high',
        scoreBase: 78,
        businessImpact: 82,
        userRelevance: 80,
        confidence: 76,
        freshness: 72,
        title: `Wachstumschance in ${categoryOpportunity.categoryLabel}`,
        body: `Neue Anbieter können in ${categoryOpportunity.categoryLabel} aktuell schneller Aufträge finden.`,
        shortLabel: 'Wachstum',
        icon: 'compass',
        metrics: [
          { key: 'requests', value: categoryOpportunity.requests },
          { key: 'sharePercent', value: categoryOpportunity.demandSharePercent },
        ],
        contextKey: `category-opportunity:${categoryOpportunity.categoryKey}`,
        context: categoryOpportunity.categoryLabel,
        action: {
          label: 'Kategorie öffnen',
          actionType: 'internal_link',
          href: '/workspace?section=requests',
        },
        validUntil: snapshot.generatedAt,
      });
    }

    return items;
  }

  private buildPerformanceInsights(
    snapshot: AnalyticsSnapshot,
    audienceRole: 'provider' | 'client' | 'guest',
  ): RawInsight[] {
    if (audienceRole === 'guest') return [];
    const items: RawInsight[] = [];

    const responseTime = snapshot.user?.medianResponseTimeMinutes ?? snapshot.market.medianResponseTimeMinutes;
    if (typeof responseTime === 'number' && responseTime > 0 && responseTime <= 30) {
      items.push({
        type: 'performance',
        audience: 'provider',
        templateKey: 'user_fast_response',
        scoreBase: 73,
        businessImpact: 70,
        userRelevance: 82,
        confidence: 74,
        freshness: 70,
        title: 'Schnelle Reaktionszeit',
        body: 'Deine Antwortzeit liegt unter dem Plattform-Durchschnitt.',
        shortLabel: 'Speed',
        icon: 'bolt',
        metrics: [{ key: 'responseMinutes', value: Math.round(responseTime) }],
        contextKey: 'user:response-time',
        context: `${Math.round(responseTime)}`,
        validUntil: snapshot.generatedAt,
      });
    }

    const successRate = snapshot.market.successRatePercent;
    if (successRate > 0 && successRate < 25) {
      items.push({
        type: 'performance',
        audience: 'provider',
        templateKey: 'user_low_conversion',
        scoreBase: 76,
        businessImpact: 80,
        userRelevance: 86,
        confidence: 78,
        freshness: 75,
        title: 'Potenzial bei Abschlüssen',
        body: 'Viele Angebote führen noch nicht zu Verträgen. Optimiere Profil und Antwortqualität.',
        shortLabel: 'Conversion',
        icon: 'chart',
        metrics: [{ key: 'successRatePercent', value: successRate }],
        contextKey: 'user:conversion-low',
        context: `${successRate}`,
        action: {
          label: 'Profil optimieren',
          actionType: 'internal_link',
          href: '/workspace?section=profile',
        },
        validUntil: snapshot.generatedAt,
      });
    }

    return items;
  }

  private buildGrowthInsights(
    snapshot: AnalyticsSnapshot,
    audienceRole: 'provider' | 'client' | 'guest',
  ): RawInsight[] {
    if (audienceRole === 'guest' || !snapshot.user) return [];
    const items: RawInsight[] = [];

    if (!snapshot.user.hasProfilePhoto) {
      items.push({
        type: 'growth',
        audience: 'provider',
        templateKey: 'profile_missing_photo',
        scoreBase: 69,
        businessImpact: 67,
        userRelevance: 82,
        confidence: 80,
        freshness: 67,
        title: 'Profil verbessern',
        body: 'Profile mit Foto erhalten häufiger Rückmeldungen.',
        shortLabel: 'Profil',
        icon: 'camera',
        metrics: [],
        contextKey: 'profile:photo-missing',
        context: null,
        action: {
          label: 'Profil aktualisieren',
          actionType: 'internal_link',
          href: '/workspace?section=profile',
        },
        validUntil: snapshot.generatedAt,
      });
    }

    if (snapshot.user.profileCompleteness < 70) {
      items.push({
        type: 'growth',
        audience: 'provider',
        templateKey: 'profile_low_completeness',
        scoreBase: 66,
        businessImpact: 62,
        userRelevance: 79,
        confidence: 81,
        freshness: 67,
        title: 'Profil vervollständigen',
        body: 'Ein vollständiges Profil verbessert Sichtbarkeit und Abschlusschancen.',
        shortLabel: 'Profil',
        icon: 'profile',
        metrics: [{ key: 'profileCompleteness', value: snapshot.user.profileCompleteness }],
        contextKey: 'profile:completeness-low',
        context: `${snapshot.user.profileCompleteness}`,
        action: {
          label: 'Profil prüfen',
          actionType: 'internal_link',
          href: '/workspace?section=profile',
        },
        validUntil: snapshot.generatedAt,
      });
    }

    return items;
  }

  private buildRiskInsights(snapshot: AnalyticsSnapshot): RawInsight[] {
    const items: RawInsight[] = [];
    if (snapshot.market.unansweredRequestsOver24h >= 3) {
      items.push({
        type: 'risk',
        audience: 'all',
        templateKey: 'high_unanswered_requests',
        scoreBase: 82,
        businessImpact: 85,
        userRelevance: 75,
        confidence: 86,
        freshness: 80,
        title: 'Viele offene Anfragen',
        body: 'Mehrere Anfragen bleiben länger als 24 Stunden unbeantwortet.',
        shortLabel: 'Risiko',
        icon: 'alert',
        metrics: [{ key: 'unansweredRequests24h', value: snapshot.market.unansweredRequestsOver24h }],
        contextKey: 'market:unanswered',
        context: `${snapshot.market.unansweredRequestsOver24h}`,
        validUntil: snapshot.generatedAt,
      });
    }
    return items;
  }

  private buildPromotionInsights(
    snapshot: AnalyticsSnapshot,
    audienceRole: 'provider' | 'client' | 'guest',
  ): RawInsight[] {
    if (audienceRole === 'client') return [];
    const city = snapshot.cities.find((item) => (item.demandSupplyRatio ?? 0) >= 1.7 && item.providerSearchCount >= 2);
    if (!city) return [];

    return [
      {
        type: 'promotion',
        audience: audienceRole === 'guest' ? 'guest' : 'provider',
        templateKey: 'local_ads_opportunity',
        scoreBase: 74,
        businessImpact: 78,
        userRelevance: 74,
        confidence: 72,
        freshness: 73,
        title: 'Lokale Werbung lohnt sich',
        body: `In ${city.cityLabel} kann lokale Sichtbarkeit aktuell besonders wirksam sein.`,
        shortLabel: 'Promotion',
        icon: 'megaphone',
        metrics: [
          { key: 'providerSearchCount', value: city.providerSearchCount },
          { key: 'ratio', value: this.round(city.demandSupplyRatio ?? 0, 2) },
        ],
        contextKey: `promotion-city:${city.cityKey}`,
        context: city.cityLabel,
        action: {
          label: 'Mehr erfahren',
          actionType: 'promotion',
          href: '/workspace?section=stats&focus=growth',
        },
        validUntil: snapshot.generatedAt,
      },
    ];
  }

  private scoreInsight(item: RawInsight): ScoredInsight {
    const weightedScore =
      item.businessImpact * 0.35 +
      item.userRelevance * 0.3 +
      item.confidence * 0.2 +
      item.freshness * 0.15;

    const score = this.clamp(Math.round(weightedScore), 0, 100);
    const priority: InsightPriority = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';

    const level: ScoredInsight['level'] =
      item.type === 'risk'
        ? 'warning'
        : item.type === 'demand' || item.type === 'opportunity' || item.type === 'performance'
          ? 'trend'
          : 'info';

    return {
      ...item,
      score,
      priority,
      level,
    };
  }

  private dedupeInsights(items: ScoredInsight[]): ScoredInsight[] {
    const deduped = new Map<string, ScoredInsight>();
    for (const item of items) {
      const key = `${item.contextKey}:${item.audience}`;
      const existing = deduped.get(key);
      if (!existing || item.score > existing.score || (item.score === existing.score && this.typeRank(item.type) > this.typeRank(existing.type))) {
        deduped.set(key, item);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => b.score - a.score);
  }

  private limitByPriorityAndType(items: ScoredInsight[]): ScoredInsight[] {
    const sorted = items.sort((a, b) => b.score - a.score);
    const result: ScoredInsight[] = [];
    let promotionCount = 0;
    let riskCount = 0;

    for (const item of sorted) {
      if (item.type === 'promotion' && promotionCount >= 1) continue;
      if (item.type === 'risk' && riskCount >= 1) continue;

      result.push(item);
      if (item.type === 'promotion') promotionCount += 1;
      if (item.type === 'risk') riskCount += 1;
      if (result.length >= InsightsService.MAX_INSIGHTS) break;
    }

    return result;
  }

  private toDto(item: ScoredInsight): WorkspaceStatisticsInsightDto {
    return {
      id: `${item.templateKey}:${item.contextKey}`,
      type: item.type,
      priority: item.priority,
      audience: item.audience,
      score: item.score,
      title: item.title,
      body: item.body,
      shortLabel: item.shortLabel,
      icon: item.icon,
      confidence: this.round(item.confidence / 100, 2),
      metrics: item.metrics,
      action: item.action,
      validUntil: item.validUntil,
      level: item.level,
      code: item.templateKey,
      context: item.context,
    };
  }

  private resolveAudienceRole(
    role: AppRole | null | undefined,
    snapshotRole?: 'provider' | 'client' | 'guest',
  ): 'provider' | 'client' | 'guest' {
    if (snapshotRole === 'provider' || snapshotRole === 'client' || snapshotRole === 'guest') return snapshotRole;
    if (role === 'provider') return 'provider';
    if (role === 'client') return 'client';
    return 'guest';
  }

  private isAudienceAllowed(
    audience: InsightAudience,
    role: 'provider' | 'client' | 'guest',
  ): boolean {
    if (audience === 'all') return true;
    return audience === role;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  private round(value: number, fractionDigits: number): number {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** fractionDigits;
    return Math.round(value * factor) / factor;
  }

  private typeRank(type: InsightType): number {
    if (type === 'opportunity') return 6;
    if (type === 'performance') return 5;
    if (type === 'demand') return 4;
    if (type === 'growth') return 3;
    if (type === 'promotion') return 2;
    return 1;
  }
}
