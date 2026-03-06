// src/modules/reviews/reviews.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReviewsService } from './reviews.service';
import { Review } from './schemas/review.schema';
import { Booking } from '../bookings/schemas/booking.schema';
import { ClientProfilesService } from '../users/client-profiles.service';
import { ProvidersService } from '../providers/providers.service';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const reviewModelMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    aggregate: jest.fn(),
  };

  const bookingModelMock = {
    findById: jest.fn(),
  };

  const clientProfilesMock = {
    applyRating: jest.fn(),
  };

  const providersMock = {
    applyRating: jest.fn(),
  };

  const execWrap = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getModelToken(Review.name), useValue: reviewModelMock },
        { provide: getModelToken(Booking.name), useValue: bookingModelMock },
        { provide: ClientProfilesService, useValue: clientProfilesMock },
        { provide: ProvidersService, useValue: providersMock },
      ],
    }).compile();

    service = moduleRef.get(ReviewsService);
  });

  it('createForProvider creates review and updates client rating', async () => {
    bookingModelMock.findById.mockReturnValue(
      execWrap({
        _id: '507f1f77bcf86cd799439011',
        providerUserId: 'p1',
        clientId: 'c1',
        requestId: 'r1',
        status: 'completed',
      }),
    );
    reviewModelMock.findOne.mockReturnValue(execWrap(null));
    reviewModelMock.create.mockResolvedValue({
      _id: 'rev1',
      bookingId: '507f1f77bcf86cd799439011',
      targetRole: 'client',
      rating: 5,
      text: 'ok',
      createdAt: new Date(),
    });
    reviewModelMock.findById.mockReturnValue(
      execWrap({
        _id: 'rev1',
        bookingId: '507f1f77bcf86cd799439011',
        targetRole: 'client',
        rating: 5,
        text: 'ok',
        createdAt: new Date(),
      }),
    );

    const res: any = await service.createForProvider('p1', {
      bookingId: '507f1f77bcf86cd799439011',
      rating: 5,
      text: 'ok',
    });

    expect(reviewModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authorUserId: 'p1',
        targetUserId: 'c1',
        targetRole: 'client',
        rating: 5,
      }),
    );
    expect(clientProfilesMock.applyRating).toHaveBeenCalledWith('c1', 5);
    expect(res._id).toBe('rev1');
  });

  it('createForClient creates review and updates provider rating', async () => {
    bookingModelMock.findById.mockReturnValue(
      execWrap({
        _id: '507f1f77bcf86cd799439012',
        providerUserId: 'p2',
        clientId: 'c2',
        requestId: 'r2',
        status: 'completed',
      }),
    );
    reviewModelMock.findOne.mockReturnValue(execWrap(null));
    reviewModelMock.create.mockResolvedValue({
      _id: 'rev2',
      bookingId: '507f1f77bcf86cd799439012',
      targetRole: 'provider',
      rating: 4,
      text: 'ok',
      createdAt: new Date(),
    });
    reviewModelMock.findById.mockReturnValue(
      execWrap({
        _id: 'rev2',
        bookingId: '507f1f77bcf86cd799439012',
        targetRole: 'provider',
        rating: 4,
        text: 'ok',
        createdAt: new Date(),
      }),
    );

    const res: any = await service.createForClient('c2', {
      bookingId: '507f1f77bcf86cd799439012',
      rating: 4,
      text: 'ok',
    });

    expect(reviewModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authorUserId: 'c2',
        targetUserId: 'p2',
        targetRole: 'provider',
        rating: 4,
      }),
    );
    expect(providersMock.applyRating).toHaveBeenCalledWith('p2', 4);
    expect(res._id).toBe('rev2');
  });

  it('getOverviewByTarget returns paged items + summary', async () => {
    reviewModelMock.aggregate.mockReturnValue(
      execWrap([
        {
          items: [{ _id: 'r1', rating: 5, targetRole: 'provider', authorUserId: 'u9' }],
          totalCount: [{ value: 9 }],
          summaryStats: [{ total: 9, averageRating: 4.4444, d1: 0, d2: 1, d3: 1, d4: 2, d5: 5 }],
        },
      ]),
    );

    const res = await service.getOverviewByTarget('u1', 'provider', 4, 0, 'created_desc');

    expect(reviewModelMock.aggregate).toHaveBeenCalled();
    expect(res.total).toBe(9);
    expect(res.limit).toBe(4);
    expect(res.offset).toBe(0);
    expect(res.items).toHaveLength(1);
    expect(res.summary).toEqual({
      total: 9,
      averageRating: 4.4,
      distribution: {
        '1': 0,
        '2': 1,
        '3': 1,
        '4': 2,
        '5': 5,
      },
    });
  });

  it('getOverviewByTarget returns defaults when facets are empty', async () => {
    reviewModelMock.aggregate.mockReturnValue(execWrap([]));

    const res = await service.getOverviewByTarget('u1', 'provider', 4, 0, 'created_desc');

    expect(res).toEqual({
      items: [],
      total: 0,
      limit: 4,
      offset: 0,
      summary: {
        total: 0,
        averageRating: 0,
        distribution: {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
          '5': 0,
        },
      },
    });
  });

  it('createPlatformReview stores anonymous review when no actor is provided', async () => {
    reviewModelMock.create.mockResolvedValue({
      _id: 'rev-platform-1',
      targetRole: 'platform',
      rating: 5,
      text: 'Great platform',
      authorName: 'Anonymous',
      createdAt: new Date(),
    });
    reviewModelMock.findById.mockReturnValue(
      execWrap({
        _id: 'rev-platform-1',
        targetRole: 'platform',
        rating: 5,
        text: 'Great platform',
        authorName: 'Anonymous',
        createdAt: new Date(),
      }),
    );

    const res: any = await service.createPlatformReview({ rating: 5, text: 'Great platform' });

    expect(reviewModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authorUserId: null,
        targetRole: 'platform',
        rating: 5,
        authorName: 'Anonymous',
      }),
    );
    expect(res._id).toBe('rev-platform-1');
  });

  it('getPlatformOverview queries platform-targeted reviews', async () => {
    reviewModelMock.aggregate.mockReturnValue(
      execWrap([
        {
          items: [{ _id: 'rp1', rating: 4, targetRole: 'platform', authorUserId: null, authorName: 'Anonymous' }],
          totalCount: [{ value: 1 }],
          summaryStats: [{ total: 1, averageRating: 4, d1: 0, d2: 0, d3: 0, d4: 1, d5: 0 }],
        },
      ]),
    );

    const res = await service.getPlatformOverview(4, 0, 'created_desc');

    expect(reviewModelMock.aggregate).toHaveBeenCalled();
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.summary.averageRating).toBe(4);
  });
});
