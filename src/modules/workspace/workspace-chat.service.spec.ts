import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { ChatsService } from '../chats/chats.service';
import { ChatThread } from '../chats/schemas/chat-thread.schema';
import { WorkspaceChatService } from './workspace-chat.service';

describe('WorkspaceChatService (unit)', () => {
  let service: WorkspaceChatService;
  let nowSpy: jest.SpyInstance<number, []>;

  const countExecMocks: Array<jest.Mock> = [];
  const countDocumentsMock = jest.fn();
  const findExecMock = jest.fn();
  const findLimitMock = jest.fn(() => ({ exec: findExecMock }));
  const findSortMock = jest.fn(() => ({ limit: findLimitMock }));
  const findMock = jest.fn(() => ({ sort: findSortMock }));
  const threadModelMock = {
    countDocuments: countDocumentsMock,
    find: findMock,
  };

  const chatsMock = {
    serializeConversations: jest.fn(),
  };

  function mockCountDocuments(...values: number[]) {
    countExecMocks.length = 0;
    countDocumentsMock.mockReset();
    values.forEach((value) => {
      const exec = jest.fn().mockResolvedValue(value);
      countExecMocks.push(exec);
      countDocumentsMock.mockReturnValueOnce({ exec });
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-01T12:00:00.000Z').getTime());

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceChatService,
        { provide: getModelToken(ChatThread.name), useValue: threadModelMock },
        { provide: ChatsService, useValue: chatsMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceChatService);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('returns unread-first chat rail data with a reply queue and unread CTA', async () => {
    mockCountDocuments(8, 6, 2, 3);
    const threads = [{ id: 'thread-1' }, { id: 'thread-2' }];
    findExecMock.mockResolvedValue(threads);
    chatsMock.serializeConversations.mockResolvedValue([
      {
        id: 'conv-1',
        unread: 3,
        updatedAt: '2026-06-01T10:30:00.000Z',
        counterpart: { displayName: 'Anna Schneider' },
        relatedEntity: { title: 'Badrenovierung in Karlsruhe' },
      },
      {
        id: 'conv-2',
        unread: 0,
        updatedAt: '2026-05-31T15:00:00.000Z',
        counterpart: { displayName: 'Mark Weber' },
        relatedEntity: { title: 'Fensterreinigung in Berlin' },
      },
    ]);

    const result = await service.getChatRail('user-1', 'de-DE');

    expect(countDocumentsMock).toHaveBeenNthCalledWith(1, { participants: 'user-1' });
    expect(countDocumentsMock).toHaveBeenNthCalledWith(2, { participants: 'user-1', status: 'active' });
    expect(countDocumentsMock).toHaveBeenNthCalledWith(3, { participants: 'user-1', status: 'archived' });
    expect(countDocumentsMock).toHaveBeenNthCalledWith(4, {
      participants: 'user-1',
      $or: [
        { clientId: 'user-1', unreadClientCount: { $gt: 0 } },
        { providerUserId: 'user-1', unreadProviderCount: { $gt: 0 } },
      ],
    });
    expect(findMock).toHaveBeenCalledWith({
      participants: 'user-1',
      status: { $in: ['active', 'archived'] },
    });
    expect(findSortMock).toHaveBeenCalledWith({ updatedAt: -1, _id: -1 });
    expect(findLimitMock).toHaveBeenCalledWith(24);
    expect(chatsMock.serializeConversations).toHaveBeenCalledWith(threads, 'user-1');
    expect(result.summary.items).toEqual([
      expect.objectContaining({ key: 'all', value: 8 }),
      expect.objectContaining({ key: 'unread', value: 3, tone: 'attention' }),
      expect.objectContaining({ key: 'active', value: 6 }),
      expect.objectContaining({ key: 'archived', value: 2 }),
    ]);
    expect(result.decisionPanel.primaryAction).toEqual({
      label: 'Ungelesene öffnen',
      href: '/workspace?section=chat&filter=unread',
      targetFilter: 'unread',
    });
    expect(result.decisionPanel.queue).toEqual([
      expect.objectContaining({
        conversationId: 'conv-1',
        title: 'Anna Schneider',
        actionType: 'reply',
        actionLabel: '3 ungelesen',
        actionPriorityLevel: 'high',
        actionReason: 'Bezogen auf: Badrenovierung in Karlsruhe',
      }),
      expect.objectContaining({
        conversationId: 'conv-2',
        actionType: 'review_context',
        actionPriorityLevel: 'medium',
      }),
    ]);
  });

  it('returns a clear inbox state when there are no unread conversations', async () => {
    mockCountDocuments(4, 4, 0, 0);
    findExecMock.mockResolvedValue([{ id: 'thread-1' }]);
    chatsMock.serializeConversations.mockResolvedValue([
      {
        id: 'conv-1',
        unread: 0,
        updatedAt: '2026-05-31T14:00:00.000Z',
        counterpart: { displayName: 'Chris Miller' },
        relatedEntity: { title: 'Malerarbeiten in Hamburg' },
      },
    ]);

    const result = await service.getChatRail('user-2', 'en-US');

    expect(result.decisionPanel.totalNeedsAction).toBe(0);
    expect(result.decisionPanel.title).toBe('No replies pending');
    expect(result.decisionPanel.primaryAction).toEqual({
      label: 'Open all chats',
      href: '/workspace?section=chat',
      targetFilter: 'all',
    });
    expect(result.decisionPanel.queue).toEqual([
      expect.objectContaining({
        conversationId: 'conv-1',
        actionType: 'review_context',
        actionLabel: 'Active thread',
        actionPriorityLevel: 'medium',
      }),
    ]);
    expect(result.summary.items[1]).toEqual(
      expect.objectContaining({ key: 'unread', value: 0, tone: 'completed' }),
    );
  });

  it('keeps archived conversations in summary and classifies stale threads as follow-up', async () => {
    mockCountDocuments(7, 3, 4, 0);
    findExecMock.mockResolvedValue([{ id: 'thread-1' }]);
    chatsMock.serializeConversations.mockResolvedValue([
      {
        id: 'conv-archive',
        unread: 0,
        updatedAt: '2026-05-20T09:00:00.000Z',
        counterpart: null,
        relatedEntity: { title: null },
      },
    ]);

    const result = await service.getChatRail('user-3', 'en-US');

    expect(result.summary.items).toEqual([
      expect.objectContaining({ key: 'all', value: 7 }),
      expect.objectContaining({ key: 'unread', value: 0 }),
      expect.objectContaining({ key: 'active', value: 3 }),
      expect.objectContaining({ key: 'archived', value: 4, tone: 'completed' }),
    ]);
    expect(result.decisionPanel.overview).toEqual([
      { key: 'unread', label: 'Unread', value: 0 },
      { key: 'active', label: 'Active', value: 3 },
      { key: 'archived', label: 'Archived', value: 4 },
    ]);
    expect(result.decisionPanel.queue).toEqual([
      {
        conversationId: 'conv-archive',
        title: 'Conversation',
        actionType: 'follow_up',
        actionLabel: 'Active thread',
        actionPriority: 30,
        actionPriorityLevel: 'low',
        actionReason: null,
        href: '/workspace?section=chat&conversation=conv-archive',
      },
    ]);
  });
});
