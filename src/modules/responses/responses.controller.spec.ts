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
});
