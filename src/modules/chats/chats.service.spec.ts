// src/modules/chats/chats.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ChatsService } from './chats.service';
import { Chat } from './schemas/chat.schema';
import { Request } from '../requests/schemas/request.schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ChatsService', () => {
  let service: ChatsService;

  const chatModelMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  };

  const requestModelMock = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatsService,
        { provide: getModelToken(Chat.name), useValue: chatModelMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
      ],
    }).compile();

    service = moduleRef.get(ChatsService);
  });

  it('createOrGet returns existing chat if found', async () => {
    chatModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'c1' }) });

    const res = await service.createOrGet({
      requestId: '507f1f77bcf86cd799439011',
      clientId: '507f1f77bcf86cd799439012',
      providerUserId: '507f1f77bcf86cd799439013',
    });

    expect(res).toEqual({ _id: 'c1' });
    expect(chatModelMock.create).not.toHaveBeenCalled();
    expect(requestModelMock.findById).not.toHaveBeenCalled();
  });

  it('createOrGet creates chat when not exists and request matches clientId', async () => {
    chatModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    requestModelMock.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'r1', clientId: '507f1f77bcf86cd799439012' }),
    });
    chatModelMock.create.mockResolvedValue({ _id: 'c2' });

    const res = await service.createOrGet({
      requestId: '507f1f77bcf86cd799439011',
      clientId: '507f1f77bcf86cd799439012',
      providerUserId: '507f1f77bcf86cd799439013',
    });

    expect(chatModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: '507f1f77bcf86cd799439011',
        clientId: '507f1f77bcf86cd799439012',
        providerUserId: '507f1f77bcf86cd799439013',
        participants: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'],
        lastMessageAt: null,
      }),
    );
    expect(res).toEqual({ _id: 'c2' });
  });

  it('createOrGet throws when request clientId does not match', async () => {
    chatModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    requestModelMock.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'r1', clientId: '507f1f77bcf86cd799439099' }),
    });

    await expect(
      service.createOrGet({
        requestId: '507f1f77bcf86cd799439011',
        clientId: '507f1f77bcf86cd799439012',
        providerUserId: '507f1f77bcf86cd799439013',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getMyChats throws when userId is missing', async () => {
    await expect(service.getMyChats('')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getById throws for invalid id', async () => {
    await expect(service.getById('bad-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getById throws when not found', async () => {
    chatModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    await expect(service.getById('507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(NotFoundException);
  });
});
