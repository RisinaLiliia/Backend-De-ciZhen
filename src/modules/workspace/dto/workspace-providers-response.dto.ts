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

  @ApiPropertyOptional({ enum: ['date_desc', 'date_asc', 'price_asc', 'price_desc'], example: 'date_desc' })
  sort?: 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc';

  @ApiPropertyOptional({ example: 1 })
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  limit?: number;
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

export class WorkspaceProvidersCardBadgeDto {
  @ApiProperty({ enum: ['neutral', 'info', 'success', 'warning', 'danger', 'risk', 'opportunity'], example: 'info' })
  variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'risk' | 'opportunity';

  @ApiProperty({ enum: ['sm', 'md'], example: 'sm' })
  size: 'sm' | 'md';

  @ApiProperty({ enum: ['soft', 'outline', 'solid'], example: 'soft' })
  tone: 'soft' | 'outline' | 'solid';

  @ApiProperty({ example: 'Top Anbieter' })
  label: string;

  @ApiPropertyOptional({ example: 'Top rating and high reliability', nullable: true })
  tooltip?: string | null;
}

export class WorkspaceProvidersCardDto {
  @ApiProperty({ example: 'provider-1' })
  id: string;

  @ApiProperty({ type: WorkspaceProvidersCardBadgeDto, isArray: true })
  badges: WorkspaceProvidersCardBadgeDto[];

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ enum: ['online', 'offline'], example: 'online' })
  status: 'online' | 'offline';

  @ApiProperty({ example: 'Aktiv' })
  statusLabel: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', nullable: true })
  avatarUrl?: string | null;

  @ApiProperty({ example: 'Anna K.' })
  name: string;

  @ApiProperty({ example: 'Fensterreinigung' })
  role: string;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  cityLabel?: string | null;

  @ApiProperty({ example: '4.9' })
  rating: string;

  @ApiPropertyOptional({ example: '~18 Min.', nullable: true })
  responseTime?: string | null;

  @ApiPropertyOptional({ example: 'Antwortzeit', nullable: true })
  responseTimeLabel?: string | null;

  @ApiPropertyOptional({ example: 82, nullable: true })
  responseRate?: number | null;

  @ApiPropertyOptional({ example: 'Antwortquote', nullable: true })
  responseRateLabel?: string | null;

  @ApiPropertyOptional({ example: 'Saubere Ausführung und verlässliche Termine.', nullable: true })
  aboutPreview?: string | null;

  @ApiProperty({ example: 18 })
  reviewsCount: number;

  @ApiProperty({ example: 'Bewertungen' })
  reviewsLabel: string;

  @ApiPropertyOptional({ example: 'Sehr zuverlässig und schnell!', nullable: true })
  reviewPreview?: string | null;

  @ApiPropertyOptional({ example: 'Verfügbar', nullable: true })
  availabilityDatePrefix?: string | null;

  @ApiPropertyOptional({ example: 'Heute', nullable: true })
  availabilityDateLabel?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  availabilityDateIso?: string | null;

  @ApiPropertyOptional({ example: 'Ab', nullable: true })
  pricingPrefixLabel?: string | null;

  @ApiPropertyOptional({ example: '€55', nullable: true })
  pricingValueLabel?: string | null;

  @ApiPropertyOptional({ example: '/ Std.', nullable: true })
  pricingSuffixLabel?: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['Fensterreinigung', 'Glasflächen'] })
  servicePreview: string[];

  @ApiProperty({ example: 'Profil ansehen' })
  ctaLabel: string;

  @ApiProperty({ example: '/providers/provider-1' })
  profileHref: string;

  @ApiProperty({ example: '/providers/provider-1#reviews' })
  reviewsHref: string;
}

export class WorkspaceProvidersListItemDto {
  @ApiProperty({ example: 'provider-1' })
  id: string;

  @ApiPropertyOptional({ example: '65f0c1a2b3c4d5e6f7a8b9c1', nullable: true })
  userId?: string | null;

  @ApiProperty({ example: false })
  isFavorite: boolean;

  @ApiProperty({ type: WorkspaceProvidersCardDto })
  card: WorkspaceProvidersCardDto;
}

export class WorkspaceProvidersListDto {
  @ApiProperty({ example: 44 })
  totalCount: number;

  @ApiProperty({ example: '44' })
  totalLabel: string;

  @ApiProperty({ enum: ['date_desc', 'date_asc', 'price_asc', 'price_desc'], example: 'date_desc' })
  sort: 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc';

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: 'Keine Anbieter gefunden' })
  emptyTitle: string;

  @ApiProperty({ example: 'Passe Filter oder Perspektive an, um mehr Anbieter zu sehen.' })
  emptyHint: string;

  @ApiProperty({ type: WorkspaceProvidersListItemDto, isArray: true })
  items: WorkspaceProvidersListItemDto[];
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

  @ApiProperty({ type: WorkspaceProvidersListDto })
  list: WorkspaceProvidersListDto;
}
