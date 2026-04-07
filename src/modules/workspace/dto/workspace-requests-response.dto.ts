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

  @ApiPropertyOptional({ type: WorkspaceRequestsSidePanelDto, nullable: true })
  sidePanel?: WorkspaceRequestsSidePanelDto | null;
}
