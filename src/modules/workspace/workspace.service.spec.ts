import { Test } from '@nestjs/testing';

import { WorkspaceService } from './workspace.service';
import { WorkspaceRequestsService } from './workspace-requests.service';
import { WorkspacePublicOverviewService } from './workspace-public-overview.service';
import { WorkspacePrivateOverviewService } from './workspace-private-overview.service';

describe('WorkspaceService (unit)', () => {
  let service: WorkspaceService;

  const requestsMock = {
    getRequestsOverview: jest.fn(),
  };

  const publicOverviewMock = {
    getPublicOverview: jest.fn(),
    getPublicRequestsBatch: jest.fn(),
  };

  const privateOverviewMock = {
    getPrivateOverview: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: WorkspaceRequestsService, useValue: requestsMock },
        { provide: WorkspacePublicOverviewService, useValue: publicOverviewMock },
        { provide: WorkspacePrivateOverviewService, useValue: privateOverviewMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceService);
  });

  it('delegates public overview to WorkspacePublicOverviewService', async () => {
    const expected = { updatedAt: '2030-01-01T00:00:00.000Z' };
    publicOverviewMock.getPublicOverview.mockResolvedValue(expected);

    const query = { page: 1, limit: 20 };
    const result = await service.getPublicOverview(query as any);

    expect(publicOverviewMock.getPublicOverview).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('delegates public requests batch to WorkspacePublicOverviewService', async () => {
    const expected = { items: [], missingIds: ['x'] };
    publicOverviewMock.getPublicRequestsBatch.mockResolvedValue(expected);

    const ids = ['x'];
    const result = await service.getPublicRequestsBatch(ids);

    expect(publicOverviewMock.getPublicRequestsBatch).toHaveBeenCalledWith(ids);
    expect(result).toBe(expected);
  });

  it('delegates private overview to WorkspacePrivateOverviewService', async () => {
    const expected = { updatedAt: '2030-01-01T00:00:00.000Z', preferredRole: 'customer' };
    privateOverviewMock.getPrivateOverview.mockResolvedValue(expected);

    const result = await service.getPrivateOverview('user-1', 'client', '30d');

    expect(privateOverviewMock.getPrivateOverview).toHaveBeenCalledWith('user-1', 'client', '30d');
    expect(result).toBe(expected);
  });

  it('delegates requests overview to WorkspaceRequestsService', async () => {
    const expected = { section: 'requests', scope: 'my' };
    requestsMock.getRequestsOverview.mockResolvedValue(expected);

    const query = { scope: 'my', role: 'all', state: 'all', period: '30d', sort: 'activity' };
    const result = await service.getRequestsOverview('user-1', 'provider', query as any, 'de-DE');

    expect(requestsMock.getRequestsOverview).toHaveBeenCalledWith('user-1', 'provider', query, 'de-DE');
    expect(result).toBe(expected);
  });
});
