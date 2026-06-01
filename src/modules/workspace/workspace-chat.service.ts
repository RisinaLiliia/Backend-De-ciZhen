import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ChatsService } from '../chats/chats.service';
import { ChatThread, type ChatThreadDocument } from '../chats/schemas/chat-thread.schema';
import type { WorkspaceChatResponseDto } from './dto/workspace-chat-response.dto';
import { WorkspaceRequestsSupport, type WorkspaceRequestsLocale } from './workspace-requests.support';

type RailConversation = Awaited<ReturnType<ChatsService['serializeConversations']>>[number];

@Injectable()
export class WorkspaceChatService {
  private readonly support = new WorkspaceRequestsSupport();

  constructor(
    @InjectModel(ChatThread.name) private readonly threadModel: Model<ChatThreadDocument>,
    private readonly chats: ChatsService,
  ) {}

  private normalizeId(value?: string | null) {
    return String(value ?? '').trim();
  }

  private getCopy(locale: WorkspaceRequestsLocale) {
    if (locale === 'de') {
      return {
        headerTitle: 'Nachrichten',
        headerSubtitle: 'Backend-owned Prioritäten und Inbox-Status für den Workspace Rail.',
        summaryAll: 'Alle Chats',
        summaryUnread: 'Ungelesen',
        summaryActive: 'Aktiv',
        summaryArchived: 'Archiviert',
        summaryAllHelper: 'Im Workspace sichtbar',
        summaryUnreadHelper: 'Antwort zuerst',
        summaryActiveHelper: 'Laufende Konversationen',
        summaryArchivedHelper: 'Später referenzierbar',
        eyebrow: 'Decision Panel',
        titleAttention: 'Konversationen brauchen Antwort',
        titleClear: 'Keine offenen Antworten',
        textAttention: (unread: number, active: number) =>
          `${unread} ungelesene Konversationen, ${active} aktive Threads im Workspace.`,
        textClear: (active: number) =>
          `${active} aktive Threads sind aktuell ohne offene Antwort.`,
        primaryUnread: 'Ungelesene öffnen',
        primaryAll: 'Alle Chats öffnen',
        queueTitle: 'Action Queue',
        queueUnread: (count: number) => `${count} ungelesen`,
        queueActive: 'Aktiver Verlauf',
        queueReasonPrefix: 'Bezogen auf',
        queueEmpty: 'Der Posteingang ist aktuell geklärt.',
        overviewEyebrow: 'Inbox status',
        overviewUnread: 'Ungelesen',
        overviewActive: 'Aktiv',
        overviewArchived: 'Archiviert',
        fallbackConversation: 'Konversation',
      };
    }

    return {
      headerTitle: 'Messages',
      headerSubtitle: 'Backend-owned priorities and inbox status for the workspace rail.',
      summaryAll: 'All chats',
      summaryUnread: 'Unread',
      summaryActive: 'Active',
      summaryArchived: 'Archived',
      summaryAllHelper: 'Visible in workspace',
      summaryUnreadHelper: 'Reply first',
      summaryActiveHelper: 'Ongoing conversations',
      summaryArchivedHelper: 'Kept for reference',
      eyebrow: 'Decision panel',
      titleAttention: 'Conversations need a reply',
      titleClear: 'No replies pending',
      textAttention: (unread: number, active: number) =>
        `${unread} unread conversations, ${active} active threads in workspace.`,
      textClear: (active: number) =>
        `${active} active threads currently have no pending reply.`,
      primaryUnread: 'Open unread',
      primaryAll: 'Open all chats',
      queueTitle: 'Action queue',
      queueUnread: (count: number) => `${count} unread`,
      queueActive: 'Active thread',
      queueReasonPrefix: 'Related to',
      queueEmpty: 'The inbox is currently clear.',
      overviewEyebrow: 'Inbox status',
      overviewUnread: 'Unread',
      overviewActive: 'Active',
      overviewArchived: 'Archived',
      fallbackConversation: 'Conversation',
    };
  }

  private buildViewerUnreadQuery(userId: string) {
    return {
      $or: [
        { clientId: userId, unreadClientCount: { $gt: 0 } },
        { providerUserId: userId, unreadProviderCount: { $gt: 0 } },
      ],
    };
  }

  private getConversationTitle(
    conversation: RailConversation,
    copy: ReturnType<WorkspaceChatService['getCopy']>,
  ) {
    return conversation.counterpart?.displayName
      ?? conversation.counterpart?.userId
      ?? conversation.relatedEntity.title
      ?? copy.fallbackConversation;
  }

  private getConversationReason(
    conversation: RailConversation,
    copy: ReturnType<WorkspaceChatService['getCopy']>,
  ) {
    const relatedTitle = String(conversation.relatedEntity.title ?? '').trim();
    if (!relatedTitle) {
      return null;
    }

    return `${copy.queueReasonPrefix}: ${relatedTitle}`;
  }

  private resolvePriority(unread: number, updatedAt: Date) {
    if (unread > 0) {
      return {
        score: Math.min(100, 70 + unread * 10),
        level: 'high' as const,
        type: 'reply' as const,
      };
    }

    const ageMs = Date.now() - updatedAt.getTime();
    if (ageMs <= 3 * 24 * 60 * 60 * 1000) {
      return {
        score: 55,
        level: 'medium' as const,
        type: 'review_context' as const,
      };
    }

    return {
      score: 30,
      level: 'low' as const,
      type: 'follow_up' as const,
    };
  }

  async getChatRail(
    userId: string,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceChatResponseDto> {
    const uid = this.normalizeId(userId);
    const locale = this.support.resolveWorkspaceLocale(acceptLanguage);
    const copy = this.getCopy(locale);

    const [totalCount, activeCount, archivedCount, unreadCount, recentThreads] = await Promise.all([
      this.threadModel.countDocuments({ participants: uid }).exec(),
      this.threadModel.countDocuments({ participants: uid, status: 'active' }).exec(),
      this.threadModel.countDocuments({ participants: uid, status: 'archived' }).exec(),
      this.threadModel.countDocuments({
        participants: uid,
        ...this.buildViewerUnreadQuery(uid),
      }).exec(),
      this.threadModel
        .find({ participants: uid, status: { $in: ['active', 'archived'] } })
        .sort({ updatedAt: -1, _id: -1 })
        .limit(24)
        .exec(),
    ]);

    const serializedConversations = await this.chats.serializeConversations(recentThreads, uid);
    const queue = serializedConversations
      .map((conversation) => {
        const updatedAt = new Date(conversation.updatedAt);
        const unread = Math.max(Number(conversation.unread ?? 0), 0);
        const priority = this.resolvePriority(
          unread,
          Number.isFinite(updatedAt.getTime()) ? updatedAt : new Date(0),
        );

        return {
          conversationId: conversation.id,
          title: this.getConversationTitle(conversation, copy),
          actionType: priority.type,
          actionLabel: unread > 0 ? copy.queueUnread(unread) : copy.queueActive,
          actionPriority: priority.score,
          actionPriorityLevel: priority.level,
          actionReason: this.getConversationReason(conversation, copy),
          href: `/workspace?section=chat&conversation=${conversation.id}`,
          updatedAt,
        };
      })
      .sort((left, right) => {
        if (right.actionPriority !== left.actionPriority) {
          return right.actionPriority - left.actionPriority;
        }
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      })
      .slice(0, 5)
      .map(({ updatedAt: _updatedAt, ...item }) => item);

    return {
      section: 'chat',
      header: {
        title: copy.headerTitle,
        subtitle: copy.headerSubtitle,
      },
      summary: {
        items: [
          {
            key: 'all',
            label: copy.summaryAll,
            value: totalCount,
            helper: copy.summaryAllHelper,
            tone: 'all',
          },
          {
            key: 'unread',
            label: copy.summaryUnread,
            value: unreadCount,
            helper: copy.summaryUnreadHelper,
            tone: unreadCount > 0 ? 'attention' : 'completed',
          },
          {
            key: 'active',
            label: copy.summaryActive,
            value: activeCount,
            helper: copy.summaryActiveHelper,
            tone: activeCount > 0 ? 'execution' : 'all',
          },
          {
            key: 'archived',
            label: copy.summaryArchived,
            value: archivedCount,
            helper: copy.summaryArchivedHelper,
            tone: archivedCount > 0 ? 'completed' : 'all',
          },
        ],
      },
      decisionPanel: {
        eyebrow: copy.eyebrow,
        totalNeedsAction: unreadCount,
        title: unreadCount > 0 ? copy.titleAttention : copy.titleClear,
        text: unreadCount > 0 ? copy.textAttention(unreadCount, activeCount) : copy.textClear(activeCount),
        primaryAction: unreadCount > 0
          ? {
              label: copy.primaryUnread,
              href: '/workspace?section=chat&filter=unread',
              targetFilter: 'unread',
            }
          : {
              label: copy.primaryAll,
              href: '/workspace?section=chat',
              targetFilter: 'all',
            },
        queueTitle: copy.queueTitle,
        queue,
        emptyText: copy.queueEmpty,
        overviewEyebrow: copy.overviewEyebrow,
        overview: [
          { key: 'unread', label: copy.overviewUnread, value: unreadCount },
          { key: 'active', label: copy.overviewActive, value: activeCount },
          { key: 'archived', label: copy.overviewArchived, value: archivedCount },
        ],
      },
    };
  }
}
