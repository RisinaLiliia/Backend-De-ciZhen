import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceReviewsSummaryItemDto {
  @ApiProperty({ enum: ['all', 'positive', 'critical', 'recent'], example: 'all' })
  key: 'all' | 'positive' | 'critical' | 'recent';

  @ApiProperty({ example: 'Alle' })
  label: string;

  @ApiProperty({ example: 154 })
  value: number;

  @ApiProperty({ example: 'Plattformstimmen im Zeitraum' })
  helper: string;

  @ApiProperty({ enum: ['all', 'attention', 'execution', 'completed'], example: 'all' })
  tone: 'all' | 'attention' | 'execution' | 'completed';
}

export class WorkspaceReviewsDecisionActionDto {
  @ApiProperty({ example: 'Bewertungen prüfen' })
  label: string;

  @ApiProperty({ example: '/workspace?section=reviews' })
  href: string;

  @ApiProperty({ enum: ['focus'], example: 'focus' })
  targetFilter: 'focus';
}

export class WorkspaceReviewsDecisionQueueItemDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  reviewId: string;

  @ApiProperty({ example: 'Anna K.' })
  title: string;

  @ApiProperty({ enum: ['review_feedback'], example: 'review_feedback' })
  actionType: 'review_feedback';

  @ApiProperty({ example: '2★ Bewertung' })
  actionLabel: string;

  @ApiProperty({ example: 90 })
  actionPriority: number;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  actionPriorityLevel: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ example: 'Antwort kam zu spät.', nullable: true })
  actionReason?: string | null;

  @ApiProperty({ example: '/workspace?section=reviews' })
  href: string;
}

export class WorkspaceReviewsDecisionOverviewItemDto {
  @ApiProperty({ enum: ['avg', 'positive', 'critical'], example: 'avg' })
  key: 'avg' | 'positive' | 'critical';

  @ApiProperty({ example: 'Ø Bewertung' })
  label: string;

  @ApiProperty({ example: '4.8' })
  value: string;
}

export class WorkspaceReviewsComposerDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: true })
  requiresAuthorName: boolean;
}

export class WorkspaceReviewsDecisionPanelDto {
  @ApiProperty({ example: 'Decision Panel' })
  eyebrow: string;

  @ApiProperty({ example: 12 })
  totalNeedsAction: number;

  @ApiProperty({ example: 'Feedback im Fokus' })
  title: string;

  @ApiProperty({ example: '3 kritische und 8 neue Stimmen im gewählten Zeitraum.' })
  text: string;

  @ApiProperty({ type: WorkspaceReviewsDecisionActionDto })
  primaryAction: WorkspaceReviewsDecisionActionDto;

  @ApiProperty({ example: 'Action Queue' })
  queueTitle: string;

  @ApiProperty({ type: WorkspaceReviewsDecisionQueueItemDto, isArray: true })
  queue: WorkspaceReviewsDecisionQueueItemDto[];

  @ApiProperty({ example: 'Im aktuellen Zeitraum gibt es kein priorisiertes Feedback.' })
  emptyText: string;

  @ApiProperty({ example: 'Review-Lage' })
  overviewEyebrow: string;

  @ApiProperty({ type: WorkspaceReviewsDecisionOverviewItemDto, isArray: true })
  overview: WorkspaceReviewsDecisionOverviewItemDto[];
}

export class WorkspaceReviewsFiltersDto {
  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  range?: '24h' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ enum: ['created_desc', 'rating_desc'], example: 'created_desc' })
  sort?: 'created_desc' | 'rating_desc';
}

export class WorkspaceReviewsResponseDto {
  @ApiProperty({ example: 'reviews' })
  section: 'reviews';

  @ApiProperty({
    example: {
      title: 'Plattformbewertungen',
      subtitle: 'Backend-owned review health and feedback focus for the workspace rail.',
    },
  })
  header: {
    title: string;
    subtitle?: string | null;
  };

  @ApiProperty({ type: WorkspaceReviewsFiltersDto })
  filters: WorkspaceReviewsFiltersDto;

  @ApiProperty({ type: WorkspaceReviewsSummaryItemDto, isArray: true })
  summary: {
    items: WorkspaceReviewsSummaryItemDto[];
  };

  @ApiProperty({ type: WorkspaceReviewsDecisionPanelDto })
  decisionPanel: WorkspaceReviewsDecisionPanelDto;

  @ApiProperty({ type: WorkspaceReviewsComposerDto })
  composer: WorkspaceReviewsComposerDto;
}
