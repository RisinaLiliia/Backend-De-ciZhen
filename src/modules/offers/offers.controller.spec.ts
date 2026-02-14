// src/modules/offers/offers.controller.spec.ts
import { Test } from '@nestjs/testing';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { ForbiddenException } from '@nestjs/common';

describe('OffersController (unit)', () => {
  let controller: OffersController;

  const svcMock = {
    createForProvider: jest.fn(),
    updateForProvider: jest.fn(),
    deleteForProvider: jest.fn(),
    listMy: jest.fn(),
    listMyClient: jest.fn(),
    listByRequestForClient: jest.fn(),
    acceptForClient: jest.fn(),
    declineForClient: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [{ provide: OffersService, useValue: svcMock }],
    }).compile();

    controller = moduleRef.get(OffersController);
  });

  it('provider create returns dto', async () => {
    svcMock.createForProvider.mockResolvedValue({
      offer: {
        _id: { toString: () => 'offer1' },
        requestId: 'r1',
        providerUserId: 'p1',
        clientUserId: 'c1',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      providerProfile: {
        _id: { toString: () => 'prof1' },
        userId: 'p1',
        status: 'draft',
        isBlocked: false,
        serviceKeys: ['home_cleaning'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const res = await controller.create(
      { userId: 'p1', role: 'provider' } as any,
      { requestId: '507f1f77bcf86cd799439011', amount: 120 } as any,
    );

    expect(res.offer).toEqual(expect.objectContaining({ id: 'offer1', status: 'sent' }));
    expect(res.providerProfile).toEqual(expect.objectContaining({ id: 'prof1', userId: 'p1' }));
  });

  it('forbids wrong role', async () => {
    await expect(
      controller.create({ userId: 'x', role: 'guest' } as any, { requestId: '507f1f77bcf86cd799439011', amount: 99 } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('client myClient returns dto list', async () => {
    svcMock.listMyClient.mockResolvedValue([
      {
        _id: { toString: () => 'offer1' },
        requestId: 'r1',
        providerUserId: 'p1',
        clientUserId: 'c1',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await controller.myClient({ userId: 'c1', role: 'client' } as any, { status: 'sent' } as any);

    expect(svcMock.listMyClient).toHaveBeenCalledWith('c1', { status: 'sent' });
    expect(res[0]).toEqual(expect.objectContaining({ id: 'offer1', status: 'sent' }));
  });

  it('update returns dto', async () => {
    svcMock.updateForProvider.mockResolvedValue({
      offer: {
        _id: { toString: () => 'offer1' },
        requestId: 'r1',
        providerUserId: 'p1',
        clientUserId: 'c1',
        status: 'sent',
        pricing: { amount: 150, type: 'fixed' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      providerProfile: {
        _id: { toString: () => 'prof1' },
        userId: 'p1',
        status: 'draft',
        isBlocked: false,
        serviceKeys: ['home_cleaning'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const res = await controller.update(
      { userId: 'p1', role: 'provider' } as any,
      'offer1',
      { amount: 150 } as any,
    );

    expect(svcMock.updateForProvider).toHaveBeenCalledWith('p1', 'offer1', { amount: 150 });
    expect(res.offer).toEqual(expect.objectContaining({ id: 'offer1', amount: 150 }));
  });

  it('remove calls service and returns ok', async () => {
    svcMock.deleteForProvider.mockResolvedValue(undefined);

    const res = await controller.remove({ userId: 'p1', role: 'provider' } as any, 'offer9');

    expect(svcMock.deleteForProvider).toHaveBeenCalledWith('p1', 'offer9');
    expect(res).toEqual({ ok: true, deletedOfferId: 'offer9' });
  });

  it('my returns actor offers', async () => {
    svcMock.listMy.mockResolvedValue([
      {
        _id: { toString: () => 'offer2' },
        requestId: 'r2',
        providerUserId: 'p1',
        clientUserId: 'c2',
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await controller.my({ userId: 'p1', role: 'client' } as any, { status: 'sent' } as any);

    expect(svcMock.listMy).toHaveBeenCalledWith('p1', { status: 'sent' });
    expect(res[0]).toEqual(expect.objectContaining({ id: 'offer2', status: 'sent' }));
  });

  it('listForRequest returns client offers for request', async () => {
    svcMock.listByRequestForClient.mockResolvedValue([
      {
        _id: { toString: () => 'offer3' },
        requestId: 'r3',
        providerUserId: 'p2',
        clientUserId: 'c1',
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await controller.listForRequest(
      { userId: 'c1', role: 'client' } as any,
      'r3',
      { status: 'accepted' } as any,
    );

    expect(svcMock.listByRequestForClient).toHaveBeenCalledWith('c1', 'r3', { status: 'accepted' });
    expect(res[0]).toEqual(expect.objectContaining({ id: 'offer3', status: 'accepted' }));
  });

  it('accept calls service and returns ok', async () => {
    svcMock.acceptForClient.mockResolvedValue(undefined);

    const res = await controller.accept({ userId: 'c1', role: 'client' } as any, 'offer4');

    expect(svcMock.acceptForClient).toHaveBeenCalledWith('c1', 'offer4');
    expect(res).toEqual({ ok: true, acceptedOfferId: 'offer4' });
  });

  it('decline calls service and returns ok', async () => {
    svcMock.declineForClient.mockResolvedValue(undefined);

    const res = await controller.decline({ userId: 'c1', role: 'client' } as any, 'offer5');

    expect(svcMock.declineForClient).toHaveBeenCalledWith('c1', 'offer5');
    expect(res).toEqual({ ok: true, rejectedOfferId: 'offer5' });
  });
});
