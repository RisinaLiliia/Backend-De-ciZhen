// src/modules/responses/responses.controller.spec.ts
import { Test } from '@nestjs/testing';
import { ResponsesController } from './responses.controller';
import { ResponsesService } from './responses.service';
import { ForbiddenException } from '@nestjs/common';

describe('ResponsesController (unit)', () => {
  let controller: ResponsesController;

  const svcMock = {
    createForProvider: jest.fn(),
    listMy: jest.fn(),
    listMyClient: jest.fn(),
    listByRequestForClient: jest.fn(),
    acceptForClient: jest.fn(),
    rejectForClient: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ResponsesController],
      providers: [{ provide: ResponsesService, useValue: svcMock }],
    }).compile();

    controller = moduleRef.get(ResponsesController);
  });

  it('provider create returns dto', async () => {
    svcMock.createForProvider.mockResolvedValue({
      _id: { toString: () => 'resp1' },
      requestId: 'r1',
      providerUserId: 'p1',
      clientUserId: 'c1',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await controller.create(
      { userId: 'p1', role: 'provider' } as any,
      { requestId: '507f1f77bcf86cd799439011' } as any,
    );

    expect(res).toEqual(expect.objectContaining({ id: 'resp1', status: 'pending' }));
  });

  it('forbids wrong role', async () => {
    await expect(
      controller.create({ userId: 'x', role: 'client' } as any, { requestId: '507f1f77bcf86cd799439011' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('client myClient returns dto list', async () => {
    svcMock.listMyClient.mockResolvedValue([
      {
        _id: { toString: () => 'resp1' },
        requestId: 'r1',
        providerUserId: 'p1',
        clientUserId: 'c1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await controller.myClient({ userId: 'c1', role: 'client' } as any, { status: 'pending' } as any);

    expect(svcMock.listMyClient).toHaveBeenCalledWith('c1', { status: 'pending' });
    expect(res[0]).toEqual(expect.objectContaining({ id: 'resp1', status: 'pending' }));
  });

  it('my returns provider responses', async () => {
    svcMock.listMy.mockResolvedValue([
      {
        _id: { toString: () => 'resp2' },
        requestId: 'r2',
        providerUserId: 'p1',
        clientUserId: 'c2',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await controller.my({ userId: 'p1', role: 'provider' } as any, { status: 'pending' } as any);

    expect(svcMock.listMy).toHaveBeenCalledWith('p1', { status: 'pending' });
    expect(res[0]).toEqual(expect.objectContaining({ id: 'resp2', status: 'pending' }));
  });

  it('listForRequest returns client responses for request', async () => {
    svcMock.listByRequestForClient.mockResolvedValue([
      {
        _id: { toString: () => 'resp3' },
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
    expect(res[0]).toEqual(expect.objectContaining({ id: 'resp3', status: 'accepted' }));
  });

  it('accept calls service and returns ok', async () => {
    svcMock.acceptForClient.mockResolvedValue(undefined);

    const res = await controller.accept({ userId: 'c1', role: 'client' } as any, 'resp4');

    expect(svcMock.acceptForClient).toHaveBeenCalledWith('c1', 'resp4');
    expect(res).toEqual({ ok: true, acceptedResponseId: 'resp4' });
  });

  it('reject calls service and returns ok', async () => {
    svcMock.rejectForClient.mockResolvedValue(undefined);

    const res = await controller.reject({ userId: 'c1', role: 'client' } as any, 'resp5');

    expect(svcMock.rejectForClient).toHaveBeenCalledWith('c1', 'resp5');
    expect(res).toEqual({ ok: true, rejectedResponseId: 'resp5' });
  });
});
