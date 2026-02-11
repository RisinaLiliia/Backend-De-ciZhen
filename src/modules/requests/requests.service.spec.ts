// src/modules/requests/requests.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RequestsService } from './requests.service';
import { Request } from './schemas/request.schema';
import { CatalogServicesService } from '../catalog/services/services.service';
import { CitiesService } from '../catalog/cities/cities.service';

describe('RequestsService', () => {
  let service: RequestsService;

  const modelMock = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  };

  const catalogMock = {
    listServices: jest.fn(),
    getServiceByKey: jest.fn(),
    getCategoryByKey: jest.fn(),
  };

  const citiesMock = {
    getById: jest.fn(),
    createDynamic: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: getModelToken(Request.name), useValue: modelMock },
        { provide: CatalogServicesService, useValue: catalogMock },
        { provide: CitiesService, useValue: citiesMock },
      ],
    }).compile();

    service = moduleRef.get(RequestsService);
  });

  it('createPublic normalizes serviceKey and creates published request', async () => {
    modelMock.create.mockResolvedValue({ _id: 'r1', serviceKey: 'home_cleaning', status: 'published' });
    catalogMock.getServiceByKey.mockResolvedValue({
      key: 'home_cleaning',
      categoryKey: 'cleaning',
      name: 'Home cleaning',
    });
    catalogMock.getCategoryByKey.mockResolvedValue({ key: 'cleaning', name: 'Cleaning' });
    citiesMock.getById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'Berlin' });
    citiesMock.createDynamic.mockResolvedValue({ _id: 'c99', name: 'Berlin' });

    const res: any = await service.createPublic({
      title: 'Test',
      serviceKey: ' Home_Cleaning ',
      cityId: ' 507f1f77bcf86cd799439011 ',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: '2026-02-01T10:00:00.000Z',
      isRecurring: false,
      lat: 50.1109,
      lng: 8.6821,
      comment: '  hi  ',
      description: '  details  ',
      photos: [' https://x/y.jpg '],
      tags: [' Ikea ', 'assembly'],
    } as any);

    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: null,
        title: 'Test',
        serviceKey: 'home_cleaning',
        cityId: '507f1f77bcf86cd799439011',
        cityName: 'Berlin',
        location: { type: 'Point', coordinates: [8.6821, 50.1109] },
        categoryKey: 'cleaning',
        categoryName: 'Cleaning',
        subcategoryName: 'Home cleaning',
        status: 'published',
        comment: 'hi',
        description: 'details',
        imageUrl: 'https://x/y.jpg',
        tags: ['ikea', 'assembly'],
      }),
    );
    expect(res.status).toBe('published');
  });

  it('createPublic sets clientId when provided', async () => {
    modelMock.create.mockResolvedValue({ _id: 'r2', clientId: 'u1', status: 'published' });
    catalogMock.getServiceByKey.mockResolvedValue({
      key: 'home_cleaning',
      categoryKey: 'cleaning',
      name: 'Home cleaning',
    });
    catalogMock.getCategoryByKey.mockResolvedValue({ key: 'cleaning', name: 'Cleaning' });
    citiesMock.getById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'Berlin' });
    citiesMock.createDynamic.mockResolvedValue({ _id: 'c99', name: 'Berlin' });

    await service.createPublic(
      {
        title: 'Test',
        serviceKey: 'home_cleaning',
        cityId: '507f1f77bcf86cd799439011',
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

  it('createPublic allows missing cityId when lat/lng and cityName provided', async () => {
    modelMock.create.mockResolvedValue({ _id: 'r4', serviceKey: 'home_cleaning', status: 'published' });
    catalogMock.getServiceByKey.mockResolvedValue({
      key: 'home_cleaning',
      categoryKey: 'cleaning',
      name: 'Home cleaning',
    });
    catalogMock.getCategoryByKey.mockResolvedValue({ key: 'cleaning', name: 'Cleaning' });
    citiesMock.getById.mockResolvedValue(null);
    citiesMock.createDynamic.mockResolvedValue({ _id: 'c99', name: 'Frankfurt am Main' });

    await service.createPublic({
      title: 'Test',
      serviceKey: 'home_cleaning',
      cityName: 'Frankfurt am Main',
      lat: 50.1109,
      lng: 8.6821,
      propertyType: 'apartment',
      area: 55,
      preferredDate: '2026-02-01T10:00:00.000Z',
      isRecurring: false,
    } as any);

    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: 'c99',
        cityName: 'Frankfurt am Main',
        location: { type: 'Point', coordinates: [8.6821, 50.1109] },
      }),
    );
    expect(citiesMock.createDynamic).toHaveBeenCalledWith('Frankfurt am Main');
  });

  it('createPublic creates city when cityId is unknown and cityName provided', async () => {
    modelMock.create.mockResolvedValue({ _id: 'r5', serviceKey: 'home_cleaning', status: 'published' });
    catalogMock.getServiceByKey.mockResolvedValue({
      key: 'home_cleaning',
      categoryKey: 'cleaning',
      name: 'Home cleaning',
    });
    catalogMock.getCategoryByKey.mockResolvedValue({ key: 'cleaning', name: 'Cleaning' });
    citiesMock.getById.mockResolvedValue(null);
    citiesMock.createDynamic.mockResolvedValue({ _id: 'c77', name: 'Ulm' });

    await service.createPublic({
      title: 'Test',
      serviceKey: 'home_cleaning',
      cityId: 'unknown-id',
      cityName: 'Ulm',
      lat: 48.3984,
      lng: 9.9916,
      propertyType: 'apartment',
      area: 55,
      preferredDate: '2026-02-01T10:00:00.000Z',
      isRecurring: false,
    } as any);

    expect(citiesMock.createDynamic).toHaveBeenCalledWith('Ulm');
    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: 'c77',
        cityName: 'Ulm',
      }),
    );
  });

  it('createForClient creates draft request for client', async () => {
    modelMock.create.mockResolvedValue({ _id: 'r3', clientId: 'u1', status: 'draft' });
    catalogMock.getServiceByKey.mockResolvedValue({
      key: 'home_cleaning',
      categoryKey: 'cleaning',
      name: 'Home cleaning',
    });
    catalogMock.getCategoryByKey.mockResolvedValue({ key: 'cleaning', name: 'Cleaning' });
    citiesMock.getById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'Berlin' });
    citiesMock.createDynamic.mockResolvedValue({ _id: 'c99', name: 'Berlin' });

    await service.createForClient({
      title: 'Test',
      serviceKey: 'home_cleaning',
      cityId: ' 507f1f77bcf86cd799439011 ',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: '2026-02-01T10:00:00.000Z',
      isRecurring: false,
      comment: '  hi  ',
      description: '  details  ',
      photos: [' https://x/y.jpg '],
      tags: [' Ikea ', 'assembly'],
    } as any, 'u1');

    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'u1',
        title: 'Test',
        cityId: '507f1f77bcf86cd799439011',
        serviceKey: 'home_cleaning',
        cityName: 'Berlin',
        categoryKey: 'cleaning',
        categoryName: 'Cleaning',
        subcategoryName: 'Home cleaning',
        status: 'draft',
        comment: 'hi',
        description: 'details',
        imageUrl: 'https://x/y.jpg',
        tags: ['ikea', 'assembly'],
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

  it('listPublic applies geo filter when lat/lng provided', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    modelMock.find.mockReturnValue({ sort });
    catalogMock.listServices.mockResolvedValue([]);

    await service.listPublic({ lat: 50.1109, lng: 8.6821, radiusKm: 5, cityId: 'c1' });

    expect(modelMock.find).toHaveBeenCalledWith({
      status: 'published',
      location: {
        $geoWithin: {
          $centerSphere: [[8.6821, 50.1109], 5 / 6378.1],
        },
      },
    });
  });

  it('listPublic throws when only one coordinate is provided', async () => {
    await expect(service.listPublic({ lat: 50.1109 })).rejects.toThrow('lat and lng must be provided together');
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

  it('getPublicById returns published request', async () => {
    const rid = '507f1f77bcf86cd799439011';
    const execFind = jest.fn().mockResolvedValue({ _id: rid, status: 'published' });
    modelMock.findOne.mockReturnValue({ exec: execFind });

    const res: any = await service.getPublicById(rid);

    expect(modelMock.findOne).toHaveBeenCalledWith({ _id: rid, status: 'published' });
    expect(res.status).toBe('published');
  });

  it('getPublicById throws when not found', async () => {
    const rid = '507f1f77bcf86cd799439012';
    const execFind = jest.fn().mockResolvedValue(null);
    modelMock.findOne.mockReturnValue({ exec: execFind });

    await expect(service.getPublicById(rid)).rejects.toThrow('Request not found');
    expect(modelMock.findOne).toHaveBeenCalledWith({ _id: rid, status: 'published' });
  });

  it('getPublicById throws on invalid requestId', async () => {
    await expect(service.getPublicById('not-an-objectid')).rejects.toThrow('requestId must be a valid ObjectId');
    expect(modelMock.findOne).not.toHaveBeenCalled();
  });
});
