// src/modules/reviews/reviews.controller.spec.ts
import { Test } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ForbiddenException } from '@nestjs/common';

describe('ReviewsController (unit)', () => {
  let controller: ReviewsController;

  const svcMock = {
    createForProvider: jest.fn(),
    createForClient: jest.fn(),
    listByTarget: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: svcMock }],
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

    const res = await controller.listByTarget({ targetUserId: 'c1', targetRole: 'client', limit: 10, offset: 0 } as any);

    expect(svcMock.listByTarget).toHaveBeenCalledWith('c1', 'client', 10, 0);
    expect(res[0]).toEqual(expect.objectContaining({ id: 'r3', targetRole: 'client', rating: 5 }));
  });
});
