// src/modules/offers/offers.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { OffersService } from './offers.service';
import { Offer } from './schemas/offer.schema';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';
import { Request } from '../requests/schemas/request.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('OffersService', () => {
  let service: OffersService;

  const offerModelMock = {
    create: jest.fn(),
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

  const contractModelMock = {
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const execWrap = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    jest.clearAllMocks();

    offerModelMock.countDocuments.mockReturnValue(execWrap(0));

    const moduleRef = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: getModelToken(Offer.name), useValue: offerModelMock },
        { provide: getModelToken(ProviderProfile.name), useValue: providerModelMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
        { provide: getModelToken(Contract.name), useValue: contractModelMock },
      ],
    }).compile();

    service = moduleRef.get(OffersService);
  });

  it('createForProvider throws if provider missing', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap(null));
    await expect(service.createForProvider('p1', { requestId: '507f1f77bcf86cd799439011' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('createForProvider enforces daily limit', async () => {
    offerModelMock.countDocuments.mockReturnValue(execWrap(30));
    await expect(service.createForProvider('p1', { requestId: '507f1f77bcf86cd799439011' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('createForProvider throws if provider blocked', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: true, status: 'active' }));
    await expect(service.createForProvider('p1', { requestId: '507f1f77bcf86cd799439011' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('createForProvider throws if provider not active', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'draft' }));
    await expect(service.createForProvider('p1', { requestId: '507f1f77bcf86cd799439011' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('createForProvider throws if request missing', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'active', serviceKeys: ['home_cleaning'], cityId: 'Berlin' }));
    requestModelMock.findById.mockReturnValue(execWrap(null));

    await expect(service.createForProvider('p1', { requestId: '507f1f77bcf86cd799439011' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('createForProvider throws if request not published', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'active', serviceKeys: ['home_cleaning'], cityId: 'Berlin' }));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientId: 'c1', status: 'draft', cityId: 'Berlin', serviceKey: 'home_cleaning' }));

    await expect(service.createForProvider('p1', { requestId: '507f1f77bcf86cd799439011' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('createForProvider creates sent offer', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'active', serviceKeys: ['home_cleaning'], cityId: 'Berlin' }));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: '507f1f77bcf86cd799439011', clientId: 'c1', status: 'published', cityId: 'Berlin', serviceKey: 'home_cleaning' }));
    offerModelMock.create.mockResolvedValue({ _id: 'x', requestId: '507f1f77bcf86cd799439011', providerUserId: 'p1', clientUserId: 'c1', status: 'sent' });

    const res: any = await service.createForProvider('p1', { requestId: '507f1f77bcf86cd799439011' });
    expect(offerModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: '507f1f77bcf86cd799439011',
        providerUserId: 'p1',
        clientUserId: 'c1',
        status: 'sent',
      }),
    );
    expect(res.status).toBe('sent');
  });

  it('createForProvider maps duplicate key to Conflict', async () => {
    providerModelMock.findOne.mockReturnValue(execWrap({ userId: 'p1', isBlocked: false, status: 'active', serviceKeys: ['home_cleaning'], cityId: 'Berlin' }));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: '507f1f77bcf86cd799439011', clientId: 'c1', status: 'published', cityId: 'Berlin', serviceKey: 'home_cleaning' }));
    offerModelMock.create.mockRejectedValue({ code: 11000 });

    await expect(service.createForProvider('p1', { requestId: '507f1f77bcf86cd799439011' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('listMy supports status filter', async () => {
    offerModelMock.aggregate.mockReturnValue(execWrap([]));
    await service.listMy('p1', { status: 'sent' });
    expect(offerModelMock.aggregate).toHaveBeenCalled();
  });

  it('listByRequestForClient forbids if not owner', async () => {
    requestModelMock.findById.mockReturnValue(execWrap({ _id: '507f1f77bcf86cd799439011', clientId: 'other' }));
    await expect(service.listByRequestForClient('c1', '507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('acceptForClient locks request, accepts one and declines others', async () => {
    const offerDoc: any = {
      _id: { toString: () => 'offer1' },
      requestId: '507f1f77bcf86cd799439011',
      providerUserId: 'p1',
      status: 'sent',
    };

    offerModelMock.findById.mockReturnValue(execWrap(offerDoc));
    requestModelMock.findById.mockReturnValue(execWrap({
      _id: '507f1f77bcf86cd799439011',
      clientId: 'c1',
      status: 'published',
      matchedProviderUserId: null,
      preferredDate: new Date('2026-01-29T10:00:00.000Z'),
    }));

    requestModelMock.updateOne.mockReturnValue(execWrap({ modifiedCount: 1 }));
    offerModelMock.updateOne.mockReturnValue(execWrap({ modifiedCount: 1 }));
    offerModelMock.updateMany.mockReturnValue(execWrap({ modifiedCount: 1 }));
    contractModelMock.findOne.mockReturnValue(execWrap(null));
    contractModelMock.create.mockResolvedValue({ _id: 'c1' });

    await service.acceptForClient('c1', '507f1f77bcf86cd799439012');

    expect(requestModelMock.updateOne).toHaveBeenCalled();
    expect(offerModelMock.updateOne).toHaveBeenCalledWith(
      { _id: offerDoc._id },
      { $set: { status: 'accepted' } },
    );
    expect(contractModelMock.create).toHaveBeenCalled();
    expect(offerModelMock.updateMany).toHaveBeenCalled();
  });

  it('declineForClient forbids declining accepted', async () => {
    offerModelMock.findById.mockReturnValue(execWrap({
      _id: 'offer1',
      requestId: '507f1f77bcf86cd799439011',
      status: 'accepted',
    }));
    requestModelMock.findById.mockReturnValue(execWrap({
      _id: '507f1f77bcf86cd799439011',
      clientId: 'c1',
      status: 'published',
    }));

    await expect(service.declineForClient('c1', '507f1f77bcf86cd799439012')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
