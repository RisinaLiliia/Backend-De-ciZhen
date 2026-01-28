// src/modules/requests/requests.controller.spec.ts
import { Test } from '@nestjs/testing';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

describe('RequestsController (unit)', () => {
  let controller: RequestsController;

  const svcMock = {
    createPublic: jest.fn(),
    listPublic: jest.fn(),
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

    const res = await controller.create({
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      propertyType: 'apartment',
      area: 55,
      preferredDate: '2026-02-01T10:00:00.000Z',
      isRecurring: false,
    } as any);

    expect(res).toEqual(
      expect.objectContaining({
        id: 'r1',
        serviceKey: 'home_cleaning',
        cityId: 'c1',
        status: 'published',
      }),
    );
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
});
