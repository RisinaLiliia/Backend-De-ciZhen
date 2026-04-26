import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { WorkspacePrivateOverviewService } from './workspace-private-overview.service';
import { UsersService } from '../users/users.service';
import { Request } from '../requests/schemas/request.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';
import { Favorite } from '../favorites/schemas/favorite.schema';
import { Review } from '../reviews/schemas/review.schema';
import { ClientProfile } from '../users/schemas/client-profile.schema';

describe('WorkspacePrivateOverviewService (unit)', () => {
  let service: WorkspacePrivateOverviewService;

  const usersMock = {
    findById: jest.fn(),
  };

  const modelMock = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    findOne: jest.fn(),
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

  function selectLeanResult<T>(value: T) {
    return {
      select: jest.fn().mockReturnValue(leanResult(value)),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspacePrivateOverviewService,
        { provide: UsersService, useValue: usersMock },
        { provide: getModelToken(Request.name), useValue: modelMock },
        { provide: getModelToken(Offer.name), useValue: modelMock },
        { provide: getModelToken(Contract.name), useValue: modelMock },
        { provide: getModelToken(ProviderProfile.name), useValue: modelMock },
        { provide: getModelToken(Favorite.name), useValue: modelMock },
        { provide: getModelToken(Review.name), useValue: modelMock },
        { provide: getModelToken(ClientProfile.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspacePrivateOverviewService);
  });

  it('getPrivateOverview returns backend-owned preferredRole for customer-heavy activity', async () => {
    modelMock.aggregate
      .mockReturnValueOnce(execResult([{ _id: 'published', count: 4 }]))
      .mockReturnValueOnce(execResult([{ _id: 'sent', count: 1 }]))
      .mockReturnValueOnce(execResult([{ _id: 'accepted', count: 2 }]))
      .mockReturnValueOnce(execResult([{ _id: 'confirmed', count: 1 }]))
      .mockReturnValueOnce(execResult([{ _id: 'pending', count: 3 }]))
      .mockReturnValueOnce(execResult([{ _id: 'request', count: 2 }]))
      .mockReturnValueOnce(execResult([{ _id: 'client', count: 1 }]))
      .mockReturnValueOnce(execResult([{ _id: null, avgMs: 30 * 60 * 1000 }]));

    modelMock.findOne
      .mockReturnValueOnce(leanResult({ displayName: 'Provider profile' }))
      .mockReturnValueOnce(leanResult({ userId: 'user-1' }));
    usersMock.findById.mockResolvedValue({
      name: 'Taylor',
      email: 'taylor@test.local',
      city: 'Berlin',
      acceptedPrivacyPolicy: true,
    });

    modelMock.countDocuments
      .mockReturnValueOnce(execResult(2))
      .mockReturnValueOnce(execResult(1))
      .mockReturnValueOnce(execResult(5));

    modelMock.find
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([{ createdAt: new Date('2026-04-01T00:00:00.000Z') }]))
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([{ updatedAt: new Date('2026-04-06T01:00:00.000Z') }]))
      .mockReturnValueOnce(selectLeanResult([{ updatedAt: new Date('2026-04-06T02:00:00.000Z') }]))
      .mockReturnValueOnce(selectLeanResult([{ updatedAt: new Date('2026-04-06T03:00:00.000Z') }]))
      .mockReturnValueOnce(selectLeanResult([{ updatedAt: new Date('2026-04-06T04:00:00.000Z') }]));

    const result = await service.getPrivateOverview('user-1', 'client', '30d');

    expect(result.preferredRole).toBe('customer');
    expect(result.requestsByStatus.total).toBe(4);
    expect(result.clientOffersByStatus.total).toBe(2);
    expect(result.clientContractsByStatus.total).toBe(3);
    expect(result.ratingSummary).toEqual({ average: 0, count: 0 });
  });

  it('getPrivateOverview falls back to account role when customer and provider loads are tied', async () => {
    modelMock.aggregate
      .mockReturnValueOnce(execResult([{ _id: 'published', count: 1 }]))
      .mockReturnValueOnce(execResult([{ _id: 'sent', count: 1 }]))
      .mockReturnValueOnce(execResult([]))
      .mockReturnValueOnce(execResult([{ _id: 'confirmed', count: 1 }]))
      .mockReturnValueOnce(execResult([{ _id: 'pending', count: 1 }]))
      .mockReturnValueOnce(execResult([]))
      .mockReturnValueOnce(execResult([]))
      .mockReturnValueOnce(execResult([]));

    modelMock.findOne
      .mockReturnValueOnce(leanResult({ displayName: 'Provider profile' }))
      .mockReturnValueOnce(leanResult(null));
    usersMock.findById.mockResolvedValue({
      name: 'Sam',
      email: 'sam@test.local',
      city: 'Berlin',
      acceptedPrivacyPolicy: true,
    });

    modelMock.countDocuments
      .mockReturnValueOnce(execResult(0))
      .mockReturnValueOnce(execResult(0))
      .mockReturnValueOnce(execResult(0));

    modelMock.find
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([{ updatedAt: new Date('2026-04-06T01:00:00.000Z') }]))
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([{ updatedAt: new Date('2026-04-06T02:00:00.000Z') }]))
      .mockReturnValueOnce(selectLeanResult([]));

    const result = await service.getPrivateOverview('user-2', 'provider', '30d');

    expect(result.preferredRole).toBe('provider');
    expect(result.ratingSummary).toEqual({ average: 0, count: 0 });
    expect(result.requestsByStatus.total + result.clientOffersByStatus.total + result.clientContractsByStatus.total).toBe(
      result.providerOffersByStatus.total + result.providerContractsByStatus.total,
    );
  });

  it('getPrivateOverview resolves preferredRole inside the requested period only', async () => {
    modelMock.aggregate
      .mockReturnValueOnce(execResult([{ _id: 'published', count: 2 }]))
      .mockReturnValueOnce(execResult([{ _id: 'sent', count: 3 }]))
      .mockReturnValueOnce(execResult([]))
      .mockReturnValueOnce(execResult([]))
      .mockReturnValueOnce(execResult([]))
      .mockReturnValueOnce(execResult([]))
      .mockReturnValueOnce(execResult([]))
      .mockReturnValueOnce(execResult([]));

    modelMock.findOne
      .mockReturnValueOnce(leanResult({ displayName: 'Provider profile' }))
      .mockReturnValueOnce(leanResult(null));
    usersMock.findById.mockResolvedValue({
      name: 'Robin',
      email: 'robin@test.local',
      city: 'Berlin',
      acceptedPrivacyPolicy: true,
    });

    modelMock.countDocuments
      .mockReturnValueOnce(execResult(0))
      .mockReturnValueOnce(execResult(0))
      .mockReturnValueOnce(execResult(0));

    modelMock.find
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([
        { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        { createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000) },
      ]))
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([
        { updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        { updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        { updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      ]))
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([]))
      .mockReturnValueOnce(selectLeanResult([]));

    const result = await service.getPrivateOverview('user-3', 'client', '24h');

    expect(result.preferredRole).toBe('provider');
    expect(result.ratingSummary).toEqual({ average: 0, count: 0 });
  });
});
