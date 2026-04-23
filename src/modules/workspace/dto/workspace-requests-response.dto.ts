import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceRequestsHeaderDto {
  @ApiPropertyOptional({ example: 'Meine Arbeit', nullable: true })
  eyebrow?: string;

  @ApiProperty({ example: 'Meine Vorgänge' })
  title: string;

  @ApiPropertyOptional({ example: 'Aktuelle Arbeit und nächste Schritte', nullable: true })
  subtitle?: string;
}

export class WorkspaceRequestsFiltersDto {
  @ApiPropertyOptional({ example: null, nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  category?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  service?: string | null;

  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  period?: '24h' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ enum: ['all', 'customer', 'provider'], example: 'all' })
  role?: 'all' | 'customer' | 'provider';

  @ApiPropertyOptional({ enum: ['all', 'attention', 'execution', 'completed'], example: 'attention' })
  state?: 'all' | 'attention' | 'execution' | 'completed';

  @ApiPropertyOptional({ example: 'activity', nullable: true })
  sort?: string;
}

export class WorkspaceRequestsSummaryItemDto {
  @ApiProperty({ enum: ['all', 'attention', 'execution', 'completed', 'pending'], example: 'attention' })
  key: 'all' | 'attention' | 'execution' | 'completed' | 'pending';

  @ApiProperty({ example: 'Aktiv' })
  label: string;

  @ApiProperty({ example: 7 })
  value: number;

  @ApiPropertyOptional({ example: true })
  isHighlighted?: boolean;
}

export class WorkspaceRequestsSummaryDto {
  @ApiProperty({ type: WorkspaceRequestsSummaryItemDto, isArray: true })
  items: WorkspaceRequestsSummaryItemDto[];
}

export class WorkspaceMyRequestCardActivityDto {
  @ApiProperty({ example: '2 neue Angebote warten auf deine Auswahl' })
  label: string;

  @ApiPropertyOptional({ enum: ['info', 'warning', 'success', 'neutral'], example: 'warning' })
  tone?: 'info' | 'warning' | 'success' | 'neutral';
}

export class WorkspaceMyRequestCardProgressStepDto {
  @ApiProperty({ enum: ['request', 'offers', 'selection', 'contract', 'done'], example: 'offers' })
  key: 'request' | 'offers' | 'selection' | 'contract' | 'done';

  @ApiProperty({ example: 'Angebote' })
  label: string;

  @ApiProperty({ enum: ['done', 'current', 'upcoming'], example: 'current' })
  status: 'done' | 'current' | 'upcoming';
}

export class WorkspaceMyRequestCardProgressDto {
  @ApiProperty({ enum: ['request', 'offers', 'selection', 'contract', 'done'], example: 'selection' })
  currentStep: 'request' | 'offers' | 'selection' | 'contract' | 'done';

  @ApiProperty({ type: WorkspaceMyRequestCardProgressStepDto, isArray: true })
  steps: WorkspaceMyRequestCardProgressStepDto[];
}

export class WorkspaceMyRequestCardQuickActionDto {
  @ApiProperty({ example: 'open' })
  key: string;

  @ApiProperty({ example: 'Öffnen' })
  label: string;

  @ApiProperty({ enum: ['primary', 'secondary', 'neutral'], example: 'primary' })
  tone: 'primary' | 'secondary' | 'neutral';

  @ApiPropertyOptional({ example: '/requests/65f0c1a2b3c4d5e6f7a8b9c1', nullable: true })
  href?: string;

  @ApiPropertyOptional({ example: 'open_request', nullable: true })
  action?: string;
}

export class WorkspaceRequestCardPreviewDto {
  @ApiProperty({ example: '/requests/65f0c1a2b3c4d5e6f7a8b9c1' })
  href: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/req/1.jpg', nullable: true })
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 'cleaning', nullable: true })
  imageCategoryKey?: string | null;

  @ApiPropertyOptional({ example: 'Einmalig', nullable: true })
  badgeLabel?: string | null;

  @ApiProperty({ example: 'Reinigung' })
  categoryLabel: string;

  @ApiProperty({ example: 'Wohnung reinigen' })
  title: string;

  @ApiPropertyOptional({ example: 'Badezimmer, Küche und Fenster.', nullable: true })
  excerpt?: string | null;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  cityLabel?: string | null;

  @ApiPropertyOptional({ example: '07.04.2026', nullable: true })
  dateLabel?: string | null;

  @ApiProperty({ example: '140 €' })
  priceLabel: string;

  @ApiPropertyOptional({ enum: ['up', 'down'], nullable: true, example: 'up' })
  priceTrend?: 'up' | 'down' | null;

  @ApiPropertyOptional({ example: 'Preis gestiegen', nullable: true })
  priceTrendLabel?: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['Reinigung', 'Grundreinigung'] })
  tags: string[];
}

export class WorkspaceRequestCardStatusActionDto {
  @ApiProperty({ example: 'open' })
  key: string;

  @ApiProperty({
    enum: [
      'link',
      'send_offer',
      'edit_offer',
      'withdraw_offer',
      'open_chat',
      'publish_request',
      'unpublish_request',
      'review_responses',
      'duplicate_request',
      'share_request',
      'archive_request',
      'delete_request',
    ],
    example: 'link',
  })
  kind:
    | 'link'
    | 'send_offer'
    | 'edit_offer'
    | 'withdraw_offer'
    | 'open_chat'
    | 'publish_request'
    | 'unpublish_request'
    | 'review_responses'
    | 'duplicate_request'
    | 'share_request'
    | 'archive_request'
    | 'delete_request';

  @ApiProperty({ example: 'secondary' })
  tone: 'primary' | 'secondary' | 'danger';

  @ApiProperty({ example: 'briefcase' })
  icon: 'briefcase' | 'chat' | 'edit' | 'send' | 'trash' | 'copy' | 'share' | 'archive' | 'pause';

  @ApiProperty({ example: 'Öffnen' })
  label: string;

  @ApiPropertyOptional({ example: '/requests/65f0c1a2b3c4d5e6f7a8b9c1', nullable: true })
  href?: string | null;

  @ApiPropertyOptional({ example: '65f0c1a2b3c4d5e6f7a8b9c1', nullable: true })
  requestId?: string | null;

  @ApiPropertyOptional({ example: '65f0c1a2b3c4d5e6f7a8b9d1', nullable: true })
  offerId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: {
      relatedEntity: { type: 'offer', id: '65f0c1a2b3c4d5e6f7a8b9d1' },
      participantUserId: '65f0c1a2b3c4d5e6f7a8b9d2',
      participantRole: 'provider',
      requestId: '65f0c1a2b3c4d5e6f7a8b9c1',
      providerUserId: '65f0c1a2b3c4d5e6f7a8b9d2',
      offerId: '65f0c1a2b3c4d5e6f7a8b9d1',
    },
  })
  chatInput?: {
    relatedEntity: {
      type: 'offer' | 'order' | 'request';
      id: string;
    };
    participantUserId: string;
    participantRole?: 'customer' | 'provider';
    requestId?: string;
    providerUserId?: string;
    offerId?: string;
    orderId?: string;
    contractId?: string;
  } | null;
}

export class WorkspaceRequestCardStatusDto {
  @ApiPropertyOptional({ example: 'In Prüfung', nullable: true })
  badgeLabel?: string | null;

  @ApiPropertyOptional({ enum: ['info', 'warning', 'success', 'danger'], nullable: true, example: 'warning' })
  badgeTone?: 'info' | 'warning' | 'success' | 'danger' | null;

  @ApiProperty({ type: WorkspaceRequestCardStatusActionDto, isArray: true })
  actions: WorkspaceRequestCardStatusActionDto[];
}

export class WorkspaceRequestDecisionDto {
  @ApiProperty({ example: true })
  needsAction: boolean;

  @ApiProperty({
    enum: ['review_offers', 'reply_required', 'confirm_contract', 'confirm_completion', 'overdue_followup', 'none'],
    example: 'review_offers',
  })
  actionType: 'review_offers' | 'reply_required' | 'confirm_contract' | 'confirm_completion' | 'overdue_followup' | 'none';

  @ApiProperty({ example: 75 })
  actionPriority: number;

  @ApiProperty({ enum: ['high', 'medium', 'low', 'none'], example: 'high' })
  actionPriorityLevel: 'high' | 'medium' | 'low' | 'none';

  @ApiPropertyOptional({ example: '2 Angebote prüfen', nullable: true })
  actionLabel?: string | null;

  @ApiPropertyOptional({ example: 'Neue Angebote warten auf deine Auswahl.', nullable: true })
  actionReason?: string | null;

  @ApiPropertyOptional({ example: '2026-04-07T09:00:00.000Z', nullable: true })
  lastRelevantActivityAt?: string | null;

  @ApiPropertyOptional({ type: WorkspaceRequestCardStatusActionDto, nullable: true })
  primaryAction?: WorkspaceRequestCardStatusActionDto | null;
}

export class WorkspaceMyRequestCardDto {
  @ApiProperty({ example: 'customer:65f0c1a2b3c4d5e6f7a8b9c1' })
  id: string;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  requestId: string;

  @ApiProperty({ enum: ['customer', 'provider'], example: 'customer' })
  role: 'customer' | 'provider';

  @ApiProperty({ example: 'Wohnung reinigen' })
  title: string;

  @ApiProperty({ example: 'Reinigung' })
  category: string;

  @ApiPropertyOptional({ example: 'Grundreinigung', nullable: true })
  subcategory?: string | null;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ example: '2026-04-05', nullable: true })
  createdAt?: string | null;

  @ApiPropertyOptional({ example: '2026-04-07', nullable: true })
  nextEventAt?: string | null;

  @ApiPropertyOptional({ example: 140, nullable: true })
  budget?: number | null;

  @ApiPropertyOptional({ example: 220, nullable: true })
  agreedPrice?: number | null;

  @ApiProperty({ enum: ['open', 'clarifying', 'active', 'completed'], example: 'clarifying' })
  state: 'open' | 'clarifying' | 'active' | 'completed';

  @ApiProperty({ example: 'In Klärung' })
  stateLabel: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'], nullable: true, example: 'medium' })
  urgency?: 'low' | 'medium' | 'high' | null;

  @ApiPropertyOptional({ type: WorkspaceMyRequestCardActivityDto, nullable: true })
  activity?: WorkspaceMyRequestCardActivityDto | null;

  @ApiProperty({ type: WorkspaceMyRequestCardProgressDto })
  progress: WorkspaceMyRequestCardProgressDto;

  @ApiProperty({ type: WorkspaceMyRequestCardQuickActionDto, isArray: true })
  quickActions: WorkspaceMyRequestCardQuickActionDto[];

  @ApiProperty({ type: WorkspaceRequestCardPreviewDto })
  requestPreview: WorkspaceRequestCardPreviewDto;

  @ApiProperty({ type: WorkspaceRequestCardStatusDto })
  status: WorkspaceRequestCardStatusDto;

  @ApiProperty({ type: WorkspaceRequestDecisionDto })
  decision: WorkspaceRequestDecisionDto;
}

export class WorkspaceRequestsListDto {
  @ApiProperty({ example: 9 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: false })
  hasMore: boolean;

  @ApiProperty({ type: WorkspaceMyRequestCardDto, isArray: true })
  items: WorkspaceMyRequestCardDto[];
}

export class WorkspaceRequestsSidePanelCtaDto {
  @ApiProperty({ example: 'Öffnen' })
  label: string;

  @ApiPropertyOptional({ example: '/requests/65f0c1a2b3c4d5e6f7a8b9c1', nullable: true })
  href?: string;
}

export class WorkspaceRequestsSidePanelFocusDto {
  @ApiProperty({ example: 'Aktueller Fokus' })
  title: string;

  @ApiProperty({ example: '2 neue Angebote warten auf deine Auswahl' })
  description: string;

  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelCtaDto, nullable: true })
  cta?: WorkspaceRequestsSidePanelCtaDto;
}

export class WorkspaceRequestsSidePanelMetaDto {
  @ApiProperty({ example: 'In Klärung' })
  label: string;

  @ApiProperty({ example: '2' })
  value: string;
}

export class WorkspaceRequestsSidePanelContextItemDto {
  @ApiProperty({ example: 'Kontext' })
  title: string;

  @ApiPropertyOptional({ example: 'Kunde 3 · Anbieter 2', nullable: true })
  description?: string;

  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelMetaDto, isArray: true, nullable: true })
  meta?: WorkspaceRequestsSidePanelMetaDto[];

  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelCtaDto, nullable: true })
  cta?: WorkspaceRequestsSidePanelCtaDto;
}

export class WorkspaceRequestsSidePanelNextStepDto {
  @ApiProperty({ example: 'clarifying' })
  id: string;

  @ApiProperty({ example: 'Neue Rückmeldungen prüfen' })
  title: string;
}

export class WorkspaceRequestsSidePanelDto {
  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelFocusDto, nullable: true })
  focus?: WorkspaceRequestsSidePanelFocusDto | null;

  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelFocusDto, nullable: true })
  recommendation?: WorkspaceRequestsSidePanelFocusDto | null;

  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelContextItemDto, isArray: true, nullable: true })
  contextItems?: WorkspaceRequestsSidePanelContextItemDto[];

  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelNextStepDto, isArray: true, nullable: true })
  nextSteps?: WorkspaceRequestsSidePanelNextStepDto[];
}

export class WorkspaceRequestsDecisionPanelSummaryDto {
  @ApiProperty({ example: 3 })
  totalNeedsAction: number;

  @ApiProperty({ example: 1 })
  highPriorityCount: number;

  @ApiProperty({ example: 2 })
  newOffersCount: number;

  @ApiProperty({ example: 0 })
  replyRequiredCount: number;

  @ApiProperty({ example: 1 })
  confirmCompletionCount: number;

  @ApiProperty({ example: 0 })
  overdueCount: number;
}

export class WorkspaceRequestsDecisionPanelPrimaryActionDto {
  @ApiProperty({ example: 'Jetzt handeln' })
  label: string;

  @ApiProperty({ enum: ['decision'], example: 'decision' })
  mode: 'decision';

  @ApiProperty({ enum: ['needs_action'], example: 'needs_action' })
  targetFilter: 'needs_action';
}

export class WorkspaceRequestsDecisionPanelQueueItemDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  requestId: string;

  @ApiProperty({ example: 'Wohnung reinigen' })
  title: string;

  @ApiProperty({
    enum: ['review_offers', 'reply_required', 'confirm_contract', 'confirm_completion', 'overdue_followup'],
    example: 'review_offers',
  })
  actionType: 'review_offers' | 'reply_required' | 'confirm_contract' | 'confirm_completion' | 'overdue_followup';

  @ApiProperty({ example: '2 Angebote prüfen' })
  actionLabel: string;

  @ApiProperty({ example: 75 })
  actionPriority: number;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  actionPriorityLevel: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ example: 'Neue Angebote warten auf deine Auswahl.', nullable: true })
  actionReason?: string | null;

  @ApiPropertyOptional({ example: 'Design', nullable: true })
  categoryLabel?: string | null;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  cityLabel?: string | null;
}

export class WorkspaceRequestsDecisionPanelOverviewDto {
  @ApiProperty({ example: 1 })
  highUrgency: number;

  @ApiProperty({ example: 2 })
  inProgress: number;

  @ApiProperty({ example: 1 })
  completedThisPeriod: number;
}

export class WorkspaceRequestsDecisionPanelDto {
  @ApiProperty({ type: WorkspaceRequestsDecisionPanelSummaryDto })
  summary: WorkspaceRequestsDecisionPanelSummaryDto;

  @ApiProperty({ type: WorkspaceRequestsDecisionPanelPrimaryActionDto })
  primaryAction: WorkspaceRequestsDecisionPanelPrimaryActionDto;

  @ApiProperty({ type: WorkspaceRequestsDecisionPanelQueueItemDto, isArray: true })
  queue: WorkspaceRequestsDecisionPanelQueueItemDto[];

  @ApiProperty({ type: WorkspaceRequestsDecisionPanelOverviewDto })
  overview: WorkspaceRequestsDecisionPanelOverviewDto;
}

export class WorkspaceRequestsResponseDto {
  @ApiProperty({ example: 'requests' })
  section: 'requests';

  @ApiProperty({ enum: ['my'], example: 'my' })
  scope: 'my';

  @ApiProperty({ type: WorkspaceRequestsHeaderDto })
  header: WorkspaceRequestsHeaderDto;

  @ApiProperty({ type: WorkspaceRequestsFiltersDto })
  filters: WorkspaceRequestsFiltersDto;

  @ApiPropertyOptional({ type: WorkspaceRequestsSummaryDto, nullable: true })
  summary?: WorkspaceRequestsSummaryDto | null;

  @ApiProperty({ type: WorkspaceRequestsListDto })
  list: WorkspaceRequestsListDto;

  @ApiPropertyOptional({ type: WorkspaceRequestsDecisionPanelDto, nullable: true })
  decisionPanel?: WorkspaceRequestsDecisionPanelDto | null;

  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelDto, nullable: true })
  sidePanel?: WorkspaceRequestsSidePanelDto | null;
}
