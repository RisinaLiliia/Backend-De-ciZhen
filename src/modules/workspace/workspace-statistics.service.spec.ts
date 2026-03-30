import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspaceStatisticsService } from './workspace-statistics.service';
import { WorkspaceService } from './workspace.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Request } from '../requests/schemas/request.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { Review } from '../reviews/schemas/review.schema';
import { InsightsService } from './insights.service';

describe('WorkspaceStatisticsService (unit)', () => {
  let service: WorkspaceStatisticsService;

  const workspaceMock = {
    getPublicOverview: jest.fn(),
    getPrivateOverview: jest.fn(),
  };

  const analyticsMock = {
    getPlatformActivity: jest.fn(),
    getCitySearchCounts: jest.fn(),
  };
  const insightsMock = {
    getInsights: jest.fn(),
  };
  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'app.platformTakeRatePercent') return 10;
      return undefined;
    }),
  };

  const requestModelMock = {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  };

  const contractModelMock = {
    aggregate: jest.fn(),
  };

  const offerModelMock = {
    aggregate: jest.fn(),
  };

  const reviewModelMock = {
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    requestModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    requestModelMock.countDocuments.mockResolvedValue(0);
    offerModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    contractModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    insightsMock.getInsights.mockReturnValue([
      {
        id: 'top_category_demand:category:cleaning',
        type: 'demand',
        priority: 'medium',
        audience: 'all',
        score: 70,
        title: 'Hohe Nachfrage in Cleaning',
        body: 'Die Kategorie Cleaning zeigt aktuell besonders hohe Nachfrage.',
        icon: 'trend-up',
        confidence: 0.8,
        metrics: [{ key: 'requests', value: 11 }],
        level: 'trend',
        code: 'top_category_demand',
        context: 'Cleaning',
      },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceStatisticsService,
        { provide: ConfigService, useValue: configMock },
        { provide: WorkspaceService, useValue: workspaceMock },
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: InsightsService, useValue: insightsMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
        { provide: getModelToken(Offer.name), useValue: offerModelMock },
        { provide: getModelToken(Contract.name), useValue: contractModelMock },
        { provide: getModelToken(Review.name), useValue: reviewModelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceStatisticsService);
  });

  it('builds decision insight for high unanswered backlog', () => {
    const insight = (
      service as unknown as {
        buildDecisionInsight: (params: {
          activityMetrics: {
            offerRatePercent: number;
            responseMedianMinutes: number | null;
            unansweredRequests24h: number;
            completedJobs: number;
          };
          conversionRatePercent: number;
        }) => string;
      }
    ).buildDecisionInsight({
      activityMetrics: {
        offerRatePercent: 68,
        responseMedianMinutes: 10_500,
        unansweredRequests24h: 56,
        completedJobs: 38,
      } as never,
      conversionRatePercent: 26,
    });

    expect(insight).toContain('68 %');
    expect(insight).toContain('56 Anfragen');
    expect(insight).toContain('unbeantwortet');
  });

  it('builds decision insight for slow response-time signal', () => {
    const insight = (
      service as unknown as {
        buildDecisionInsight: (params: {
          activityMetrics: {
            offerRatePercent: number;
            responseMedianMinutes: number | null;
            unansweredRequests24h: number;
            completedJobs: number;
          };
          conversionRatePercent: number;
        }) => string;
      }
    ).buildDecisionInsight({
      activityMetrics: {
        offerRatePercent: 52,
        responseMedianMinutes: 950,
        unansweredRequests24h: 8,
        completedJobs: 14,
      } as never,
      conversionRatePercent: 19,
    });

    expect(insight).toContain('Antwortzeit');
    expect(insight).toContain('Schnellere Reaktionen');
  });

  it('builds decision insight for strong conversion signal', () => {
    const insight = (
      service as unknown as {
        buildDecisionInsight: (params: {
          activityMetrics: {
            offerRatePercent: number;
            responseMedianMinutes: number | null;
            unansweredRequests24h: number;
            completedJobs: number;
          };
          conversionRatePercent: number;
        }) => string;
      }
    ).buildDecisionInsight({
      activityMetrics: {
        offerRatePercent: 72,
        responseMedianMinutes: 80,
        unansweredRequests24h: 3,
        completedJobs: 20,
      } as never,
      conversionRatePercent: 41,
    });

    expect(insight).toContain('stabile Abschlussquote');
    expect(insight).toContain('Sichtbarkeit');
  });

  it('builds canonical activityComparison from market timeline and user activity rows', () => {
    const activityComparison = (
      service as unknown as {
        buildActivityComparison: (params: {
          mode: 'platform' | 'personalized';
          marketPoints: Array<{ timestamp: string; requests: number; offers: number }>;
          stepMs: number;
          clientRows: Array<{ createdAt?: Date | string | null }>;
          providerRows: Array<{ createdAt?: Date | string | null }>;
          activityTotals: {
            peakTimestamp: string | null;
            bestWindowTimestamp: string | null;
          };
          updatedAt: string;
        }) => {
          hasReliableSeries: boolean;
          title?: string | null;
          subtitle?: string | null;
          summary?: string | null;
          peakTimestamp?: string | null;
          bestWindowTimestamp?: string | null;
          updatedAt?: string | null;
          points: Array<{ clientActivity: number | null; providerActivity: number | null }>;
        } | null;
      }
    ).buildActivityComparison({
      mode: 'personalized',
      marketPoints: [
        { timestamp: '2026-03-09T00:00:00.000Z', requests: 4, offers: 2 },
        { timestamp: '2026-03-10T00:00:00.000Z', requests: 6, offers: 3 },
      ],
      stepMs: 24 * 60 * 60 * 1000,
      clientRows: [
        { createdAt: '2026-03-09T08:00:00.000Z' },
        { createdAt: '2026-03-10T09:00:00.000Z' },
        { createdAt: '2026-03-10T18:00:00.000Z' },
      ],
      providerRows: [
        { createdAt: '2026-03-09T10:00:00.000Z' },
      ],
      activityTotals: {
        peakTimestamp: '2026-03-10T00:00:00.000Z',
        bestWindowTimestamp: '2026-03-10T00:00:00.000Z',
      },
      updatedAt: '2026-03-26T19:19:00.000Z',
    });

    expect(activityComparison).toEqual(
      expect.objectContaining({
        title: 'Aktivität der Plattform',
        subtitle: 'Neue Anfragen und Angebote im Zeitverlauf',
        hasReliableSeries: true,
        peakTimestamp: '2026-03-10T00:00:00.000Z',
        bestWindowTimestamp: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-26T19:19:00.000Z',
      }),
    );
    expect(activityComparison?.points).toEqual([
      {
        timestamp: '2026-03-09T00:00:00.000Z',
        clientActivity: 1,
        providerActivity: 1,
      },
      {
        timestamp: '2026-03-10T00:00:00.000Z',
        clientActivity: 2,
        providerActivity: 0,
      },
    ]);
    expect(activityComparison?.summary).toBe('Deine stärkste Aktivität liegt aktuell außerhalb des Marktpeaks.');
  });

  it('returns platform mode payload for guest', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 120,
        totalActiveProviders: 25,
      },
      cityActivity: {
        items: [
          { citySlug: 'berlin', cityName: 'Berlin', cityId: 'public-c-1', requestCount: 9, lat: 52.52, lng: 13.405 },
        ],
      },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [
        { timestamp: '2026-03-01T00:00:00.000Z', requests: 10, offers: 7 },
        { timestamp: '2026-03-02T00:00:00.000Z', requests: 12, offers: 9 },
      ],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([
      {
        cityId: 'c-1',
        cityName: 'Berlin',
        citySlug: 'berlin',
        requestSearchCount: 21,
        providerSearchCount: 14,
      },
    ]);

    requestModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 11 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 11 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, requestCount: 9, anbieterSuchenCount: 4 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-03-01T08:00:00.000Z'),
            firstOfferAt: new Date('2026-03-01T08:30:00.000Z'),
            responseMinutes: 30,
          },
          {
            createdAt: new Date('2026-03-02T08:00:00.000Z'),
            firstOfferAt: null,
            responseMinutes: null,
          },
        ]),
      });
    requestModelMock.countDocuments.mockResolvedValue(22);

    offerModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, auftragSuchenCount: 12 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: 'provider-1' }, { _id: 'provider-2' }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, providersActive: 2 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 16, confirmedResponsesTotal: 6 }]),
      });

    contractModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 5, cancelledJobs: 1, gmvAmount: 1250 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: null, closedContractsTotal: 9, completedJobsTotal: 5, profitAmount: 1250 },
        ]),
      });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ total: 22, average: 4.6 }]),
    });

    const result = await service.getStatisticsOverview('30d');

    expect(result.mode).toBe('platform');
    expect(result.summary.totalPublishedRequests).toBe(22);
    expect(result.summary.totalActiveProviders).toBe(2);
    expect(result.kpis.requestsTotal).toBe(22);
    expect(result.kpis.offersTotal).toBe(16);
    expect(result.filterOptions.cities).toEqual([{ value: 'public-c-1', label: 'Berlin' }]);
    expect(result.filterOptions.categories).toEqual([{ value: 'cleaning', label: 'Cleaning' }]);
    expect(result.decisionContext).toMatchObject({
      mode: 'global',
      city: { value: null, label: 'Alle Städte' },
      category: { value: null, label: 'Alle Kategorien' },
      stickyLabel: '30 Tage · Alle Städte · Alle Kategorien · Alle Services',
    });
    expect(result.sectionMeta.opportunityTitle).toBe('Opportunity Radar');
    expect(result.exportMeta.filename).toContain('workspace-statistics-30d-');
    expect(result.demand.categories[0]).toMatchObject({
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      requestCount: 11,
    });
    const categoryPipeline = requestModelMock.aggregate.mock.calls[1]?.[0] as Array<Record<string, unknown>>;
    expect(categoryPipeline.some((stage) => Object.prototype.hasOwnProperty.call(stage, '$limit'))).toBe(false);
    const cityPipeline = requestModelMock.aggregate.mock.calls[2]?.[0] as Array<Record<string, unknown>>;
    expect(cityPipeline.some((stage) => Object.prototype.hasOwnProperty.call(stage, '$limit'))).toBe(false);
    expect(result.demand.cities[0]).toMatchObject({
      cityName: 'Berlin',
      requestCount: 9,
      auftragSuchenCount: 21,
      anbieterSuchenCount: 14,
      marketBalanceRatio: 0.67,
      signal: 'low',
      lat: 52.52,
      lng: 13.405,
    });
    expect(result.opportunityRadar).toHaveLength(1);
    expect(result.opportunityRadar[0]).toMatchObject({
      rank: 1,
      city: 'Berlin',
      categoryKey: 'cleaning',
      demand: 14,
      providers: 21,
      score: 7.6,
      status: 'good',
      tone: 'high',
      summaryKey: 'good',
    });
    expect(result.opportunityRadar[0].metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'demand', value: 10, semanticTone: 'very-high' }),
        expect.objectContaining({ key: 'competition', value: 5.5, semanticKey: 'medium' }),
      ]),
    );
    expect(result.priceIntelligence).toMatchObject({
      city: 'Berlin',
      categoryKey: 'cleaning',
      recommendedMin: 215,
      recommendedMax: 290,
      marketAverage: 250,
      optimalMin: 241,
      optimalMax: 268,
      smartRecommendedPrice: 255,
      smartSignalTone: 'balanced',
      analyzedRequestsCount: 14,
      confidenceLevel: 'low',
      profitPotentialScore: 10,
      profitPotentialStatus: 'high',
    });
    expect(result.priceIntelligence.recommendation).toContain('höchste Abschlussrate in Berlin');
    expect(result.activity.metrics).toMatchObject({
      offerRatePercent: 73,
      responseMedianMinutes: 30,
      unansweredRequests24h: 1,
      cancellationRatePercent: 17,
      completedJobs: 5,
      gmvAmount: 1250,
      platformRevenueAmount: 125,
      takeRatePercent: 10,
      offerRateTone: 'positive',
      responseMedianTone: 'positive',
      unansweredTone: 'warning',
      cancellationTone: 'neutral',
      completedTone: 'positive',
      revenueTone: 'positive',
    });
    expect(result.profileFunnel).toMatchObject({
      periodLabel: '30 Tage',
      stage1: 22,
      stage2: 16,
      stage3: 6,
      stage4: 6,
      requestsTotal: 22,
      offersTotal: 16,
      confirmedResponsesTotal: 6,
      closedContractsTotal: 6,
      completedJobsTotal: 5,
      profitAmount: 1250,
      offerResponseRatePercent: 73,
      confirmationRatePercent: 38,
      contractClosureRatePercent: 100,
      completionRatePercent: 83,
      conversionRate: 23,
      totalConversionPercent: 23,
      summaryText: 'Von 22 Anfragen wurden 5 erfolgreich abgeschlossen.',
    });
    expect(result.profileFunnel.stages).toHaveLength(6);
    expect(result.profileFunnel.stages[0]).toMatchObject({
      id: 'requests',
      label: 'Anfragen',
      displayValue: '22',
      widthPercent: 100,
      rateLabel: 'Basis',
      ratePercent: 100,
    });
    expect(result.profileFunnel.stages[5]).toMatchObject({
      id: 'revenue',
      label: 'Gewinnsumme',
      displayValue: '1.250 €',
      widthPercent: 22.73,
      helperText: '250 €',
    });
    expect(typeof result.decisionInsight).toBe('string');
    expect(result.decisionInsight.length).toBeGreaterThan(0);
    expect(insightsMock.getInsights).toHaveBeenCalledTimes(1);
    expect(insightsMock.getInsights.mock.calls[0]?.[1]).toBeUndefined();
    expect(result.insights[0]).toMatchObject({
      code: 'top_category_demand',
      type: 'demand',
      title: 'Hohe Nachfrage in Cleaning',
    });
  });

  it('returns personalized mode payload for authenticated user', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 80,
        totalActiveProviders: 14,
      },
      cityActivity: { items: [] },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '7d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [{ timestamp: '2026-03-09T00:00:00.000Z', requests: 4, offers: 2 }],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([]);

    requestModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });
    requestModelMock.countDocuments
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(12);

    offerModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 6, confirmedResponsesTotal: 3 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 9, confirmedResponsesTotal: 7 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, requestsTotal: 3, offersTotal: 6, confirmedResponsesTotal: 3 }]),
      });

    contractModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 2, cancelledJobs: 1, gmvAmount: 400 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: null, closedContractsTotal: 3, completedJobsTotal: 2, profitAmount: 400 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: null, closedContractsTotal: 5, completedJobsTotal: 3, profitAmount: 900 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: null, contractsTotal: 3, completedTotal: 2, revenueAmount: 400 },
        ]),
      });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    workspaceMock.getPrivateOverview.mockResolvedValue({
      requestsByStatus: { total: 5 },
      providerOffersByStatus: { sent: 6, accepted: 3 },
      providerContractsByStatus: { completed: 2 },
      clientContractsByStatus: { completed: 1 },
      profiles: { providerCompleteness: 72, clientCompleteness: 64 },
      kpis: { acceptanceRate: 44, avgResponseMinutes: 18, myOpenRequests: 3, recentOffers7d: 2 },
    });

    const result = await service.getStatisticsOverview('7d', 'user-1', 'provider');

    expect(workspaceMock.getPrivateOverview).toHaveBeenCalledWith('user-1', 'provider');
    expect(result.mode).toBe('personalized');
    expect(result.kpis.requestsTotal).toBe(5);
    expect(result.kpis.completedJobsTotal).toBe(3);
    expect(result.kpis.profileCompleteness).toBe(72);
    expect(result.decisionContext.mode).toBe('global');
    expect(result.filterOptions.services).toEqual([]);
    expect(result.profileFunnel.periodLabel).toBe('7 Tage');
    expect(result.profileFunnel.stages).toHaveLength(6);
    expect(result.profileFunnel.stages[0]).toMatchObject({
      id: 'requests',
      label: 'Anfragen',
    });
    expect(result.profileFunnel.stages[5]).toMatchObject({
      id: 'revenue',
    });
    expect(result.viewerMode).toBe('provider');
    expect(result.decisionLayer).toMatchObject({
      title: 'Decision Layer',
      subtitle: 'User vs Market im aktuellen Kontext',
    });
    expect(result.decisionLayer?.metrics).toHaveLength(6);
    expect(result.decisionLayer?.metrics[0]).toMatchObject({
      id: 'offer_rate',
      label: 'Angebotsquote',
    });
    expect(result.decisionLayer?.metrics[1]).toMatchObject({
      id: 'avg_response_time',
      label: 'Median Antwortzeit',
      userValue: null,
    });
    const offerRateMetric = result.decisionLayer?.metrics.find((metric) => metric.id === 'offer_rate');
    const completedMetric = result.decisionLayer?.metrics.find((metric) => metric.id === 'completed_jobs');
    const offersStage = result.funnelComparison?.stages.find((stage) => stage.key === 'offers');
    const completedStage = result.funnelComparison?.stages.find((stage) => stage.key === 'completed');
    expect(offerRateMetric?.userValue).toBe(offersStage?.userRateFromPrev ?? null);
    expect(offerRateMetric?.marketValue).toBe(offersStage?.marketRateFromPrev ?? null);
    expect(completedMetric?.userValue).toBe(completedStage?.userCount ?? null);
    expect(completedMetric?.marketValue).toBe(completedStage?.marketCount ?? null);
    expect(result.decisionLayer?.primaryInsight).toBeTruthy();
    expect(result.decisionLayer?.metrics.every((metric) => Object.prototype.hasOwnProperty.call(metric, 'marketValue'))).toBe(true);
    expect(result.decisionLayer?.metrics.every((metric) => Object.prototype.hasOwnProperty.call(metric, 'primaryActionCode'))).toBe(true);
    expect(result.funnelComparison).toMatchObject({
      title: 'Profil Performance',
    });
    expect(result.funnelComparison?.stages).toHaveLength(5);
    expect(result.funnelComparison?.stages[2]).toMatchObject({
      key: 'responses',
      label: 'Rückmeldungen',
    });
    expect(result.profileFunnel.completedJobsTotal).toBeLessThanOrEqual(result.profileFunnel.closedContractsTotal);
    expect(result.profileFunnel.closedContractsTotal).toBeLessThanOrEqual(result.profileFunnel.confirmedResponsesTotal);
    expect(result.profileFunnel.confirmedResponsesTotal).toBeLessThanOrEqual(result.profileFunnel.offersTotal);
    expect(result.profileFunnel.offersTotal).toBeLessThanOrEqual(result.profileFunnel.requestsTotal);
    const personalizedUserStageCounts = result.funnelComparison?.stages.map((stage) => stage.userCount) ?? [];
    const personalizedMarketStageCounts = result.funnelComparison?.stages.map((stage) => stage.marketCount) ?? [];
    expect(personalizedUserStageCounts[4]).toBeLessThanOrEqual(personalizedUserStageCounts[3]);
    expect(personalizedUserStageCounts[3]).toBeLessThanOrEqual(personalizedUserStageCounts[2]);
    expect(personalizedUserStageCounts[2]).toBeLessThanOrEqual(personalizedUserStageCounts[1]);
    expect(personalizedUserStageCounts[1]).toBeLessThanOrEqual(personalizedUserStageCounts[0]);
    expect(personalizedMarketStageCounts[4]).toBeLessThanOrEqual(personalizedMarketStageCounts[3]);
    expect(personalizedMarketStageCounts[3]).toBeLessThanOrEqual(personalizedMarketStageCounts[2]);
    expect(personalizedMarketStageCounts[2]).toBeLessThanOrEqual(personalizedMarketStageCounts[1]);
    expect(personalizedMarketStageCounts[1]).toBeLessThanOrEqual(personalizedMarketStageCounts[0]);
    expect(result.personalizedPricing).toMatchObject({
      title: 'Preisstrategie',
      comparisonReliability: expect.stringMatching(/^(high|medium|low|unavailable)$/),
    });
    expect(result.categoryFit).toMatchObject({
      title: 'Kategorien-Fit',
      hasReliableItems: expect.any(Boolean),
    });
    expect(Array.isArray(result.categoryFit?.items)).toBe(true);
    if ((result.categoryFit?.items.length ?? 0) > 0) {
      expect(result.categoryFit?.items[0]).toEqual(
        expect.objectContaining({
          reliability: expect.stringMatching(/^(high|medium|low|unknown)$/),
        }),
      );
    }
    expect(result.cityComparison).toMatchObject({
      title: 'Städtevergleich',
      hasReliableItems: expect.any(Boolean),
    });
    expect(Array.isArray(result.cityComparison?.items)).toBe(true);
    if ((result.cityComparison?.items.length ?? 0) > 0) {
      expect(result.cityComparison?.items[0]).toEqual(
        expect.objectContaining({
          reliability: expect.stringMatching(/^(high|medium|low|unknown)$/),
        }),
      );
    }
    expect(Array.isArray(result.opportunityRadar)).toBe(true);
    expect(result.risks).toMatchObject({
      title: 'Risiken',
      hasReliableItems: expect.any(Boolean),
    });
    expect(result.opportunities).toMatchObject({
      title: 'Chancen',
      hasReliableItems: expect.any(Boolean),
    });
    expect(result.nextSteps).toMatchObject({
      title: 'Nächste Schritte',
      hasReliableItems: expect.any(Boolean),
    });
    expect(Array.isArray(result.opportunities?.items)).toBe(true);
    if ((result.opportunities?.items.length ?? 0) > 0) {
      expect(result.opportunities?.items[0]).toEqual(
        expect.objectContaining({
          reliability: expect.stringMatching(/^(high|medium|low)$/),
        }),
      );
    }
    expect(result.priceIntelligence).toMatchObject({
      city: null,
      categoryKey: null,
      analyzedRequestsCount: null,
      confidenceLevel: null,
      profitPotentialScore: null,
      profitPotentialStatus: null,
    });
    expect(result.decisionInsight).toBe(result.decisionLayer?.primaryInsight);
    expect(insightsMock.getInsights).toHaveBeenCalledTimes(1);
    expect(insightsMock.getInsights.mock.calls[0]?.[1]).toBe('provider');
  });

  it('supports customer viewerMode in decision layer', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 42,
        totalActiveProviders: 10,
      },
      cityActivity: { items: [] },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '7d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [{ timestamp: '2026-03-09T00:00:00.000Z', requests: 6, offers: 4 }],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([]);

    requestModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });
    requestModelMock.countDocuments
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(4);

    offerModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 5, confirmedResponsesTotal: 2 }]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 8, confirmedResponsesTotal: 5 }]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 5, acceptedOffersTotal: 2 }]) });

    contractModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 2, cancelledJobs: 0, gmvAmount: 600 }]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, closedContractsTotal: 2, completedJobsTotal: 2, profitAmount: 600 }]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, closedContractsTotal: 6, completedJobsTotal: 4, profitAmount: 1200 }]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, contractsTotal: 2, completedTotal: 2, revenueAmount: 600 }]) });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    workspaceMock.getPrivateOverview.mockResolvedValue({
      requestsByStatus: { total: 4 },
      providerOffersByStatus: { sent: 0, accepted: 0 },
      providerContractsByStatus: { completed: 0 },
      clientContractsByStatus: { completed: 2 },
      profiles: { providerCompleteness: 40, clientCompleteness: 88 },
      kpis: { acceptanceRate: 50, avgResponseMinutes: null, myOpenRequests: 2, recentOffers7d: 0 },
    });

    const result = await service.getStatisticsOverview({ range: '7d', viewerMode: 'customer' }, 'user-2', 'client');

    expect(result.viewerMode).toBe('customer');
    expect(result.decisionLayer?.metrics[0]).toMatchObject({
      id: 'offer_rate',
      label: 'Anfragen mit Angeboten',
    });
    expect(result.decisionLayer?.metrics[1]).toMatchObject({
      id: 'avg_response_time',
      label: 'Zeit bis erstes Angebot',
    });
    expect(result.decisionLayer?.metrics[2]).toMatchObject({
      id: 'unanswered_over_24h',
      label: 'Ohne Angebot >24h',
    });
  });

  it('preserves service filter context for customer statistics and keeps avg order value null without completed jobs', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 1,
        totalActiveProviders: 1,
      },
      cityActivity: { items: [] },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '90d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [{ timestamp: '2026-03-09T00:00:00.000Z', requests: 1, offers: 0 }],
    });
    analyticsMock.getCitySearchCounts.mockResolvedValue([]);

    requestModelMock.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    requestModelMock.countDocuments.mockResolvedValue(1);

    offerModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    contractModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    workspaceMock.getPrivateOverview.mockResolvedValue({
      requestsByStatus: { total: 1 },
      providerOffersByStatus: { sent: 0, accepted: 0 },
      providerContractsByStatus: { completed: 0 },
      clientContractsByStatus: { completed: 0 },
      profiles: { providerCompleteness: 40, clientCompleteness: 88 },
      kpis: { acceptanceRate: 0, avgResponseMinutes: null, myOpenRequests: 1, recentOffers7d: 0 },
    });

    const result = await service.getStatisticsOverview({
      range: '90d',
      cityId: 'karlsruhe-id',
      categoryKey: 'plumbing',
      subcategoryKey: 'wc_repair',
      viewerMode: 'customer',
    }, 'user-2', 'client');

    const averageOrderMetric = result.decisionLayer?.metrics.find((metric) => metric.id === 'average_order_value');

    expect(averageOrderMetric).toMatchObject({
      marketValue: null,
      userValue: null,
    });
    expect(result.decisionContext.service).toEqual({
      value: 'wc_repair',
      label: 'wc_repair',
    });
    expect(analyticsMock.getPlatformActivity).toHaveBeenCalledWith('90d', {
      cityId: 'karlsruhe-id',
      categoryKey: 'plumbing',
      subcategoryKey: 'wc_repair',
    });
    expect(requestModelMock.countDocuments).toHaveBeenCalledWith(expect.objectContaining({
      serviceKey: 'wc_repair',
    }));
  });

  it('softens decision and funnel outputs when viewer-specific counts fall back to legacy personalized data', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 80,
        totalActiveProviders: 14,
      },
      cityActivity: { items: [] },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '7d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [{ timestamp: '2026-03-09T00:00:00.000Z', requests: 4, offers: 2 }],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([]);

    requestModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });
    requestModelMock.countDocuments
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(12);

    offerModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 6, confirmedResponsesTotal: 3 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 9, confirmedResponsesTotal: 7 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

    contractModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 2, cancelledJobs: 1, gmvAmount: 400 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: null, closedContractsTotal: 3, completedJobsTotal: 2, profitAmount: 400 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: null, closedContractsTotal: 5, completedJobsTotal: 3, profitAmount: 900 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    workspaceMock.getPrivateOverview.mockResolvedValue({
      requestsByStatus: { total: 5 },
      providerOffersByStatus: { sent: 6, accepted: 3 },
      providerContractsByStatus: { completed: 2 },
      clientContractsByStatus: { completed: 1 },
      profiles: { providerCompleteness: 72, clientCompleteness: 64 },
      kpis: { acceptanceRate: 44, avgResponseMinutes: 18, myOpenRequests: 3, recentOffers7d: 2 },
    });

    const result = await service.getStatisticsOverview({ range: '7d', viewerMode: 'provider' }, 'user-1', 'provider');

    expect(result.viewerMode).toBe('provider');
    expect(result.decisionLayer?.primaryInsight).toBe('Vergleich basiert aktuell auf begrenzten viewer-spezifischen Daten.');
    expect(result.decisionLayer?.primaryAction).toBeNull();
    expect(result.decisionLayer?.metrics.every((metric) => metric.status === 'neutral')).toBe(true);
    expect(result.decisionLayer?.metrics.every((metric) => metric.signalCodes.length === 0)).toBe(true);
    expect(result.decisionLayer?.metrics.every((metric) => metric.primaryActionCode === null)).toBe(true);
    expect(result.funnelComparison?.summary).toBe('Noch zu wenig Daten für einen belastbaren Funnel-Vergleich.');
    expect(result.funnelComparison?.largestDropOffStage).toBeNull();
    expect(result.funnelComparison?.primaryAction).toBeNull();
    expect(result.personalizedPricing?.comparisonReliability).toBe('unavailable');
    expect(result.categoryFit?.hasReliableItems).toBe(false);
    expect(result.cityComparison?.hasReliableItems).toBe(false);
    expect(result.risks?.items).toEqual([]);
    expect(result.opportunities?.hasReliableItems).toBe(true);
    expect(result.nextSteps?.hasReliableItems).toBe(true);
  });

  it('computes category sharePercent from full period category set', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 90,
        totalActiveProviders: 14,
      },
      cityActivity: { items: [] },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '30d',
      interval: 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [{ timestamp: '2026-03-09T00:00:00.000Z', requests: 9, offers: 4 }],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([]);

    requestModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'c1', categoryName: 'Category 1' }, count: 10 },
          { _id: { categoryKey: 'c2', categoryName: 'Category 2' }, count: 10 },
          { _id: { categoryKey: 'c3', categoryName: 'Category 3' }, count: 10 },
          { _id: { categoryKey: 'c4', categoryName: 'Category 4' }, count: 10 },
          { _id: { categoryKey: 'c5', categoryName: 'Category 5' }, count: 10 },
          { _id: { categoryKey: 'c6', categoryName: 'Category 6' }, count: 10 },
          { _id: { categoryKey: 'c7', categoryName: 'Category 7' }, count: 10 },
          { _id: { categoryKey: 'c8', categoryName: 'Category 8' }, count: 10 },
          { _id: { categoryKey: 'c9', categoryName: 'Category 9' }, count: 10 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'c1', categoryName: 'Category 1' }, count: 10 },
          { _id: { categoryKey: 'c2', categoryName: 'Category 2' }, count: 10 },
          { _id: { categoryKey: 'c3', categoryName: 'Category 3' }, count: 10 },
          { _id: { categoryKey: 'c4', categoryName: 'Category 4' }, count: 10 },
          { _id: { categoryKey: 'c5', categoryName: 'Category 5' }, count: 10 },
          { _id: { categoryKey: 'c6', categoryName: 'Category 6' }, count: 10 },
          { _id: { categoryKey: 'c7', categoryName: 'Category 7' }, count: 10 },
          { _id: { categoryKey: 'c8', categoryName: 'Category 8' }, count: 10 },
          { _id: { categoryKey: 'c9', categoryName: 'Category 9' }, count: 10 },
        ]),
      })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });
    requestModelMock.countDocuments.mockResolvedValue(9);

    offerModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 4, confirmedResponsesTotal: 1 }]),
      });

    contractModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, closedContractsTotal: 1, completedJobsTotal: 0, profitAmount: 0 }]),
      });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await service.getStatisticsOverview('30d');

    expect(result.demand.categories).toHaveLength(9);
    expect(result.demand.categories[0].sharePercent).toBe(11);
    expect(result.demand.categories[8].sharePercent).toBe(11);
  });

  it('keeps 24h funnel visible with active platform requests even when window flow is zero', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 149,
        totalActiveProviders: 44,
      },
      cityActivity: {
        items: [
          { citySlug: 'berlin', cityName: 'Berlin', cityId: 'c-1', requestCount: 12, lat: 52.52, lng: 13.405 },
        ],
      },
    });

    analyticsMock.getPlatformActivity.mockResolvedValue({
      range: '24h',
      interval: 'hour',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data: [{ timestamp: '2026-03-10T09:00:00.000Z', requests: 2, offers: 0 }],
    });

    analyticsMock.getCitySearchCounts.mockResolvedValue([
      {
        cityId: 'c-1',
        cityName: 'Berlin',
        citySlug: 'berlin',
        requestSearchCount: 3,
        providerSearchCount: 9,
      },
    ]);

    requestModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 2 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 2 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, requestCount: 2, anbieterSuchenCount: 1 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });
    requestModelMock.countDocuments.mockResolvedValue(0);

    offerModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, auftragSuchenCount: 3 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: 'provider-1' }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

    contractModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 1, cancelledJobs: 0, gmvAmount: 300 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await service.getStatisticsOverview('24h');

    expect(result.profileFunnel.stage1).toBe(2);
    expect(result.profileFunnel.requestsTotal).toBe(2);
    expect(result.profileFunnel.stages[0]).toMatchObject({
      id: 'requests',
      value: 2,
      displayValue: '2',
      widthPercent: 100,
    });
    expect(result.profileFunnel.summaryText).toContain('2');
    expect(result.decisionContext.lowData?.isLowData).toBe(false);
    expect(workspaceMock.getPublicOverview).toHaveBeenCalledTimes(2);
    expect(analyticsMock.getPlatformActivity).toHaveBeenCalledTimes(1);
  });

  it('backfills sparse 24h market sections from 30d baseline', async () => {
    workspaceMock.getPublicOverview.mockResolvedValue({
      summary: {
        totalPublishedRequests: 120,
        totalActiveProviders: 25,
      },
      cityActivity: {
        items: [
          { citySlug: 'berlin', cityName: 'Berlin', cityId: 'c-1', requestCount: 9, lat: 52.52, lng: 13.405 },
        ],
      },
    });

    analyticsMock.getPlatformActivity.mockImplementation(async (range: '24h' | '7d' | '30d' | '90d') => ({
      range,
      interval: range === '24h' ? 'hour' : 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data:
        range === '24h'
          ? [{ timestamp: '2026-03-10T09:00:00.000Z', requests: 2, offers: 0 }]
          : [{ timestamp: '2026-03-10T00:00:00.000Z', requests: 12, offers: 8 }],
    }));

    analyticsMock.getCitySearchCounts.mockImplementation(async (range: '24h' | '7d' | '30d' | '90d') => {
      if (range === '24h') return [];
      return [
        {
          cityId: 'c-1',
          cityName: 'Berlin',
          citySlug: 'berlin',
          requestSearchCount: 6,
          providerSearchCount: 10,
        },
      ];
    });

    requestModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 12 },
        ]),
      })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, requestCount: 2, anbieterSuchenCount: 0 },
        ]),
      })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 12 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'cleaning', categoryName: 'Cleaning' }, count: 12 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, requestCount: 12, anbieterSuchenCount: 3 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-03-09T08:00:00.000Z'),
            firstOfferAt: new Date('2026-03-09T08:30:00.000Z'),
            responseMinutes: 30,
          },
        ]),
      });

    requestModelMock.countDocuments
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(20);

    offerModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 1, confirmedResponsesTotal: 0 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, auftragSuchenCount: 6 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: 'provider-1' }, { _id: 'provider-2' }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { cityId: 'c-1', cityName: 'Berlin' }, providersActive: 2 },
        ]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, offersTotal: 8, confirmedResponsesTotal: 4 }]),
      });

    contractModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 0, cancelledJobs: 0, gmvAmount: 0 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, closedContractsTotal: 0, completedJobsTotal: 0, profitAmount: 0 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 4, cancelledJobs: 1, gmvAmount: 900 }]),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ _id: null, closedContractsTotal: 5, completedJobsTotal: 4, profitAmount: 900 }]),
      });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ total: 22, average: 4.6 }]),
    });

    const result = await service.getStatisticsOverview('24h');

    expect(result.range).toBe('24h');
    expect(result.demand.categories[0]).toMatchObject({
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      requestCount: 12,
    });
    expect(result.demand.cities[0]).toMatchObject({
      cityName: 'Berlin',
      requestCount: 9,
      auftragSuchenCount: 6,
      anbieterSuchenCount: 10,
      marketBalanceRatio: 1.67,
      signal: 'high',
    });
    expect(result.opportunityRadar[0]).toMatchObject({
      city: 'Berlin',
      categoryKey: 'cleaning',
      category: 'Cleaning',
    });
    expect(result.priceIntelligence).toMatchObject({
      city: 'Berlin',
      categoryKey: 'cleaning',
      recommendedMin: 190,
      recommendedMax: 260,
      marketAverage: 225,
    });
    expect(result.filterOptions.categories).toEqual([{ value: 'cleaning', label: 'Cleaning' }]);
    expect(typeof result.priceIntelligence.profitPotentialScore).toBe('number');
    expect((result.priceIntelligence.profitPotentialScore ?? 0)).toBeGreaterThan(0);
    expect(result.priceIntelligence.profitPotentialStatus).toBeDefined();
    expect(result.decisionContext.mode).toBe('global');
    expect(workspaceMock.getPublicOverview).toHaveBeenCalledTimes(3);
    expect(analyticsMock.getPlatformActivity).toHaveBeenNthCalledWith(1, '24h', {
      cityId: null,
      categoryKey: null,
      subcategoryKey: null,
    });
    expect(analyticsMock.getPlatformActivity).toHaveBeenNthCalledWith(2, '30d', {
      cityId: null,
      categoryKey: null,
      subcategoryKey: null,
    });
  });

  it('keeps selected focus labels and options stable for low-data 24h filters', async () => {
    workspaceMock.getPublicOverview.mockImplementation(async (query?: { activityRange?: '24h' | '7d' | '30d' | '90d' }) => {
      if (query?.activityRange === '30d') {
        return {
          summary: {
            totalPublishedRequests: 120,
            totalActiveProviders: 25,
          },
          cityActivity: {
            items: [
              { citySlug: 'berlin', cityName: 'Berlin', cityId: 'c-1', requestCount: 9, lat: 52.52, lng: 13.405 },
              { citySlug: 'karlsruhe', cityName: 'Karlsruhe', cityId: 'c-2', requestCount: 5, lat: 49.0069, lng: 8.4037 },
            ],
          },
        };
      }

      return {
        summary: {
          totalPublishedRequests: 4,
          totalActiveProviders: 12,
        },
        cityActivity: {
          items: [
            { citySlug: 'berlin', cityName: 'Berlin', cityId: 'c-1', requestCount: 4, lat: 52.52, lng: 13.405 },
          ],
        },
      };
    });

    analyticsMock.getPlatformActivity.mockImplementation(async (range: '24h' | '7d' | '30d' | '90d') => ({
      range,
      interval: range === '24h' ? 'hour' : 'day',
      source: 'real',
      updatedAt: '2026-03-10T10:00:00.000Z',
      data:
        range === '24h'
          ? [{ timestamp: '2026-03-10T09:00:00.000Z', requests: 1, offers: 0 }]
          : [{ timestamp: '2026-03-10T00:00:00.000Z', requests: 6, offers: 2 }],
    }));

    analyticsMock.getCitySearchCounts.mockResolvedValue([]);

    requestModelMock.aggregate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'moving', categoryName: 'Moving' }, count: 6 },
        ]),
      })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: { categoryKey: 'moving', categoryName: 'Moving' }, count: 6 },
        ]),
      })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

    requestModelMock.countDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(6);

    offerModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

    contractModelMock.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 0, cancelledJobs: 0, gmvAmount: 0 }]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, closedContractsTotal: 0, completedJobsTotal: 0, profitAmount: 0 }]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, completedJobs: 1, cancelledJobs: 0, gmvAmount: 450 }]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: null, closedContractsTotal: 1, completedJobsTotal: 1, profitAmount: 450 }]) });

    reviewModelMock.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await service.getStatisticsOverview({
      range: '24h',
      cityId: 'c-2',
      categoryKey: 'moving',
    });

    expect(result.decisionContext.lowData?.isLowData).toBe(true);
    expect(result.decisionContext.city).toEqual({
      value: 'c-2',
      label: 'Karlsruhe',
    });
    expect(result.decisionContext.category).toEqual({
      value: 'moving',
      label: 'Moving',
    });
    expect(result.filterOptions.cities).toEqual(
      expect.arrayContaining([{ value: 'c-2', label: 'Karlsruhe' }]),
    );
    expect(result.filterOptions.categories).toEqual(
      expect.arrayContaining([{ value: 'moving', label: 'Moving' }]),
    );
  });
});
