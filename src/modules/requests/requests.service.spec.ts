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
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        status: 'published',
        comment: 'hi',
      }),
    );
    expect(res.status).toBe('published');
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
});
