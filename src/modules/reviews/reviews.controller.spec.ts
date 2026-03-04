// src/modules/reviews/reviews.controller.spec.ts
import { Test } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

describe('ReviewsController (unit)', () => {
  let controller: ReviewsController;

  const svcMock = {
    createForProvider: jest.fn(),
    createForClient: jest.fn(),
    listByTarget: jest.fn(),
    listMyReceived: jest.fn(),
    getSummaryByTarget: jest.fn(),
    getOverviewByTarget: jest.fn(),
  };

  const usersMock = {
    findPublicByIds: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: svcMock },
        { provide: UsersService, useValue: usersMock },
      ],
    }).compile();

    controller = moduleRef.get(ReviewsController);
  });

  it('provider can create client review', async () => {
    svcMock.createForProvider.mockResolvedValue({
      _id: { toString: () => 'r1' },
      bookingId: 'b1',
      authorUserId: 'p1',
      targetUserId: 'c1',
      targetRole: 'client',
      rating: 5,
      text: 'ok',
      createdAt: new Date(),
    });

    const res = await controller.createClientReview(
      { userId: 'p1', role: 'provider' } as any,
      { bookingId: 'b1', rating: 5, text: 'ok' } as any,
    );

    expect(svcMock.createForProvider).toHaveBeenCalledWith('p1', { bookingId: 'b1', rating: 5, text: 'ok' });
    expect(res).toEqual(expect.objectContaining({ id: 'r1', targetRole: 'client', rating: 5 }));
  });

  it('client can create provider review', async () => {
    svcMock.createForClient.mockResolvedValue({
      _id: { toString: () => 'r2' },
      bookingId: 'b2',
      authorUserId: 'c1',
      targetUserId: 'p1',
      targetRole: 'provider',
      rating: 4,
      text: null,
      createdAt: new Date(),
    });

    const res = await controller.createProviderReview(
      { userId: 'c1', role: 'client' } as any,
      { bookingId: 'b2', rating: 4 } as any,
    );

    expect(svcMock.createForClient).toHaveBeenCalledWith('c1', { bookingId: 'b2', rating: 4 });
    expect(res).toEqual(expect.objectContaining({ id: 'r2', targetRole: 'provider', rating: 4 }));
  });

  it('forbids wrong role', async () => {
    await expect(
      controller.createClientReview({ userId: 'c1', role: 'client' } as any, { bookingId: 'b1', rating: 5 } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listByTarget maps items', async () => {
    usersMock.findPublicByIds.mockResolvedValue([
      { _id: 'p1', name: 'Anna', avatar: { url: '/avatars/a.png' } },
    ]);
    svcMock.listByTarget.mockResolvedValue([
      {
        _id: { toString: () => 'r3' },
        bookingId: 'b3',
        authorUserId: 'p1',
        targetUserId: 'c1',
        targetRole: 'client',
        rating: 5,
        text: 'ok',
        createdAt: new Date(),
      },
    ]);

    const res = await controller.listByTarget({
      targetUserId: 'c1',
      targetRole: 'client',
      limit: 10,
      offset: 0,
      sort: 'created_desc',
    } as any);

    expect(svcMock.listByTarget).toHaveBeenCalledWith('c1', 'client', 10, 0, 'created_desc');
    expect(res[0]).toEqual(expect.objectContaining({
      id: 'r3',
      targetRole: 'client',
      rating: 5,
      authorName: 'Anna',
      authorAvatarUrl: '/avatars/a.png',
    }));
  });

  it('summaryByTarget maps summary payload', async () => {
    svcMock.getSummaryByTarget.mockResolvedValue({
      total: 7,
      averageRating: 4.3,
      distribution: {
        '1': 0,
        '2': 1,
        '3': 1,
        '4': 2,
        '5': 3,
      },
    });

    const res = await controller.summaryByTarget({
      targetUserId: 'p1',
      targetRole: 'provider',
    } as any);

    expect(svcMock.getSummaryByTarget).toHaveBeenCalledWith('p1', 'provider');
    expect(res).toEqual({
      targetUserId: 'p1',
      targetRole: 'provider',
      total: 7,
      averageRating: 4.3,
      distribution: {
        '1': 0,
        '2': 1,
        '3': 1,
        '4': 2,
        '5': 3,
      },
    });
  });

  it('overviewByTarget maps page + summary payload', async () => {
    usersMock.findPublicByIds.mockResolvedValue([
      { _id: 'p1', name: 'Anna', avatar: { url: '/avatars/a.png' } },
    ]);
    svcMock.getOverviewByTarget.mockResolvedValue({
      items: [
        {
          _id: { toString: () => 'r10' },
          targetRole: 'provider',
          rating: 5,
          text: 'great',
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
          authorUserId: 'p1',
        },
      ],
      total: 11,
      limit: 4,
      offset: 0,
      summary: {
        total: 11,
        averageRating: 4.5,
        distribution: {
          '1': 0,
          '2': 1,
          '3': 1,
          '4': 2,
          '5': 7,
        },
      },
    });

    const res = await controller.overviewByTarget({
      targetUserId: 'provider-1',
      targetRole: 'provider',
      limit: 4,
      offset: 0,
      sort: 'created_desc',
    } as any);

    expect(svcMock.getOverviewByTarget).toHaveBeenCalledWith('provider-1', 'provider', 4, 0, 'created_desc');
    expect(res.total).toBe(11);
    expect(res.summary.averageRating).toBe(4.5);
    expect(res.items[0]).toEqual(
      expect.objectContaining({
        id: 'r10',
        authorName: 'Anna',
        authorAvatarUrl: '/avatars/a.png',
      }),
    );
  });
});
