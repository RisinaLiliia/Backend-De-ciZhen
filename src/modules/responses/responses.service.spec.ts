// src/modules/responses/responses.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResponsesService } from './responses.service';
import { Response as Resp } from './schemas/response.schema';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';
import { Request } from '../requests/schemas/request.schema';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('ResponsesService', () => {
  let service: ResponsesService;

  const responseModelMock = {
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  updateMany: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
};



  const providerModelMock = {
    findOne: jest.fn(),
  };

  const requestModelMock = {
    findById: jest.fn(),
    updateOne: jest.fn(),
  };

  const execWrap = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

beforeEach(async () => {
  jest.clearAllMocks();

  responseModelMock.aggregate.mockReturnValue(execWrap([]));
  responseModelMock.countDocuments?.mockResolvedValue?.(0);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResponsesService,
        { provide: getModelToken(Resp.name), useValue: responseModelMock },
        { provide: getModelToken(ProviderProfile.name), useValue: providerModelMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
      ],
    }).compile();

    service = moduleRef.get(ResponsesService);
  });

  it('createForProvider throws if provider missing', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap(null));
    await expect(service.createForProvider('p1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('createForProvider enforces daily limit', async () => {
    responseModelMock.countDocuments.mockResolvedValue(999);
    await expect(service.createForProvider('p1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('createForProvider throws if provider blocked', async () => {
    providerModelMock.findOne.mockReturnValue(
      execWrap({ userId: 'p1', isBlocked: true, status: 'active' }),
    );

    await expect(service.createForProvider('p1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('createForProvider throws if provider not active', async () => {
    providerModelMock.findOne.mockReturnValue(
      execWrap({ userId: 'p1', isBlocked: false, status: 'draft' }),
    );

    await expect(service.createForProvider('p1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('createForProvider throws if request missing', async () => {
    providerModelMock.findOne.mockReturnValue(
      execWrap({ userId: 'p1', isBlocked: false, status: 'active', cityId: 'Berlin', serviceKeys: ['home_cleaning'] }),
    );
    requestModelMock.findById.mockReturnValue(execWrap(null));

    await expect(service.createForProvider('p1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('createForProvider throws if request not published', async () => {
    providerModelMock.findOne.mockReturnValue(
      execWrap({ userId: 'p1', isBlocked: false, status: 'active', cityId: 'Berlin', serviceKeys: ['home_cleaning'] }),
    );
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientId: 'c1', status: 'draft' }));

    await expect(service.createForProvider('p1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('createForProvider creates pending response', async () => {
    providerModelMock.findOne.mockReturnValue(
      execWrap({ userId: 'p1', isBlocked: false, status: 'active', cityId: 'Berlin', serviceKeys: ['home_cleaning'] }),
    );
    requestModelMock.findById.mockReturnValue(
      execWrap({ _id: '507f1f77bcf86cd799439011', clientId: 'c1', status: 'published', cityId: 'Berlin', serviceKey: 'home_cleaning' }),
    );
    responseModelMock.create.mockResolvedValue({
      _id: 'x',
      requestId: '507f1f77bcf86cd799439011',
      providerUserId: 'p1',
      clientUserId: 'c1',
      status: 'pending',
    });

    const res: any = await service.createForProvider('p1', '507f1f77bcf86cd799439011');

    expect(responseModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: '507f1f77bcf86cd799439011',
        providerUserId: 'p1',
        clientUserId: 'c1',
        status: 'pending',
      }),
    );
    expect(res.status).toBe('pending');
  });

  it('createForProvider maps duplicate key to Conflict', async () => {
    providerModelMock.findOne.mockReturnValue(
      execWrap({ userId: 'p1', isBlocked: false, status: 'active', cityId: 'Berlin', serviceKeys: ['home_cleaning'] }),
    );
    requestModelMock.findById.mockReturnValue(
      execWrap({ _id: '507f1f77bcf86cd799439011', clientId: 'c1', status: 'published', cityId: 'Berlin', serviceKey: 'home_cleaning' }),
    );
    responseModelMock.create.mockRejectedValue({ code: 11000 });

    await expect(service.createForProvider('p1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('listMy supports status filter', async () => {
  responseModelMock.aggregate.mockReturnValue(execWrap([]));

  await service.listMy('p1', { status: 'pending' });

  expect(responseModelMock.aggregate).toHaveBeenCalled();
  const pipeline = responseModelMock.aggregate.mock.calls[0][0];
  expect(pipeline[0]).toEqual({ $match: { providerUserId: 'p1', status: 'pending' } });
});


  it('listByRequestForClient forbids if not owner', async () => {
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientId: 'other' }));
    await expect(service.listByRequestForClient('c1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('acceptForClient locks request, accepts one and rejects others', async () => {
    const respDoc: any = { _id: '507f1f77bcf86cd799439012', requestId: '507f1f77bcf86cd799439011', providerUserId: 'p1', status: 'pending' };
    responseModelMock.findById.mockReturnValue(execWrap(respDoc));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: '507f1f77bcf86cd799439011', clientId: 'c1', status: 'published', matchedProviderUserId: null }));
    requestModelMock.updateOne.mockReturnValue(execWrap({ modifiedCount: 1 }));
    responseModelMock.updateOne.mockReturnValue(execWrap({ modifiedCount: 1 }));
    responseModelMock.updateMany.mockReturnValue(execWrap({ modifiedCount: 1 }));

    await service.acceptForClient('c1', '507f1f77bcf86cd799439012');

    expect(requestModelMock.updateOne).toHaveBeenCalled();
    expect(responseModelMock.updateOne).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439012' },
      { $set: { status: 'accepted' } },
    );
    expect(responseModelMock.updateMany).toHaveBeenCalled();
  });

  it('rejectForClient sets rejected (pending)', async () => {
    const respDoc: any = { _id: '507f1f77bcf86cd799439012', requestId: '507f1f77bcf86cd799439011', status: 'pending' };
    responseModelMock.findById.mockReturnValue(execWrap(respDoc));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: '507f1f77bcf86cd799439011', clientId: 'c1', status: 'published' }));
    responseModelMock.updateOne.mockReturnValue(execWrap({ modifiedCount: 1 }));

    await service.rejectForClient('c1', '507f1f77bcf86cd799439012');

    expect(responseModelMock.updateOne).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439012' },
      { $set: { status: 'rejected' } },
    );
  });

  it('rejectForClient forbids rejecting accepted', async () => {
    const respDoc: any = { _id: '507f1f77bcf86cd799439012', requestId: '507f1f77bcf86cd799439011', status: 'accepted' };
    responseModelMock.findById.mockReturnValue(execWrap(respDoc));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: '507f1f77bcf86cd799439011', clientId: 'c1', status: 'published' }));

    await expect(service.rejectForClient('c1', '507f1f77bcf86cd799439012')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
