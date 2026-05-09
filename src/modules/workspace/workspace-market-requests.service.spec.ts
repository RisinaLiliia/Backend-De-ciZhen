import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { Request } from '../requests/schemas/request.schema';
import { CatalogServicesService } from '../catalog/services/services.service';
import { WorkspaceMarketRequestsService } from './workspace-market-requests.service';
import { WorkspaceRequestsListPolicy } from './workspace-requests-list-policy';
import { WorkspaceRequestsPresenter } from './workspace-requests.presenter';

describe('WorkspaceMarketRequestsService (unit)', () => {
  let service: WorkspaceMarketRequestsService;

  const execMock = jest.fn();
  const countDocumentsMock = jest.fn(() => ({ exec: execMock }));
  const findExecMock = jest.fn();
  const limitMock = jest.fn(() => ({ exec: findExecMock }));
  const skipMock = jest.fn(() => ({ limit: limitMock }));
  const sortMock = jest.fn(() => ({ skip: skipMock, limit: limitMock }));
  const findMock = jest.fn(() => ({ sort: sortMock }));

  const requestModelMock = {
    countDocuments: countDocumentsMock,
    find: findMock,
  };

  const catalogServicesMock = {
    listServices: jest.fn(),
  };

  const listPolicyMock = {
    resolve: jest.fn(),
  };

  const presenterMock = {
    buildWorkspaceSummaryFromCounts: jest.fn(),
    buildWorkspaceMarketDecisionPanel: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceMarketRequestsService,
        { provide: getModelToken(Request.name), useValue: requestModelMock },
        { provide: CatalogServicesService, useValue: catalogServicesMock },
        { provide: WorkspaceRequestsListPolicy, useValue: listPolicyMock },
        { provide: WorkspaceRequestsPresenter, useValue: presenterMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceMarketRequestsService);
  });

  it('returns a complete market requests contract with summary, list, and decision panel', async () => {
    const publishedDoc = {
      id: 'request-1',
      status: 'published',
      cityId: 'berlin',
      cityName: 'Berlin',
      serviceKey: 'logo-design',
      categoryName: 'Design',
      subcategoryName: 'Logo Design',
      title: 'Need a logo refresh',
      description: 'Modernize the existing brand mark.',
      preferredDate: new Date('2026-04-12T10:00:00.000Z'),
      price: 180,
      createdAt: new Date('2026-04-10T09:00:00.000Z'),
      updatedAt: new Date('2026-04-10T11:00:00.000Z'),
      publishedAt: new Date('2026-04-10T09:00:00.000Z'),
      matchedAt: null,
      archivedAt: null,
    };

    execMock
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);
    execMock.mockResolvedValueOnce(1);

    findExecMock
      .mockResolvedValueOnce([publishedDoc])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([publishedDoc]);

    listPolicyMock.resolve.mockReturnValue({
      sortedCards: [{ item: { requestId: 'request-1', title: 'Need a logo refresh' } }],
    });

    presenterMock.buildWorkspaceSummaryFromCounts.mockReturnValue([
      { key: 'all', label: 'Alle', value: 10, isHighlighted: true },
      { key: 'attention', label: 'Aktiv', value: 7, isHighlighted: false },
      { key: 'execution', label: 'In Ausführung', value: 2, isHighlighted: false },
      { key: 'completed', label: 'Abgeschlossen', value: 1, isHighlighted: false },
    ]);
    presenterMock.buildWorkspaceMarketDecisionPanel.mockReturnValue({
      summary: {
        totalNeedsAction: 9,
        highPriorityCount: 2,
        newOffersCount: 4,
        replyRequiredCount: 0,
        confirmCompletionCount: 0,
        overdueCount: 3,
      },
      primaryAction: {
        label: 'Markt prüfen',
        mode: 'decision',
        targetFilter: 'needs_action',
      },
      queue: [],
      overview: {
        highUrgency: 7,
        inProgress: 2,
        completedThisPeriod: 1,
      },
    });

    const result = await service.getMarketOverview(
      {
        scope: 'market',
        state: 'all',
        period: '30d',
        sort: 'date_desc',
        page: 1,
        limit: 20,
      },
      'de-DE',
    );

    expect(result.scope).toBe('market');
    expect(result.summary).toEqual({
      items: [
        { key: 'all', label: 'Alle', value: 10, isHighlighted: true },
        { key: 'attention', label: 'Aktiv', value: 7, isHighlighted: false },
        { key: 'execution', label: 'In Ausführung', value: 2, isHighlighted: false },
        { key: 'completed', label: 'Abgeschlossen', value: 1, isHighlighted: false },
      ],
    });
    expect(result.list).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
      items: [{ requestId: 'request-1', title: 'Need a logo refresh' }],
    });
    expect(result.decisionPanel).toEqual({
      summary: {
        totalNeedsAction: 9,
        highPriorityCount: 2,
        newOffersCount: 4,
        replyRequiredCount: 0,
        confirmCompletionCount: 0,
        overdueCount: 3,
      },
      primaryAction: {
        label: 'Markt prüfen',
        mode: 'decision',
        targetFilter: 'needs_action',
      },
      queue: [],
      overview: {
        highUrgency: 7,
        inProgress: 2,
        completedThisPeriod: 1,
      },
    });
  });
});
