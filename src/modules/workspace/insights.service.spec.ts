import { InsightsService, type AnalyticsSnapshot } from './insights.service';

function createSnapshot(overrides?: Partial<AnalyticsSnapshot>): AnalyticsSnapshot {
  return {
    period: '30d',
    generatedAt: '2026-03-11T10:30:00.000Z',
    market: {
      totalRequests: 80,
      totalOffers: 40,
      totalContracts: 18,
      totalCompleted: 10,
      totalRevenue: 1875,
      averageRating: 4.8,
      activeProviders: 44,
      activeCities: 16,
      unansweredRequestsOver24h: 2,
      medianResponseTimeMinutes: 22,
      successRatePercent: 32,
    },
    categories: [
      {
        categoryKey: 'cleaning',
        categoryLabel: 'Cleaning & Housekeeping',
        requests: 22,
        offers: 0,
        activeProviders: 0,
        growthPercentVsPrevPeriod: null,
        searchCount: 0,
        providerSearchCount: 0,
        demandSharePercent: 30,
      },
    ],
    cities: [
      {
        cityKey: 'berlin',
        cityLabel: 'Berlin',
        requests: 16,
        offers: 9,
        activeProviders: 0,
        serviceSearchCount: 9,
        providerSearchCount: 12,
        growthPercentVsPrevPeriod: null,
        demandSupplyRatio: 1.8,
        offerCoverageRate: 60,
      },
    ],
    ...overrides,
  };
}

describe('InsightsService', () => {
  let service: InsightsService;

  beforeEach(() => {
    service = new InsightsService();
  });

  it('returns ranked actionable insights for provider audience', () => {
    const snapshot = createSnapshot({
      user: {
        role: 'provider',
        profileCompleteness: 66,
        hasProfilePhoto: false,
        rating: 4.9,
        reviewCount: 12,
        medianResponseTimeMinutes: 18,
        offersSent: 20,
        confirmations: 11,
        contracts: 8,
        completed: 6,
        revenue: 930,
        profileViews: 140,
        profileViewsGrowthPercent: 24,
      },
    });

    const insights = service.getInsights(snapshot, 'provider');

    expect(insights.length).toBeGreaterThan(0);
    expect(insights.length).toBeLessThanOrEqual(4);
    expect(insights.some((item) => item.type === 'promotion')).toBe(true);
    expect(insights.some((item) => item.type === 'opportunity')).toBe(true);
    expect(insights.every((item) => typeof item.score === 'number')).toBe(true);
  });

  it('limits promotion and risk insights to one each', () => {
    const snapshot = createSnapshot({
      market: {
        ...createSnapshot().market,
        unansweredRequestsOver24h: 7,
        successRatePercent: 18,
      },
      cities: [
        {
          cityKey: 'berlin',
          cityLabel: 'Berlin',
          requests: 16,
          offers: 7,
          activeProviders: 0,
          serviceSearchCount: 7,
          providerSearchCount: 9,
          growthPercentVsPrevPeriod: null,
          demandSupplyRatio: 2.2,
          offerCoverageRate: 44,
        },
        {
          cityKey: 'mannheim',
          cityLabel: 'Mannheim',
          requests: 11,
          offers: 4,
          activeProviders: 0,
          serviceSearchCount: 4,
          providerSearchCount: 8,
          growthPercentVsPrevPeriod: null,
          demandSupplyRatio: 2.4,
          offerCoverageRate: 36,
        },
      ],
      user: {
        role: 'provider',
        profileCompleteness: 90,
        hasProfilePhoto: true,
        rating: 5,
        reviewCount: 24,
        medianResponseTimeMinutes: 17,
        offersSent: 18,
        confirmations: 8,
        contracts: 4,
        completed: 1,
        revenue: 120,
        profileViews: 80,
        profileViewsGrowthPercent: 4,
      },
    });

    const insights = service.getInsights(snapshot, 'provider');
    const promotionCount = insights.filter((item) => item.type === 'promotion').length;
    const riskCount = insights.filter((item) => item.type === 'risk').length;

    expect(promotionCount).toBeLessThanOrEqual(1);
    expect(riskCount).toBeLessThanOrEqual(1);
    expect(insights.length).toBeLessThanOrEqual(4);
  });

  it('returns fallback insight when there are no actionable signals', () => {
    const insights = service.getInsights(
      createSnapshot({
        market: {
          ...createSnapshot().market,
          totalRequests: 0,
          totalOffers: 0,
          totalContracts: 0,
          totalCompleted: 0,
          totalRevenue: 0,
          activeCities: 0,
          activeProviders: 0,
          unansweredRequestsOver24h: 0,
          medianResponseTimeMinutes: null,
          successRatePercent: 0,
        },
        categories: [],
        cities: [],
      }),
      null,
    );

    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({
      code: 'insufficient_data',
      type: 'growth',
      priority: 'low',
    });
  });
});
