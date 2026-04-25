import { Test } from '@nestjs/testing';

import { WorkspaceRequestsService } from './workspace-requests.service';
import { WorkspaceRequestSnapshotsService } from './workspace-request-snapshots.service';
import { WorkspaceRequestsPresenter } from './workspace-requests.presenter';

describe('WorkspaceRequestsService (unit)', () => {
  let service: WorkspaceRequestsService;

  const snapshotsMock = {
    loadWorkspaceRequestSnapshots: jest.fn(),
  };

  const presenterMock = {
    buildWorkspaceSummary: jest.fn(),
    buildWorkspaceDecisionPanel: jest.fn(),
    buildWorkspaceSidePanel: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceRequestsService,
        { provide: WorkspaceRequestSnapshotsService, useValue: snapshotsMock },
        { provide: WorkspaceRequestsPresenter, useValue: presenterMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceRequestsService);
    presenterMock.buildWorkspaceSummary.mockReturnValue([{ key: 'all', label: 'Alle', value: 2, isHighlighted: true }]);
    presenterMock.buildWorkspaceDecisionPanel.mockReturnValue({
      summary: {
        totalNeedsAction: 1,
        highPriorityCount: 0,
        newOffersCount: 1,
        replyRequiredCount: 0,
        confirmCompletionCount: 0,
        overdueCount: 0,
      },
      primaryAction: { label: 'Jetzt handeln', mode: 'decision', targetFilter: 'needs_action' },
      queue: [],
      overview: { highUrgency: 0, inProgress: 1, completedThisPeriod: 0 },
    });
    presenterMock.buildWorkspaceSidePanel.mockReturnValue({
      focus: { title: 'Aktueller Fokus', description: 'Focus item' },
      recommendation: { title: 'KI-Empfehlung', description: 'Recommendation' },
      contextItems: [],
      nextSteps: [],
    });
  });

  it('getRequestsOverview assembles cards and delegates summary, decision, and side-panel rendering', async () => {
    const now = new Date('2026-04-07T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    snapshotsMock.loadWorkspaceRequestSnapshots.mockResolvedValue({
      requests: [
        {
          id: 'request-customer-1',
          title: 'Logo design for boutique',
          description: 'Need a new logo package',
          serviceKey: 'logo_design',
          cityId: 'berlin',
          cityName: 'Berlin',
          categoryKey: 'design',
          categoryName: 'Design',
          subcategoryName: 'Logo',
          price: 400,
          preferredDate: new Date('2026-04-12T09:00:00.000Z'),
          status: 'published',
          createdAt: new Date('2026-04-05T08:00:00.000Z'),
          isRecurring: false,
          imageUrl: null,
          tags: [],
        },
      ],
      customerOffersByRequest: new Map([
        ['request-customer-1', [
          {
            id: 'offer-client-1',
            requestId: 'request-customer-1',
            providerUserId: 'provider-2',
            clientUserId: 'user-1',
            status: 'sent',
            message: 'I can help',
            amount: 450,
            priceType: 'fixed',
            availableAt: new Date('2026-04-13T10:00:00.000Z'),
            availabilityNote: 'Next week',
            createdAt: new Date('2026-04-06T08:30:00.000Z'),
            updatedAt: new Date('2026-04-06T09:00:00.000Z'),
          },
        ]],
      ]),
      providerOfferByRequest: new Map([
        ['request-provider-1', {
          id: 'offer-provider-1',
          requestId: 'request-provider-1',
          providerUserId: 'user-1',
          clientUserId: 'client-9',
          status: 'accepted',
          message: 'Available on Thursday',
          amount: 900,
          priceType: 'fixed',
          availableAt: new Date('2026-04-09T10:00:00.000Z'),
          availabilityNote: 'Can start immediately',
          createdAt: new Date('2026-04-06T11:00:00.000Z'),
          updatedAt: new Date('2026-04-06T11:30:00.000Z'),
          requestTitle: 'Wedding photography',
          requestDescription: 'Looking for a full-day shoot',
          requestServiceKey: 'wedding_photography',
          requestCityId: 'hamburg',
          requestCityName: 'Hamburg',
          requestCategoryKey: 'photo',
          requestCategoryName: 'Photography',
          requestSubcategoryName: 'Wedding',
          requestPreferredDate: new Date('2026-04-20T10:00:00.000Z'),
          requestStatus: 'matched',
          requestPrice: 850,
          requestCreatedAt: new Date('2026-04-04T09:00:00.000Z'),
          requestIsRecurring: false,
          requestImageUrl: null,
          requestTags: [],
        }],
      ]),
      providerContractByRequest: new Map([
        ['request-provider-1', {
          id: 'contract-provider-1',
          requestId: 'request-provider-1',
          offerId: 'offer-provider-1',
          clientId: 'client-9',
          providerUserId: 'user-1',
          status: 'confirmed',
          priceAmount: 900,
          priceType: null,
          priceDetails: null,
          confirmedAt: new Date('2026-04-08T09:00:00.000Z'),
          completedAt: null,
          cancelledAt: null,
          cancelReason: null,
          createdAt: new Date('2026-04-06T12:00:00.000Z'),
          updatedAt: new Date('2026-04-06T13:00:00.000Z'),
        }],
      ]),
      clientContractByRequest: new Map(),
      clientBookingByContractId: new Map(),
      clientReviewByBookingId: new Map(),
    });

    const result = await service.getRequestsOverview(
      'user-1',
      'provider',
      {
        scope: 'my',
        role: 'all',
        state: 'all',
        period: '30d',
        sort: 'activity',
      },
      'de-DE',
    );

    expect(snapshotsMock.loadWorkspaceRequestSnapshots).toHaveBeenCalledWith('user-1');
    expect(presenterMock.buildWorkspaceDecisionPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'de',
        cards: expect.arrayContaining([
          expect.objectContaining({ role: 'customer' }),
          expect.objectContaining({ role: 'provider' }),
        ]),
      }),
    );
    expect(presenterMock.buildWorkspaceSummary).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'de', activeState: 'all' }),
    );
    expect(presenterMock.buildWorkspaceSidePanel).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'de', role: 'all' }),
    );
    expect(result.section).toBe('requests');
    expect(result.scope).toBe('my');
    expect(result.header.title).toBe('Meine Vorgänge');
    expect(result.summary.items).toEqual([{ key: 'all', label: 'Alle', value: 2, isHighlighted: true }]);
    expect(result.list.items).toHaveLength(2);
    expect(result.list.items[0]).toEqual(
      expect.objectContaining({
        requestId: 'request-customer-1',
        role: 'customer',
        ownerLifecycleStage: 'offers_received',
      }),
    );
    expect(result.list.items[1]).toEqual(
      expect.objectContaining({
        requestId: 'request-provider-1',
        role: 'provider',
        state: 'active',
      }),
    );
    expect(result.decisionPanel).toEqual(
      expect.objectContaining({
        primaryAction: { label: 'Jetzt handeln', mode: 'decision', targetFilter: 'needs_action' },
      }),
    );
    expect(result.sidePanel).toEqual(
      expect.objectContaining({
        focus: expect.objectContaining({ title: 'Aktueller Fokus' }),
      }),
    );

    jest.useRealTimers();
  });

  it('keeps provider items in period when the next work event is upcoming', async () => {
    const now = new Date('2026-04-07T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    snapshotsMock.loadWorkspaceRequestSnapshots.mockResolvedValue({
      requests: [],
      customerOffersByRequest: new Map(),
      providerOfferByRequest: new Map([
        ['request-provider-upcoming', {
          id: 'offer-provider-upcoming',
          requestId: 'request-provider-upcoming',
          providerUserId: 'user-1',
          clientUserId: 'client-1',
          status: 'accepted',
          message: 'Can start soon',
          amount: 350,
          priceType: 'fixed',
          availableAt: new Date('2026-04-18T10:00:00.000Z'),
          availabilityNote: null,
          createdAt: new Date('2026-02-01T09:00:00.000Z'),
          updatedAt: new Date('2026-02-01T09:00:00.000Z'),
          requestTitle: 'Deep cleaning',
          requestDescription: 'Apartment cleaning',
          requestServiceKey: 'cleaning',
          requestCityId: 'berlin',
          requestCityName: 'Berlin',
          requestCategoryKey: 'cleaning',
          requestCategoryName: 'Reinigung',
          requestSubcategoryName: 'Grundreinigung',
          requestPreferredDate: new Date('2026-04-20T10:00:00.000Z'),
          requestStatus: 'matched',
          requestPrice: 300,
          requestCreatedAt: new Date('2026-01-20T08:00:00.000Z'),
          requestIsRecurring: false,
          requestImageUrl: null,
          requestTags: [],
        }],
      ]),
      providerContractByRequest: new Map(),
      clientContractByRequest: new Map(),
      clientBookingByContractId: new Map(),
      clientReviewByBookingId: new Map(),
    });

    const result = await service.getRequestsOverview(
      'user-1',
      'provider',
      {
        scope: 'my',
        role: 'provider',
        state: 'all',
        period: '30d',
        sort: 'activity',
      },
      'de-DE',
    );

    expect(result.list.items).toHaveLength(1);
    expect(result.list.items[0]).toEqual(
      expect.objectContaining({
        requestId: 'request-provider-upcoming',
        role: 'provider',
        decision: expect.objectContaining({
          needsAction: true,
          actionType: 'confirm_contract',
        }),
      }),
    );
    expect(presenterMock.buildWorkspaceDecisionPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        cards: [expect.objectContaining({ item: expect.objectContaining({ requestId: 'request-provider-upcoming' }) })],
      }),
    );

    jest.useRealTimers();
  });
});
