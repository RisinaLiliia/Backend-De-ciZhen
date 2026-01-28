import { Test } from '@nestjs/testing';
import { ResponsesController } from './responses.controller';
import { ResponsesService } from './responses.service';
import { ForbiddenException } from '@nestjs/common';

describe('ResponsesController (unit)', () => {
  let controller: ResponsesController;

  const svcMock = {
    createForProvider: jest.fn(),
    listMy: jest.fn(),
    listByRequestForClient: jest.fn(),
    acceptForClient: jest.fn(),
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

    const res = await controller.create({ userId: 'p1', role: 'provider' } as any, { requestId: 'r1' } as any);
    expect(svcMock.createForProvider).toHaveBeenCalledWith('p1', 'r1');
    expect(res).toEqual(expect.objectContaining({ id: 'resp1', status: 'pending' }));
  });

  it('provider my lists', async () => {
    svcMock.listMy.mockResolvedValue([
      { _id: { toString: () => 'resp1' }, requestId: 'r1', providerUserId: 'p1', clientUserId: 'c1', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await controller.my({ userId: 'p1', role: 'provider' } as any);
    expect(svcMock.listMy).toHaveBeenCalledWith('p1');
    expect(res[0]).toEqual(expect.objectContaining({ id: 'resp1', requestId: 'r1' }));
  });

  it('client listForRequest passes through', async () => {
    svcMock.listByRequestForClient.mockResolvedValue([
      { _id: { toString: () => 'resp1' }, requestId: 'r1', providerUserId: 'p1', clientUserId: 'c1', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await controller.listForRequest({ userId: 'c1', role: 'client' } as any, 'r1');
    expect(svcMock.listByRequestForClient).toHaveBeenCalledWith('c1', 'r1');
    expect(res).toHaveLength(1);
  });

  it('client accept returns ok', async () => {
    svcMock.acceptForClient.mockResolvedValue(undefined);
    const res = await controller.accept({ userId: 'c1', role: 'client' } as any, 'resp1');
    expect(svcMock.acceptForClient).toHaveBeenCalledWith('c1', 'resp1');
    expect(res).toEqual({ ok: true, acceptedResponseId: 'resp1' });
  });

  it('forbids wrong role', async () => {
    await expect(controller.create({ userId: 'x', role: 'client' } as any, { requestId: 'r1' } as any))
      .rejects
      .toBeInstanceOf(ForbiddenException);
  });
});
