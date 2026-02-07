// src/modules/requests/requests.controller.spec.ts
import { Test } from '@nestjs/testing';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

describe('RequestsController (unit)', () => {
  let controller: RequestsController;

  const svcMock = {
    createPublic: jest.fn(),
    createForClient: jest.fn(),
    publishForClient: jest.fn(),
    listPublic: jest.fn(),
    listMyClient: jest.fn(),
    normalizeFilters: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [{ provide: RequestsService, useValue: svcMock }],
    }).compile();

    controller = moduleRef.get(RequestsController);
  });

  it('create maps dto', async () => {
    svcMock.createPublic.mockResolvedValue({
      _id: { toString: () => 'r1' },
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

    const res = await controller.create(
      {
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

    await controller.create(
      {
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
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        propertyType: 'apartment',
        area: 55,
        preferredDate: new Date('2026-02-01T10:00:00.000Z'),
        isRecurring: false,
        comment: 'x',
        status: 'published',
        createdAt: new Date(),
      },
    ]);

    const res = await controller.listPublic({ cityId: 'c1', serviceKey: 'home_cleaning' } as any);

    expect(svcMock.listPublic).toHaveBeenCalledWith({ cityId: 'c1', serviceKey: 'home_cleaning' });
    expect(res[0]).toEqual(expect.objectContaining({ id: 'r1', cityId: 'c1', serviceKey: 'home_cleaning' }));
  });

  it('my passes filters and maps list', async () => {
    svcMock.normalizeFilters.mockReturnValue({ status: 'published' });
    svcMock.listMyClient.mockResolvedValue([
      {
        _id: { toString: () => 'r1' },
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        propertyType: 'apartment',
        area: 55,
        preferredDate: new Date('2026-02-01T10:00:00.000Z'),
        isRecurring: false,
        comment: null,
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
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      propertyType: 'apartment',
      area: 55,
      preferredDate: new Date('2026-02-01T10:00:00.000Z'),
      isRecurring: false,
      comment: null,
      status: 'draft',
      createdAt: new Date('2026-01-28T10:00:00.000Z'),
    });

    const res = await controller.createMy(
      { userId: 'u1', role: 'client' } as any,
      {
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
