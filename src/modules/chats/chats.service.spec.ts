// src/modules/chats/chats.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ChatsService } from './chats.service';
import { ChatThread } from './schemas/chat-thread.schema';
import { ChatMessage } from './schemas/chat-message.schema';
import { Request } from '../requests/schemas/request.schema';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ChatsService', () => {
  let service: ChatsService;

  const threadModelMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
  };

  const messageModelMock = {
    create: jest.fn(),
    find: jest.fn(),
  };

  const requestModelMock = {
    findById: jest.fn(),
  };

  const execWrap = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatsService,
        { provide: getModelToken(ChatThread.name), useValue: threadModelMock },
        { provide: getModelToken(ChatMessage.name), useValue: messageModelMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
      ],
    }).compile();

    service = moduleRef.get(ChatsService);
  });

  it('createOrGetThread returns existing thread', async () => {
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientId: 'c1' }));
    threadModelMock.findOne.mockReturnValue(execWrap({ _id: 't1' }));

    const res = await service.createOrGetThread({
      requestId: '507f1f77bcf86cd799439011',
      providerUserId: '507f1f77bcf86cd799439012',
      actorUserId: '507f1f77bcf86cd799439012',
      actorRole: 'provider',
    });

    expect(res).toEqual({ _id: 't1' });
    expect(threadModelMock.create).not.toHaveBeenCalled();
  });

  it('createOrGetThread creates when not exists and validates request', async () => {
    threadModelMock.findOne.mockReturnValue(execWrap(null));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientId: 'c1' }));
    threadModelMock.create.mockResolvedValue({ _id: 't2' });

    const res = await service.createOrGetThread({
      requestId: '507f1f77bcf86cd799439011',
      providerUserId: '507f1f77bcf86cd799439012',
      actorUserId: 'c1',
      actorRole: 'client',
    });

    expect(threadModelMock.create).toHaveBeenCalled();
    expect(res).toEqual({ _id: 't2' });
  });

  it('createOrGetThread forbids when actor does not match', async () => {
    threadModelMock.findOne.mockReturnValue(execWrap(null));
    requestModelMock.findById.mockReturnValue(execWrap({ _id: 'r1', clientId: 'c1' }));

    await expect(
      service.createOrGetThread({
        requestId: '507f1f77bcf86cd799439011',
        providerUserId: '507f1f77bcf86cd799439012',
        actorUserId: 'other',
        actorRole: 'client',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listInbox throws when userId missing', async () => {
    await expect(service.listInbox('', 'all')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getThreadById throws when not found', async () => {
    threadModelMock.findById.mockReturnValue(execWrap(null));
    await expect(service.getThreadById('507f1f77bcf86cd799439011', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getThreadById forbids non participant', async () => {
    threadModelMock.findById.mockReturnValue(execWrap({ participants: ['u2'] }));
    await expect(service.getThreadById('507f1f77bcf86cd799439011', 'u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sendMessage creates message and updates thread', async () => {
    threadModelMock.findById.mockReturnValue(
      execWrap({ _id: 't1', clientId: 'c1', providerUserId: 'p1', participants: ['c1', 'p1'] }),
    );
    messageModelMock.create.mockResolvedValue({ _id: 'm1', createdAt: new Date() });
    threadModelMock.updateOne.mockReturnValue(execWrap({ modifiedCount: 1 }));

    await service.sendMessage('507f1f77bcf86cd799439011', 'c1', 'hi');
    expect(messageModelMock.create).toHaveBeenCalled();
    expect(threadModelMock.updateOne).toHaveBeenCalled();
  });
});
