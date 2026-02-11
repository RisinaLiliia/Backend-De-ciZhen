// src/modules/requests/requests.controller.spec.ts
import { Test } from '@nestjs/testing';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { PresenceService } from '../presence/presence.service';

describe('RequestsController (unit)', () => {
  let controller: RequestsController;

  const svcMock = {
    createPublic: jest.fn(),
    createForClient: jest.fn(),
    publishForClient: jest.fn(),
    listPublic: jest.fn(),
    countPublic: jest.fn(),
    listMyClient: jest.fn(),
    normalizeFilters: jest.fn(),
    getPublicById: jest.fn(),
  };

  const uploadsMock = {
    uploadImages: jest.fn(),
  };

  const usersMock = {
    findPublicByIds: jest.fn(),
  };

  const clientProfilesMock = {
    getByUserIds: jest.fn(),
  };

  const presenceMock = {
    isOnline: jest.fn(),
    getOnlineMap: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [
        { provide: RequestsService, useValue: svcMock },
        { provide: UploadsService, useValue: uploadsMock },
        { provide: UsersService, useValue: usersMock },
        { provide: ClientProfilesService, useValue: clientProfilesMock },
        { provide: PresenceService, useValue: presenceMock },
      ],
    }).compile();

    controller = moduleRef.get(RequestsController);
  });

  it('create maps dto', async () => {
    svcMock.createPublic.mockResolvedValue({
      _id: { toString: () => 'r1' },
      title: 'Test',
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date('2026-02-01T10:00:00.000Z'),
      isRecurring: false,
      comment: null,
      description: 'details',
      photos: ['https://x/y.jpg'],
      imageUrl: 'https://x/y.jpg',
      tags: ['tag1'],
      status: 'published',
      createdAt: new Date('2026-01-28T10:00:00.000Z'),
    });

    const res = await controller.create(
      {
        title: 'Test',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-02-01T10:00:00.000Z',
        isRecurring: false,
      } as any,
      null,
    );

    expect(svcMock.createPublic).toHaveBeenCalledWith(expect.anything(), null);
    expect(res).toEqual(
      expect.objectContaining({
        id: 'r1',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        status: 'published',
      }),
    );
  });

  it('create passes clientId for authenticated client', async () => {
    svcMock.createPublic.mockResolvedValue({
      _id: { toString: () => 'r1' },
      title: 'Test',
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date('2026-02-01T10:00:00.000Z'),
      isRecurring: false,
      comment: null,
      description: 'details',
      photos: ['https://x/y.jpg'],
      imageUrl: 'https://x/y.jpg',
      tags: ['tag1'],
      status: 'published',
      createdAt: new Date('2026-01-28T10:00:00.000Z'),
    });

    await controller.create(
      {
        title: 'Test',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-02-01T10:00:00.000Z',
        isRecurring: false,
      } as any,
      { userId: 'u1', role: 'client' } as any,
    );

    expect(svcMock.createPublic).toHaveBeenCalledWith(expect.anything(), 'u1');
  });

  it('listPublic passes filters and maps list', async () => {
    svcMock.listPublic.mockResolvedValue([
      {
        _id: { toString: () => 'r1' },
        title: 'Test',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        cityName: 'Berlin',
        categoryKey: 'cleaning',
        categoryName: 'Cleaning',
        subcategoryName: 'Home cleaning',
        propertyType: 'apartment',
        area: 55,
        price: 120,
        preferredDate: new Date('2026-02-01T10:00:00.000Z'),
        isRecurring: false,
        comment: 'x',
        description: 'details',
        photos: ['https://x/y.jpg'],
        imageUrl: 'https://x/y.jpg',
        tags: ['tag1'],
        status: 'published',
        createdAt: new Date(),
      },
    ]);
    svcMock.countPublic.mockResolvedValue(1);
    usersMock.findPublicByIds.mockResolvedValue([]);
    clientProfilesMock.getByUserIds.mockResolvedValue([]);
    presenceMock.getOnlineMap.mockResolvedValue(new Map());

    const res = await controller.listPublic({
      cityId: 'c1',
      serviceKey: 'home_cleaning',
      categoryKey: 'cleaning',
      subcategoryKey: 'window_cleaning',
      sort: 'date_desc',
      page: 2,
      limit: 10,
      offset: 5,
      priceMin: 50,
      priceMax: 200,
    } as any);

    expect(svcMock.listPublic).toHaveBeenCalledWith({
      cityId: 'c1',
      serviceKey: 'home_cleaning',
      categoryKey: 'cleaning',
      subcategoryKey: 'window_cleaning',
      sort: 'date_desc',
      page: 2,
      limit: 10,
      offset: 5,
      priceMin: 50,
      priceMax: 200,
    });
    expect(svcMock.countPublic).toHaveBeenCalledWith({
      cityId: 'c1',
      serviceKey: 'home_cleaning',
      categoryKey: 'cleaning',
      subcategoryKey: 'window_cleaning',
      sort: 'date_desc',
      page: 2,
      limit: 10,
      offset: 5,
      priceMin: 50,
      priceMax: 200,
    });
    expect(res).toEqual(
      expect.objectContaining({
        total: 1,
        page: 1,
        limit: 10,
      }),
    );
    expect(res.items[0]).toEqual(
      expect.objectContaining({ id: 'r1', cityId: 'c1', serviceKey: 'home_cleaning' }),
    );
  });

  it('getPublicById maps client public info', async () => {
    svcMock.getPublicById.mockResolvedValue({
      _id: { toString: () => 'r1' },
      title: 'Test',
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date('2026-02-01T10:00:00.000Z'),
      isRecurring: false,
      comment: null,
      description: 'details',
      photos: [],
      imageUrl: null,
      tags: [],
      status: 'published',
      createdAt: new Date('2026-01-28T10:00:00.000Z'),
      clientId: 'c1',
    });
    usersMock.findPublicByIds.mockResolvedValue([
      {
        _id: { toString: () => 'c1' },
        name: 'Anna',
        avatar: { url: '/avatars/a.png', isDefault: false },
        city: 'Berlin',
        lastSeenAt: new Date('2026-02-11T10:00:00.000Z'),
      },
    ]);
    clientProfilesMock.getByUserIds.mockResolvedValue([{ userId: 'c1', ratingAvg: 4.8, ratingCount: 12 }]);
    presenceMock.isOnline.mockResolvedValue(true);

    const res = await controller.getPublicById('r1');

    expect(svcMock.getPublicById).toHaveBeenCalledWith('r1');
    expect(usersMock.findPublicByIds).toHaveBeenCalledWith(['c1']);
    expect(clientProfilesMock.getByUserIds).toHaveBeenCalledWith(['c1']);
    expect(presenceMock.isOnline).toHaveBeenCalledWith('c1');
    expect(res).toEqual(
      expect.objectContaining({
        id: 'r1',
        clientId: 'c1',
        clientName: 'Anna',
        clientAvatarUrl: '/avatars/a.png',
        clientCity: 'Berlin',
        clientRatingAvg: 4.8,
        clientRatingCount: 12,
        clientIsOnline: true,
        clientLastSeenAt: new Date('2026-02-11T10:00:00.000Z'),
      }),
    );
  });

  it('my passes filters and maps list', async () => {
    svcMock.normalizeFilters.mockReturnValue({ status: 'published' });
    svcMock.listMyClient.mockResolvedValue([
      {
        _id: { toString: () => 'r1' },
        title: 'Test',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        cityName: 'Berlin',
        categoryKey: 'cleaning',
        categoryName: 'Cleaning',
        subcategoryName: 'Home cleaning',
        propertyType: 'apartment',
        area: 55,
        price: 120,
        preferredDate: new Date('2026-02-01T10:00:00.000Z'),
        isRecurring: false,
        comment: null,
        description: 'details',
        photos: ['https://x/y.jpg'],
        imageUrl: 'https://x/y.jpg',
        tags: ['tag1'],
        status: 'published',
        createdAt: new Date('2026-01-28T10:00:00.000Z'),
      },
    ]);

    const res = await controller.my({ userId: 'u1', role: 'client' } as any, { status: 'published' } as any);

    expect(svcMock.normalizeFilters).toHaveBeenCalledWith({ status: 'published' });
    expect(svcMock.listMyClient).toHaveBeenCalledWith('u1', { status: 'published' });
    expect(res[0]).toEqual(expect.objectContaining({ id: 'r1', cityId: 'c1', status: 'published' }));
  });

  it('createMy creates draft for client', async () => {
    svcMock.createForClient.mockResolvedValue({
      _id: { toString: () => 'r2' },
      title: 'Test',
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date('2026-02-01T10:00:00.000Z'),
      isRecurring: false,
      comment: null,
      description: 'details',
      photos: ['https://x/y.jpg'],
      imageUrl: 'https://x/y.jpg',
      tags: ['tag1'],
      status: 'draft',
      createdAt: new Date('2026-01-28T10:00:00.000Z'),
    });

    const res = await controller.createMy(
      { userId: 'u1', role: 'client' } as any,
      {
        title: 'Test',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-02-01T10:00:00.000Z',
        isRecurring: false,
      } as any,
    );

    expect(svcMock.createForClient).toHaveBeenCalledWith(expect.anything(), 'u1');
    expect(res).toEqual(expect.objectContaining({ id: 'r2', status: 'draft' }));
  });

  it('uploadMyPhotos returns urls for client', async () => {
    uploadsMock.uploadImages.mockResolvedValue([
      { url: 'https://cdn.example.com/req/1.jpg' },
      { url: 'https://cdn.example.com/req/2.jpg' },
    ]);

    const res = await controller.uploadMyPhotos(
      { userId: 'u1', role: 'client' } as any,
      { photos: [{ buffer: Buffer.from('x') } as any] } as any,
    );

    expect(uploadsMock.uploadImages).toHaveBeenCalled();
    expect(res).toEqual({ urls: ['https://cdn.example.com/req/1.jpg', 'https://cdn.example.com/req/2.jpg'] });
  });

  it('publishMy publishes client draft', async () => {
    svcMock.publishForClient.mockResolvedValue({
      _id: { toString: () => 'r3' },
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      propertyType: 'apartment',
      area: 55,
      preferredDate: new Date('2026-02-01T10:00:00.000Z'),
      isRecurring: false,
      comment: null,
      status: 'published',
      createdAt: new Date('2026-01-28T10:00:00.000Z'),
    });

    const res = await controller.publishMy(
      { userId: 'u1', role: 'client' } as any,
      'r3',
    );

    expect(svcMock.publishForClient).toHaveBeenCalledWith('u1', 'r3');
    expect(res).toEqual(expect.objectContaining({ id: 'r3', status: 'published' }));
  });
});
