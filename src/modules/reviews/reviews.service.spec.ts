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
    find: jest.fn(),
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

  it('listByTarget returns items ordered by createdAt desc', async () => {
    reviewModelMock.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([{ _id: 'r1' }]),
          }),
        }),
      }),
    });

    const res = await service.listByTarget('u1', 'client', 10, 0);
    expect(res).toEqual([{ _id: 'r1' }]);
    expect(reviewModelMock.find).toHaveBeenCalledWith({ targetUserId: 'u1', targetRole: 'client' });
  });
});
