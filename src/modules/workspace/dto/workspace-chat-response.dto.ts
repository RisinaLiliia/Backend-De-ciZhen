import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceChatSummaryItemDto {
  @ApiProperty({ enum: ['all', 'unread', 'active', 'archived'], example: 'unread' })
  key: 'all' | 'unread' | 'active' | 'archived';

  @ApiProperty({ example: 'Ungelesen' })
  label: string;

  @ApiProperty({ example: 4 })
  value: number;

  @ApiProperty({ example: 'Antwort zuerst' })
  helper: string;

  @ApiProperty({ enum: ['all', 'attention', 'execution', 'completed'], example: 'attention' })
  tone: 'all' | 'attention' | 'execution' | 'completed';
}

export class WorkspaceChatDecisionActionDto {
  @ApiProperty({ example: 'Ungelesene öffnen' })
  label: string;

  @ApiProperty({ example: '/workspace?section=chat&filter=unread' })
  href: string;

  @ApiProperty({ enum: ['all', 'unread'], example: 'unread' })
  targetFilter: 'all' | 'unread';
}

export class WorkspaceChatDecisionQueueItemDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  conversationId: string;

  @ApiProperty({ example: 'Anna Schneider' })
  title: string;

  @ApiProperty({ enum: ['reply', 'review_context', 'follow_up'], example: 'reply' })
  actionType: 'reply' | 'review_context' | 'follow_up';

  @ApiProperty({ example: '3 ungelesen' })
  actionLabel: string;

  @ApiProperty({ example: 88 })
  actionPriority: number;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  actionPriorityLevel: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ example: 'Bezogen auf: Badrenovierung in Karlsruhe', nullable: true })
  actionReason?: string | null;

  @ApiProperty({ example: '/workspace?section=chat&conversation=66f0c1a2b3c4d5e6f7a8b9aa' })
  href: string;
}

export class WorkspaceChatDecisionOverviewItemDto {
  @ApiProperty({ enum: ['unread', 'active', 'archived'], example: 'active' })
  key: 'unread' | 'active' | 'archived';

  @ApiProperty({ example: 'Aktiv' })
  label: string;

  @ApiProperty({ example: 12 })
  value: number;
}

export class WorkspaceChatDecisionPanelDto {
  @ApiProperty({ example: 'Decision Panel' })
  eyebrow: string;

  @ApiProperty({ example: 4 })
  totalNeedsAction: number;

  @ApiProperty({ example: 'Konversationen brauchen Antwort' })
  title: string;

  @ApiProperty({ example: '4 ungelesene Konversationen, 12 aktive Threads im Workspace.' })
  text: string;

  @ApiProperty({ type: WorkspaceChatDecisionActionDto })
  primaryAction: WorkspaceChatDecisionActionDto;

  @ApiProperty({ example: 'Action Queue' })
  queueTitle: string;

  @ApiProperty({ type: WorkspaceChatDecisionQueueItemDto, isArray: true })
  queue: WorkspaceChatDecisionQueueItemDto[];

  @ApiProperty({ example: 'Der Posteingang ist aktuell geklärt.' })
  emptyText: string;

  @ApiProperty({ example: 'Inbox status' })
  overviewEyebrow: string;

  @ApiProperty({ type: WorkspaceChatDecisionOverviewItemDto, isArray: true })
  overview: WorkspaceChatDecisionOverviewItemDto[];
}

export class WorkspaceChatResponseDto {
  @ApiProperty({ example: 'chat' })
  section: 'chat';

  @ApiProperty({
    example: {
      title: 'Nachrichten',
      subtitle: 'Backend-owned conversation priorities and inbox status for the workspace rail.',
    },
  })
  header: {
    title: string;
    subtitle?: string | null;
  };

  @ApiProperty({
    type: Object,
    example: {
      items: [],
    },
  })
  summary: {
    items: WorkspaceChatSummaryItemDto[];
  };

  @ApiProperty({ type: WorkspaceChatDecisionPanelDto })
  decisionPanel: WorkspaceChatDecisionPanelDto;
}
