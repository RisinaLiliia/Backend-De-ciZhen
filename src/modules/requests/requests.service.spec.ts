// src/modules/requests/requests.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RequestsService } from './requests.service';
import { Request } from './schemas/request.schema';
import { CatalogServicesService } from '../catalog/services/services.service';

describe('RequestsService', () => {
  let service: RequestsService;

  const modelMock = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  };

  const catalogMock = {
    listServices: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: getModelToken(Request.name), useValue: modelMock },
        { provide: CatalogServicesService, useValue: catalogMock },
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
      price: 120,
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
      price: 120,
      preferredDate: '2026-02-01T10:00:00.000Z',
      isRecurring: false,
    } as any,
    'u1',
    );

    expect(modelMock.create).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'u1' }));
  });

  it('createForClient creates draft request for client', async () => {
    modelMock.create.mockResolvedValue({ _id: 'r3', clientId: 'u1', status: 'draft' });

    await service.createForClient({
      serviceKey: 'home_cleaning',
      cityId: ' c1 ',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: '2026-02-01T10:00:00.000Z',
      isRecurring: false,
      comment: '  hi  ',
    } as any, 'u1');

    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'u1',
        cityId: 'c1',
        serviceKey: 'home_cleaning',
        status: 'draft',
        comment: 'hi',
      }),
    );
  });

  it('listPublic always filters by status=published', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    modelMock.find.mockReturnValue({ sort });
    catalogMock.listServices.mockResolvedValue([]);

    await service.listPublic({});
    expect(modelMock.find).toHaveBeenCalledWith({ status: 'published' });
  });

  it('listPublic adds cityId and serviceKey only when non-empty', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    modelMock.find.mockReturnValue({ sort });
    catalogMock.listServices.mockResolvedValue([]);

    await service.listPublic({ cityId: '  ', serviceKey: ' ' });
    expect(modelMock.find).toHaveBeenCalledWith({ status: 'published' });

    await service.listPublic({ cityId: 'c1', serviceKey: ' Home_Cleaning ' });
    expect(modelMock.find).toHaveBeenLastCalledWith({
      status: 'published',
      cityId: 'c1',
      serviceKey: 'home_cleaning',
    });
  });

  it('listPublic applies pagination and sort', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    modelMock.find.mockReturnValue({ sort });
    catalogMock.listServices.mockResolvedValue([]);

    await service.listPublic({ sort: 'date_asc', limit: 10, offset: 5 });

    expect(sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(skip).toHaveBeenCalledWith(5);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('listPublic filters by categoryKey via services list', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    modelMock.find.mockReturnValue({ sort });
    catalogMock.listServices.mockResolvedValue([{ key: 'window_cleaning' }, { key: 'home_cleaning' }]);

    await service.listPublic({ categoryKey: 'cleaning' });

    expect(catalogMock.listServices).toHaveBeenCalledWith('cleaning');
    expect(modelMock.find).toHaveBeenCalledWith({
      status: 'published',
      serviceKey: { $in: ['window_cleaning', 'home_cleaning'] },
    });
  });

  it('listPublic returns empty when subcategory not in category', async () => {
    catalogMock.listServices.mockResolvedValue([{ key: 'window_cleaning' }]);

    const res = await service.listPublic({ categoryKey: 'cleaning', subcategoryKey: 'home_cleaning' });

    expect(res).toEqual([]);
  });

  it('listPublic filters by subcategoryKey (serviceKey) directly', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    modelMock.find.mockReturnValue({ sort });
    catalogMock.listServices.mockResolvedValue([]);

    await service.listPublic({ subcategoryKey: 'window_cleaning' });

    expect(modelMock.find).toHaveBeenCalledWith({
      status: 'published',
      serviceKey: 'window_cleaning',
    });
  });

  it('listPublic supports price range', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    modelMock.find.mockReturnValue({ sort });
    catalogMock.listServices.mockResolvedValue([]);

    await service.listPublic({ priceMin: 50, priceMax: 200 });

    expect(modelMock.find).toHaveBeenCalledWith({
      status: 'published',
      price: { $gte: 50, $lte: 200 },
    });
  });

  it('listPublic throws when priceMax < priceMin', async () => {
    await expect(service.listPublic({ priceMin: 200, priceMax: 100 })).rejects.toThrow(
      'priceMax must be >= priceMin',
    );
  });

  it('countPublic applies category/subcategory filters and price range', async () => {
    modelMock.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(2) });
    catalogMock.listServices.mockResolvedValue([{ key: 'window_cleaning' }]);

    const total = await service.countPublic({
      categoryKey: 'cleaning',
      subcategoryKey: 'window_cleaning',
      priceMin: 50,
      priceMax: 200,
    });

    expect(catalogMock.listServices).toHaveBeenCalledWith('cleaning');
    expect(modelMock.countDocuments).toHaveBeenCalledWith({
      status: 'published',
      serviceKey: 'window_cleaning',
      price: { $gte: 50, $lte: 200 },
    });
    expect(total).toBe(2);
  });

  it('countPublic returns 0 for category mismatch', async () => {
    catalogMock.listServices.mockResolvedValue([{ key: 'window_cleaning' }]);

    const total = await service.countPublic({ categoryKey: 'cleaning', subcategoryKey: 'home_cleaning' });

    expect(total).toBe(0);
    expect(modelMock.countDocuments).not.toHaveBeenCalled();
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

  it('publishForClient publishes draft request for client', async () => {
    const rid = '507f1f77bcf86cd799439011';
    const execFind = jest.fn().mockResolvedValue({ _id: rid, clientId: 'u1', status: 'draft' });
    modelMock.findById.mockReturnValue({ exec: execFind });

    const execUpdate = jest.fn().mockResolvedValue({ _id: rid, clientId: 'u1', status: 'published' });
    modelMock.findOneAndUpdate.mockReturnValue({ exec: execUpdate });

    const res: any = await service.publishForClient('u1', rid);

    expect(modelMock.findById).toHaveBeenCalledWith(rid);
    expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: rid, clientId: 'u1' },
      { $set: { status: 'published' } },
      { new: true },
    );
    expect(res.status).toBe('published');
  });

  it('publishForClient throws when request is not draft', async () => {
    const rid = '507f1f77bcf86cd799439012';
    const execFind = jest.fn().mockResolvedValue({ _id: rid, clientId: 'u1', status: 'published' });
    modelMock.findById.mockReturnValue({ exec: execFind });

    await expect(service.publishForClient('u1', rid)).rejects.toThrow('Only draft requests can be published');
    expect(modelMock.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('publishForClient throws when request not found or not owned', async () => {
    const rid = '507f1f77bcf86cd799439013';
    const execFind = jest.fn().mockResolvedValue(null);
    modelMock.findById.mockReturnValue({ exec: execFind });

    await expect(service.publishForClient('u1', rid)).rejects.toThrow('Request not found');
    expect(modelMock.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('publishForClient throws on invalid requestId', async () => {
    await expect(service.publishForClient('u1', 'not-an-objectid')).rejects.toThrow('requestId must be a valid ObjectId');
    expect(modelMock.findById).not.toHaveBeenCalled();
  });
});
