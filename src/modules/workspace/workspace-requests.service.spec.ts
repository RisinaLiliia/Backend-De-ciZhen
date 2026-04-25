import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspaceRequestsService } from './workspace-requests.service';
import { Request } from '../requests/schemas/request.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import { Booking } from '../bookings/schemas/booking.schema';
import { Review } from '../reviews/schemas/review.schema';

describe('WorkspaceRequestsService (unit)', () => {
  let service: WorkspaceRequestsService;

  const modelMock = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
  };

  function execResult<T>(value: T) {
    return { exec: jest.fn().mockResolvedValue(value) };
  }

  function leanResult<T>(value: T) {
    return {
      lean: jest.fn().mockReturnValue(execResult(value)),
    };
  }

  function sortLeanResult<T>(value: T) {
    return {
      sort: jest.fn().mockReturnValue(leanResult(value)),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceRequestsService,
        { provide: getModelToken(Request.name), useValue: modelMock },
        { provide: getModelToken(Offer.name), useValue: modelMock },
        { provide: getModelToken(Contract.name), useValue: modelMock },
        { provide: getModelToken(Booking.name), useValue: modelMock },
        { provide: getModelToken(Review.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceRequestsService);
  });

  it('getRequestsOverview returns backend-owned workflow summary and cards', async () => {
    const now = new Date('2026-04-07T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    modelMock.find
      .mockReturnValueOnce(
        sortLeanResult([
          {
            _id: 'request-customer-1',
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
          },
        ]),
      )
      .mockReturnValueOnce(
        sortLeanResult([
          {
            _id: 'offer-client-1',
            requestId: 'request-customer-1',
            providerUserId: 'provider-2',
            clientUserId: 'user-1',
            status: 'sent',
            message: 'I can help',
            pricing: { amount: 450, type: 'fixed' },
            availability: { date: new Date('2026-04-13T10:00:00.000Z'), note: 'Next week' },
            createdAt: new Date('2026-04-06T08:30:00.000Z'),
            updatedAt: new Date('2026-04-06T09:00:00.000Z'),
          },
        ]),
      )
      .mockReturnValueOnce(
        sortLeanResult([
          {
            _id: 'contract-provider-1',
            requestId: 'request-provider-1',
            offerId: 'offer-provider-1',
            clientId: 'client-9',
            providerUserId: 'user-1',
            status: 'confirmed',
            priceAmount: 900,
            confirmedAt: new Date('2026-04-08T09:00:00.000Z'),
            createdAt: new Date('2026-04-06T12:00:00.000Z'),
            updatedAt: new Date('2026-04-06T13:00:00.000Z'),
          },
        ]),
      )
      .mockReturnValueOnce(sortLeanResult([]));

    modelMock.aggregate.mockReturnValueOnce(
      execResult([
        {
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
        },
      ]),
    );

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

    expect(result.section).toBe('requests');
    expect(result.scope).toBe('my');
    expect(result.header.title).toBe('Meine Vorgänge');
    expect(result.summary.items).toEqual([
      expect.objectContaining({ key: 'all', value: 2, isHighlighted: true }),
      expect.objectContaining({ key: 'attention', value: 1 }),
      expect.objectContaining({ key: 'execution', value: 1 }),
      expect.objectContaining({ key: 'completed', value: 0 }),
    ]);
    expect(modelMock.find).toHaveBeenNthCalledWith(1, { clientId: 'user-1', archivedAt: null });
    expect(result.list.items).toHaveLength(2);
    expect(result.list.items[0]).toEqual(
      expect.objectContaining({
        requestId: 'request-customer-1',
        role: 'customer',
        ownerLifecycleStage: 'offers_received',
        state: 'clarifying',
        stateLabel: 'In Klärung',
        progress: expect.objectContaining({ currentStep: 'selection' }),
        requestPreview: expect.objectContaining({
          href: '/requests/request-customer-1',
          categoryLabel: 'Design',
          title: 'Logo design for boutique',
        }),
        status: expect.objectContaining({
          badgeLabel: 'Offen',
          actions: expect.arrayContaining([
            expect.objectContaining({
              key: 'edit-request',
              kind: 'link',
              href: '/requests/request-customer-1/edit',
            }),
            expect.objectContaining({
              key: 'duplicate-request',
              kind: 'duplicate_request',
              requestId: 'request-customer-1',
            }),
            expect.objectContaining({
              key: 'share-request',
              kind: 'share_request',
              href: '/requests/request-customer-1',
            }),
            expect.objectContaining({
              key: 'archive-request',
              kind: 'archive_request',
              requestId: 'request-customer-1',
            }),
            expect.objectContaining({
              key: 'delete-request',
              kind: 'delete_request',
              requestId: 'request-customer-1',
            }),
          ]),
        }),
        decision: expect.objectContaining({
          needsAction: true,
          actionType: 'review_offers',
          actionPriorityLevel: 'medium',
          actionLabel: 'Angebote ansehen',
          primaryAction: expect.objectContaining({
            key: 'review-responses',
            kind: 'review_responses',
            href: '/requests/request-customer-1',
          }),
        }),
      }),
    );
    expect(result.list.items[1]).toEqual(
      expect.objectContaining({
        requestId: 'request-provider-1',
        role: 'provider',
        state: 'active',
        stateLabel: 'In Arbeit',
        progress: expect.objectContaining({ currentStep: 'contract' }),
        requestPreview: expect.objectContaining({
          href: '/requests/request-provider-1',
          categoryLabel: 'Photography',
          title: 'Wedding photography',
        }),
        status: expect.objectContaining({
          badgeLabel: 'Angenommen',
          actions: expect.arrayContaining([
            expect.objectContaining({
              key: 'chat',
              kind: 'open_chat',
              chatInput: expect.objectContaining({
                requestId: 'request-provider-1',
                offerId: 'offer-provider-1',
                participantUserId: 'user-1',
              }),
            }),
          ]),
        }),
        decision: expect.objectContaining({
          needsAction: false,
          actionType: 'none',
          primaryAction: null,
        }),
      }),
    );
    expect(result.decisionPanel).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalNeedsAction: 1,
          newOffersCount: 1,
          highPriorityCount: 0,
        }),
        primaryAction: {
          label: 'Jetzt handeln',
          mode: 'decision',
          targetFilter: 'needs_action',
        },
        queue: [
          expect.objectContaining({
            requestId: 'request-customer-1',
            actionType: 'review_offers',
            actionLabel: 'Angebote ansehen',
          }),
        ],
        overview: expect.objectContaining({
          inProgress: 1,
          completedThisPeriod: 0,
        }),
      }),
    );
    expect(result.sidePanel.focus).toEqual(
      expect.objectContaining({
        title: 'Aktueller Fokus',
      }),
    );

    jest.useRealTimers();
  });

  it('getRequestsOverview keeps provider items in period when the next work event is upcoming', async () => {
    const now = new Date('2026-04-07T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    modelMock.find
      .mockReturnValueOnce(sortLeanResult([]))
      .mockReturnValueOnce(sortLeanResult([]))
      .mockReturnValueOnce(sortLeanResult([]))
      .mockReturnValueOnce(sortLeanResult([]));

    modelMock.aggregate.mockReturnValueOnce(
      execResult([
        {
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
        },
      ]),
    );

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

    jest.useRealTimers();
  });
});
