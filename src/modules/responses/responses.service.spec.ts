import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResponsesService } from './responses.service';
import { Response as Resp } from './schemas/response.schema';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';
import { Request } from '../requests/schemas/request.schema';
import { ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('ResponsesService', () => {
  let service: ResponsesService;

  const responseModelMock = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
  };

  const providerModelMock = {
    findOne: jest.fn(),
  };

  const requestModelMock = {
    findById: jest.fn(),
  };

  const execWrap = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    jest.clearAllMocks();

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
    await expect(service.createForProvider('p1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createForProvider throws if provider blocked', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: true, status: 'active' }));
    await expect(service.createForProvider('p1', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createForProvider throws if provider not active', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'draft' }));
    await expect(service.createForProvider('p1', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createForProvider throws if request missing', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'active' }));
    requestModelMock.findById.mockReturnValue(execWrap(null));
    await expect(service.createForProvider('p1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createForProvider creates pending response', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'active' }));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientUserId: 'c1', status: 'open' }));
    responseModelMock.create.mockResolvedValue({ _id: 'x', requestId: 'r1', providerUserId: 'p1', clientUserId: 'c1', status: 'pending' });

    const res: any = await service.createForProvider('p1', 'r1');
    expect(responseModelMock.create).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'r1',
      providerUserId: 'p1',
      clientUserId: 'c1',
      status: 'pending',
    }));
    expect(res.status).toBe('pending');
  });

  it('createForProvider maps duplicate key to Conflict', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'active' }));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientUserId: 'c1', status: 'open' }));
    responseModelMock.create.mockRejectedValue({ code: 11000 });

    await expect(service.createForProvider('p1', 'r1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('listMy returns sorted list', async () => {
    responseModelMock.find.mockReturnValue({ sort: jest.fn().mockReturnValue(execWrap([])) });
    await service.listMy('p1');
    expect(responseModelMock.find).toHaveBeenCalledWith({ providerUserId: 'p1' });
  });

  it('listByRequestForClient forbids if not owner', async () => {
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientUserId: 'other' }));
    await expect(service.listByRequestForClient('c1', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('acceptForClient accepts one and rejects others', async () => {
    const respDoc: any = { _id: { toString: () => 'resp1' }, requestId: 'r1', status: 'pending', save: jest.fn() };
    responseModelMock.findById.mockReturnValue(execWrap(respDoc));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientUserId: 'c1', status: 'open', save: jest.fn() }));
    responseModelMock.findOne.mockReturnValue(execWrap(null));
    responseModelMock.updateMany.mockReturnValue(execWrap({ modifiedCount: 1 }));

    await service.acceptForClient('c1', 'resp1');

    expect(respDoc.status).toBe('accepted');
    expect(respDoc.save).toHaveBeenCalled();
    expect(responseModelMock.updateMany).toHaveBeenCalledWith(
      { requestId: 'r1', _id: { $ne: respDoc._id }, status: 'pending' },
      { $set: { status: 'rejected' } },
    );
  });

  it('acceptForClient throws if already accepted exists', async () => {
    const respDoc: any = { _id: { toString: () => 'resp1' }, requestId: 'r1', status: 'pending', save: jest.fn() };
    responseModelMock.findById.mockReturnValue(execWrap(respDoc));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientUserId: 'c1', status: 'open' }));
    responseModelMock.findOne.mockReturnValue(execWrap({ _id: { toString: () => 'resp2' } }));

    await expect(service.acceptForClient('c1', 'resp1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
