// src/modules/requests/requests.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RequestsService } from './requests.service';
import { Request } from './schemas/request.schema';

describe('RequestsService', () => {
  let service: RequestsService;

  const modelMock = {
    create: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: getModelToken(Request.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(RequestsService);
  });

  it('createPublic normalizes serviceKey and creates published request', async () => {
    modelMock.create.mockResolvedValue({ _id: 'r1', serviceKey: 'home_cleaning', status: 'published' });

    const res: any = await service.createPublic({
      serviceKey: ' Home_Cleaning ',
      cityId: ' c1 ',
      propertyType: 'apartment',
      area: 55,
      preferredDate: '2026-02-01T10:00:00.000Z',
      isRecurring: false,
      comment: '  hi  ',
    } as any);

    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: null,
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        status: 'published',
        comment: 'hi',
      }),
    );
    expect(res.status).toBe('published');
  });

  it('createPublic sets clientId when provided', async () => {
    modelMock.create.mockResolvedValue({ _id: 'r2', clientId: 'u1', status: 'published' });

    await service.createPublic(
      {
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-02-01T10:00:00.000Z',
        isRecurring: false,
      } as any,
      'u1',
    );

    expect(modelMock.create).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'u1' }));
  });

  it('listPublic always filters by status=published', async () => {
    modelMock.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    });

    await service.listPublic({});
    expect(modelMock.find).toHaveBeenCalledWith({ status: 'published' });
  });

  it('listPublic adds cityId and serviceKey only when non-empty', async () => {
    const sort = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    modelMock.find.mockReturnValue({ sort });

    await service.listPublic({ cityId: '  ', serviceKey: ' ' });
    expect(modelMock.find).toHaveBeenCalledWith({ status: 'published' });

    await service.listPublic({ cityId: 'c1', serviceKey: ' Home_Cleaning ' });
    expect(modelMock.find).toHaveBeenLastCalledWith({
      status: 'published',
      cityId: 'c1',
      serviceKey: 'home_cleaning',
    });
  });

  it('listMyClient filters by clientId, status, and createdAt range', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    modelMock.find.mockReturnValue({ sort });

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-02-01T00:00:00.000Z');

    await service.listMyClient('u1', { status: 'published', from, to, limit: 10, offset: 5 });

    expect(modelMock.find).toHaveBeenCalledWith({
      clientId: 'u1',
      status: 'published',
      createdAt: { $gte: from, $lt: to },
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skip).toHaveBeenCalledWith(5);
    expect(limit).toHaveBeenCalledWith(10);
  });
});
