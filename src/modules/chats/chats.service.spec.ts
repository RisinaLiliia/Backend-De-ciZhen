// src/modules/chats/chats.service.spec.ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { ChatThread } from './schemas/chat-thread.schema';
import { ChatMessage } from './schemas/chat-message.schema';
import { Request } from '../requests/schemas/request.schema';
import { Offer } from '../offers/schemas/offer.schema';
import { Contract } from '../contracts/schemas/contract.schema';
import { User } from '../users/schemas/user.schema';

const requestId = '507f1f77bcf86cd799439011';
const providerId = '507f1f77bcf86cd799439012';
const clientId = '507f1f77bcf86cd799439013';
const conversationId = '507f1f77bcf86cd799439014';

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
    updateMany: jest.fn(),
  };

  const requestModelMock = {
    findById: jest.fn(),
    find: jest.fn(),
  };

  const offerModelMock = {
    findById: jest.fn(),
    find: jest.fn(),
  };

  const contractModelMock = {
    findById: jest.fn(),
    find: jest.fn(),
  };

  const userModelMock = {
    find: jest.fn(),
  };

  const gatewayMock = {
    emitMessageCreated: jest.fn(),
    emitMessageRead: jest.fn(),
    emitConversationUpdated: jest.fn(),
  };

  const execWrap = <T>(value: T) => ({ exec: jest.fn().mockResolvedValue(value) });
  const selectLeanExecWrap = <T>(value: T) => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatsService,
        { provide: getModelToken(ChatThread.name), useValue: threadModelMock },
        { provide: getModelToken(ChatMessage.name), useValue: messageModelMock },
        { provide: getModelToken(Request.name), useValue: requestModelMock },
        { provide: getModelToken(Offer.name), useValue: offerModelMock },
        { provide: getModelToken(Contract.name), useValue: contractModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: ChatsGateway, useValue: gatewayMock },
      ],
    }).compile();

    service = moduleRef.get(ChatsService);
  });

  it('creates a conversation with request context and participant snapshots', async () => {
    requestModelMock.findById.mockReturnValue(
      execWrap({
        _id: requestId,
        clientId,
        title: 'Need cleaning',
        cityName: 'Frankfurt am Main',
        status: 'published',
        price: 180,
      }),
    );
    userModelMock.find.mockReturnValue(
      selectLeanExecWrap([
        { _id: clientId, name: 'Client Chat', avatar: { url: '/client.png' }, lastSeenAt: null },
        { _id: providerId, name: 'Provider Chat', avatar: { url: '/provider.png' }, lastSeenAt: null },
      ]),
    );
    threadModelMock.findOne.mockReturnValue(execWrap(null));
    threadModelMock.create.mockResolvedValue({ _id: conversationId });

    const result = await service.createOrGetConversation({
      relatedEntity: { type: 'request', id: requestId },
      requestId,
      participantUserId: providerId,
      participantRole: 'provider',
      providerUserId: providerId,
      actorUserId: clientId,
      actorRole: 'client',
    });

    expect(threadModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        clientId,
        providerUserId: providerId,
        relatedEntity: expect.objectContaining({
          type: 'request',
          id: requestId,
          title: 'Need cleaning',
          subtitle: 'Frankfurt am Main',
        }),
        participantEntries: [
          { userId: clientId, role: 'customer' },
          { userId: providerId, role: 'provider' },
        ],
      }),
    );
    expect(result).toEqual({ _id: conversationId });
  });

  it('forbids conversation creation when actor does not own the client side', async () => {
    requestModelMock.findById.mockReturnValue(
      execWrap({
        _id: requestId,
        clientId,
        title: 'Need cleaning',
        cityName: 'Frankfurt am Main',
        status: 'published',
        price: 180,
      }),
    );
    userModelMock.find.mockReturnValue(selectLeanExecWrap([]));

    await expect(
      service.createOrGetConversation({
        relatedEntity: { type: 'request', id: requestId },
        requestId,
        participantUserId: providerId,
        providerUserId: providerId,
        actorUserId: '507f1f77bcf86cd799439099',
        actorRole: 'client',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sends a message, updates unread counts, and emits realtime events', async () => {
    const baseThread = {
      _id: conversationId,
      requestId,
      clientId,
      providerUserId: providerId,
      participants: [clientId, providerId],
      unreadCount: { [clientId]: 0, [providerId]: 0 },
      status: 'active',
      relatedEntity: { type: 'request', id: requestId, requestId },
      offerId: null,
      contractId: null,
      createdAt: new Date('2026-03-31T17:00:00.000Z'),
      updatedAt: new Date('2026-03-31T17:00:00.000Z'),
    };

    threadModelMock.findById
      .mockReturnValueOnce(execWrap(baseThread))
      .mockReturnValueOnce(
        execWrap({
          ...baseThread,
          lastMessage: {
            messageId: '507f1f77bcf86cd799439015',
            text: 'Hello!',
            createdAt: new Date('2026-03-31T17:01:00.000Z'),
            senderId: providerId,
          },
          lastMessagePreview: 'Hello!',
          lastMessageAt: new Date('2026-03-31T17:01:00.000Z'),
          unreadCount: { [clientId]: 1, [providerId]: 0 },
          updatedAt: new Date('2026-03-31T17:01:00.000Z'),
        }),
      );
    messageModelMock.create.mockResolvedValue({
      _id: '507f1f77bcf86cd799439015',
      conversationId,
      threadId: conversationId,
      senderId: providerId,
      type: 'text',
      text: 'Hello!',
      attachments: [],
      deliveryStatus: 'sent',
      createdAt: new Date('2026-03-31T17:01:00.000Z'),
    });
    messageModelMock.updateMany.mockReturnValue(execWrap({ modifiedCount: 0 }));
    threadModelMock.updateOne.mockReturnValue(execWrap({ modifiedCount: 1 }));
    requestModelMock.findById.mockReturnValue(
      selectLeanExecWrap({
        _id: requestId,
        title: 'Need cleaning',
        cityName: 'Frankfurt am Main',
      }),
    );
    requestModelMock.find.mockReturnValue(
      selectLeanExecWrap([
        {
          _id: requestId,
          title: 'Need cleaning',
          cityName: 'Frankfurt am Main',
          status: 'published',
          price: 180,
        },
      ]),
    );
    offerModelMock.find.mockReturnValue(selectLeanExecWrap([]));
    contractModelMock.find.mockReturnValue(selectLeanExecWrap([]));
    userModelMock.find.mockReturnValue(
      selectLeanExecWrap([
        { _id: clientId, name: 'Client Chat', avatar: { url: '/client.png' }, lastSeenAt: null },
        { _id: providerId, name: 'Provider Chat', avatar: { url: '/provider.png' }, lastSeenAt: null },
      ]),
    );

    const result = await service.sendMessage(conversationId, providerId, { text: 'Hello!' });

    expect(result).toMatchObject({ text: 'Hello!', senderId: providerId });
    expect(threadModelMock.updateOne).toHaveBeenCalledWith(
      { _id: conversationId },
      expect.objectContaining({
        $set: expect.objectContaining({
          unreadCount: { [clientId]: 1, [providerId]: 0 },
          lastMessagePreview: 'Hello!',
        }),
      }),
    );
    expect(gatewayMock.emitMessageCreated).toHaveBeenCalled();
    expect(gatewayMock.emitConversationUpdated).toHaveBeenCalled();
  });

  it('marks conversation as read and emits read event', async () => {
    const thread = {
      _id: conversationId,
      requestId,
      clientId,
      providerUserId: providerId,
      participants: [clientId, providerId],
      unreadCount: { [clientId]: 2, [providerId]: 0 },
      status: 'active',
      relatedEntity: { type: 'request', id: requestId, requestId },
      offerId: null,
      contractId: null,
      createdAt: new Date('2026-03-31T17:00:00.000Z'),
      updatedAt: new Date('2026-03-31T17:00:00.000Z'),
    };

    threadModelMock.findById
      .mockReturnValueOnce(execWrap(thread))
      .mockReturnValueOnce(
        execWrap({
          ...thread,
          unreadCount: { [clientId]: 0, [providerId]: 0 },
          updatedAt: new Date('2026-03-31T17:02:00.000Z'),
        }),
      );
    messageModelMock.updateMany.mockReturnValue(execWrap({ modifiedCount: 2 }));
    threadModelMock.updateOne.mockReturnValue(execWrap({ modifiedCount: 1 }));
    requestModelMock.find.mockReturnValue(
      selectLeanExecWrap([
        {
          _id: requestId,
          title: 'Need cleaning',
          cityName: 'Frankfurt am Main',
          status: 'published',
          price: 180,
        },
      ]),
    );
    offerModelMock.find.mockReturnValue(selectLeanExecWrap([]));
    contractModelMock.find.mockReturnValue(selectLeanExecWrap([]));
    userModelMock.find.mockReturnValue(
      selectLeanExecWrap([
        { _id: clientId, name: 'Client Chat', avatar: { url: '/client.png' }, lastSeenAt: null },
        { _id: providerId, name: 'Provider Chat', avatar: { url: '/provider.png' }, lastSeenAt: null },
      ]),
    );

    const result = await service.markRead(conversationId, clientId);

    expect(result).toMatchObject({ _id: conversationId });
    expect(threadModelMock.updateOne).toHaveBeenCalledWith(
      { _id: conversationId },
      expect.objectContaining({
        $set: expect.objectContaining({
          unreadCount: { [clientId]: 0, [providerId]: 0 },
        }),
      }),
    );
    expect(messageModelMock.updateMany).toHaveBeenCalled();
    expect(gatewayMock.emitMessageRead).toHaveBeenCalled();
    expect(gatewayMock.emitConversationUpdated).toHaveBeenCalled();
  });

  it('serializes viewer-specific counterpart and unread helper fields', async () => {
    const thread = {
      _id: conversationId,
      requestId,
      clientId,
      providerUserId: providerId,
      participants: [clientId, providerId],
      unreadCount: { [clientId]: 2, [providerId]: 0 },
      status: 'active',
      relatedEntity: { type: 'request', id: requestId, requestId, title: 'Need cleaning' },
      lastMessage: {
        messageId: '507f1f77bcf86cd799439015',
        text: 'Hello!',
        createdAt: new Date('2026-03-31T17:01:00.000Z'),
        senderId: providerId,
      },
      lastMessagePreview: 'Hello!',
      offerId: null,
      contractId: null,
      createdAt: new Date('2026-03-31T17:00:00.000Z'),
      updatedAt: new Date('2026-03-31T17:01:00.000Z'),
    };

    requestModelMock.find.mockReturnValue(
      selectLeanExecWrap([
        {
          _id: requestId,
          title: 'Need cleaning',
          cityName: 'Frankfurt am Main',
          status: 'published',
          price: 180,
        },
      ]),
    );
    offerModelMock.find.mockReturnValue(selectLeanExecWrap([]));
    contractModelMock.find.mockReturnValue(selectLeanExecWrap([]));
    userModelMock.find.mockReturnValue(
      selectLeanExecWrap([
        { _id: clientId, name: 'Client Chat', avatar: { url: '/client.png' }, lastSeenAt: null },
        { _id: providerId, name: 'Provider Chat', avatar: { url: '/provider.png' }, lastSeenAt: null },
      ]),
    );

    const [serialized] = await service.serializeConversations([thread as any], clientId);

    expect(serialized).toMatchObject({
      counterpart: {
        userId: providerId,
        role: 'provider',
        displayName: 'Provider Chat',
      },
      unread: 2,
      lastMessagePreview: 'Hello!',
    });
  });

  it('rejects empty message payloads', async () => {
    const thread = {
      _id: conversationId,
      requestId,
      clientId,
      providerUserId: providerId,
      participants: [clientId, providerId],
      unreadCount: { [clientId]: 0, [providerId]: 0 },
      status: 'active',
      relatedEntity: { type: 'request', id: requestId, requestId },
    };
    threadModelMock.findById.mockReturnValue(execWrap(thread));

    await expect(
      service.sendMessage(conversationId, providerId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
