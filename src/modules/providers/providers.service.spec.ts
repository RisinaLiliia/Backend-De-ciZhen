// src/modules/providers/providers.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProvidersService } from './providers.service';
import { ProviderProfile } from './schemas/provider-profile.schema';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ProvidersService', () => {
  let service: ProvidersService;

  const modelMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
  };

  const execWrap = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProvidersService,
        { provide: getModelToken(ProviderProfile.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(ProvidersService);
  });

  it('getOrCreateMyProfile returns existing', async () => {
    modelMock.findOne.mockReturnValue(execWrap({ userId: 'u1' }));
    const res = await service.getOrCreateMyProfile('u1');
    expect(res.userId).toBe('u1');
    expect(modelMock.create).not.toHaveBeenCalled();
  });

  it('getOrCreateMyProfile creates if missing', async () => {
    modelMock.findOne.mockReturnValueOnce(execWrap(null));
    modelMock.create.mockResolvedValue({ userId: 'u1', status: 'draft' });

    const res: any = await service.getOrCreateMyProfile('u1');
    expect(modelMock.create).toHaveBeenCalled();
    expect(res.status).toBe('draft');
  });

  it('updateMyProfile throws NotFound if missing', async () => {
    modelMock.findOne.mockReturnValue(execWrap(null));
    await expect(service.updateMyProfile('u1', { displayName: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateMyProfile throws Forbidden if blocked', async () => {
    modelMock.findOne.mockReturnValue(execWrap({ userId: 'u1', isBlocked: true }));
    await expect(service.updateMyProfile('u1', { displayName: 'X' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blockProfile throws NotFound if missing', async () => {
    modelMock.findOneAndUpdate.mockReturnValue(execWrap(null));
    await expect(service.blockProfile('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listPublic returns active + not blocked', async () => {
    modelMock.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    });

    await service.listPublic({});

    expect(modelMock.find).toHaveBeenLastCalledWith({
      status: 'active',
      isBlocked: false,
    });
  });

  it('listPublic adds cityId and serviceKey only when not empty', async () => {
    const sort = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    modelMock.find.mockReturnValue({ sort });

    await service.listPublic({ cityId: '  ', serviceKey: '  ' });
    expect(modelMock.find).toHaveBeenCalledWith({ status: 'active', isBlocked: false });

    await service.listPublic({ cityId: 'c1', serviceKey: 'Home_Cleaning' });
    expect(modelMock.find).toHaveBeenLastCalledWith({
      status: 'active',
      isBlocked: false,
      cityId: 'c1',
      serviceKeys: { $in: ['home_cleaning'] },
    });
  });
});
