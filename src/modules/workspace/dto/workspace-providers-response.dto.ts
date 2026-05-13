import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceProvidersHeaderDto {
  @ApiProperty({ example: 'Anbieter im Markt' })
  title: string;

  @ApiPropertyOptional({
    example: 'Ein gemeinsamer Marktblick für verfügbare, bewährte und relevante Anbieter.',
    nullable: true,
  })
  subtitle?: string | null;
}

export class WorkspaceProvidersFiltersDto {
  @ApiPropertyOptional({ example: null, nullable: true })
  cityId?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  categoryKey?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  subcategoryKey?: string | null;

  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  period?: '24h' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ enum: ['customer', 'provider'], example: 'customer', nullable: true })
  viewerMode?: 'customer' | 'provider' | null;
}

export class WorkspaceProvidersSummaryItemDto {
  @ApiProperty({ enum: ['all', 'available', 'top_rated', 'trusted'], example: 'all' })
  key: 'all' | 'available' | 'top_rated' | 'trusted';

  @ApiProperty({ example: 'Alle' })
  label: string;

  @ApiProperty({ example: 154 })
  value: number;

  @ApiProperty({ example: 'Gesamter Anbieterpool' })
  helper: string;

  @ApiProperty({ enum: ['all', 'attention', 'execution', 'completed'], example: 'all' })
  tone: 'all' | 'attention' | 'execution' | 'completed';
}

export class WorkspaceProvidersSummaryDto {
  @ApiProperty({ type: WorkspaceProvidersSummaryItemDto, isArray: true })
  items: WorkspaceProvidersSummaryItemDto[];
}

export class WorkspaceProvidersDecisionPanelPrimaryActionDto {
  @ApiProperty({ example: 'Anbieter prüfen' })
  label: string;

  @ApiProperty({ example: '/workspace?section=providers' })
  href: string;

  @ApiProperty({ enum: ['recommended'], example: 'recommended' })
  targetFilter: 'recommended';
}

export class WorkspaceProvidersDecisionPanelQueueItemDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  providerId: string;

  @ApiProperty({ example: 'Anna K.' })
  title: string;

  @ApiProperty({
    enum: ['review_provider', 'contact_provider', 'open_availability', 'review_trust'],
    example: 'contact_provider',
  })
  actionType: 'review_provider' | 'contact_provider' | 'open_availability' | 'review_trust';

  @ApiProperty({ example: 'Jetzt verfügbar' })
  actionLabel: string;

  @ApiProperty({ example: 90 })
  actionPriority: number;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  actionPriorityLevel: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ example: 'Sofort planbar und stark bewertet.', nullable: true })
  actionReason?: string | null;

  @ApiPropertyOptional({ example: 'Fensterreinigung', nullable: true })
  categoryLabel?: string | null;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  cityLabel?: string | null;

  @ApiProperty({ example: '/providers/65f0c1a2b3c4d5e6f7a8b9c1' })
  href: string;
}

export class WorkspaceProvidersDecisionPanelOverviewItemDto {
  @ApiProperty({ enum: ['available', 'top_rated', 'trusted'], example: 'available' })
  key: 'available' | 'top_rated' | 'trusted';

  @ApiProperty({ example: 'Jetzt verfügbar' })
  label: string;

  @ApiProperty({ example: 42 })
  value: number;
}

export class WorkspaceProvidersDecisionPanelDto {
  @ApiProperty({ example: 'Decision Panel' })
  eyebrow: string;

  @ApiProperty({ example: 23 })
  totalNeedsAction: number;

  @ApiProperty({ example: 'Anbieter brauchen Aufmerksamkeit' })
  title: string;

  @ApiProperty({ example: '12 sind direkt verfügbar, 8 stark bewertet und 3 frisch aktualisiert.' })
  text: string;

  @ApiProperty({ type: WorkspaceProvidersDecisionPanelPrimaryActionDto })
  primaryAction: WorkspaceProvidersDecisionPanelPrimaryActionDto;

  @ApiProperty({ example: 'Action Queue' })
  queueTitle: string;

  @ApiProperty({ type: WorkspaceProvidersDecisionPanelQueueItemDto, isArray: true })
  queue: WorkspaceProvidersDecisionPanelQueueItemDto[];

  @ApiProperty({ example: 'Im aktuellen Kontext gibt es keine priorisierten Anbieter.' })
  emptyText: string;

  @ApiProperty({ example: 'Angebotslage' })
  overviewEyebrow: string;

  @ApiProperty({ type: WorkspaceProvidersDecisionPanelOverviewItemDto, isArray: true })
  overview: WorkspaceProvidersDecisionPanelOverviewItemDto[];
}

export class WorkspaceProvidersResponseDto {
  @ApiProperty({ example: 'providers' })
  section: 'providers';

  @ApiProperty({ type: WorkspaceProvidersHeaderDto })
  header: WorkspaceProvidersHeaderDto;

  @ApiProperty({ type: WorkspaceProvidersFiltersDto })
  filters: WorkspaceProvidersFiltersDto;

  @ApiProperty({ type: WorkspaceProvidersSummaryDto })
  summary: WorkspaceProvidersSummaryDto;

  @ApiProperty({ type: WorkspaceProvidersDecisionPanelDto })
  decisionPanel: WorkspaceProvidersDecisionPanelDto;
}
