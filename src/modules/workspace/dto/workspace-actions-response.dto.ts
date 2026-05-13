import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceActionsSummaryItemDto {
  @ApiProperty({ enum: ['account', 'customer', 'provider', 'activation'], example: 'provider' })
  key: 'account' | 'customer' | 'provider' | 'activation';

  @ApiProperty({ example: 'Anbieterprofil' })
  label: string;

  @ApiProperty({ example: 70 })
  value: number;

  @ApiProperty({ example: 'Vollständigkeit im aktuellen Modus' })
  helper: string;

  @ApiProperty({ enum: ['all', 'attention', 'execution', 'completed'], example: 'execution' })
  tone: 'all' | 'attention' | 'execution' | 'completed';
}

export class WorkspaceActionsDecisionActionDto {
  @ApiProperty({ example: 'Profil weiterführen' })
  label: string;

  @ApiProperty({ example: '/workspace?section=actions&viewerMode=provider' })
  href: string;

  @ApiProperty({ enum: ['setup'], example: 'setup' })
  targetFilter: 'setup';
}

export class WorkspaceActionsDecisionQueueItemDto {
  @ApiProperty({ example: 'provider_photo' })
  actionId: string;

  @ApiProperty({ example: 'Profilfoto hinzufügen' })
  title: string;

  @ApiProperty({ enum: ['complete_profile', 'activate_profile', 'create_account'], example: 'complete_profile' })
  actionType: 'complete_profile' | 'activate_profile' | 'create_account';

  @ApiProperty({ example: 'Für mehr Vertrauen im Markt' })
  actionLabel: string;

  @ApiProperty({ example: 90 })
  actionPriority: number;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  actionPriorityLevel: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ example: 'Ohne Foto wirkt das Profil unvollständig.', nullable: true })
  actionReason?: string | null;

  @ApiProperty({ example: '/workspace?section=actions&viewerMode=provider' })
  href: string;
}

export class WorkspaceActionsDecisionOverviewItemDto {
  @ApiProperty({ enum: ['account', 'customer', 'provider'], example: 'provider' })
  key: 'account' | 'customer' | 'provider';

  @ApiProperty({ example: 'Anbieterprofil' })
  label: string;

  @ApiProperty({ example: '70%' })
  value: string;
}

export class WorkspaceActionsDecisionPanelDto {
  @ApiProperty({ example: 'Decision Panel' })
  eyebrow: string;

  @ApiProperty({ example: 3 })
  totalNeedsAction: number;

  @ApiProperty({ example: 'Nächste Aktivierungen' })
  title: string;

  @ApiProperty({ example: '2 Schritte bis zum aktiven Anbieterprofil.' })
  text: string;

  @ApiProperty({ type: WorkspaceActionsDecisionActionDto })
  primaryAction: WorkspaceActionsDecisionActionDto;

  @ApiProperty({ example: 'Action Queue' })
  queueTitle: string;

  @ApiProperty({ type: WorkspaceActionsDecisionQueueItemDto, isArray: true })
  queue: WorkspaceActionsDecisionQueueItemDto[];

  @ApiProperty({ example: 'Der aktuelle Arbeitsbereich ist vollständig vorbereitet.' })
  emptyText: string;

  @ApiProperty({ example: 'Readiness' })
  overviewEyebrow: string;

  @ApiProperty({ type: WorkspaceActionsDecisionOverviewItemDto, isArray: true })
  overview: WorkspaceActionsDecisionOverviewItemDto[];
}

export class WorkspaceActionsFiltersDto {
  @ApiPropertyOptional({ enum: ['provider', 'customer'], example: 'provider', nullable: true })
  viewerMode?: 'provider' | 'customer' | null;
}

export class WorkspaceActionsResponseDto {
  @ApiProperty({ example: 'actions' })
  section: 'actions';

  @ApiProperty({
    example: {
      title: 'Profil-Aktivierung',
      subtitle: 'Backend-owned readiness and next-step rail for the actions workspace mode.',
    },
  })
  header: {
    title: string;
    subtitle?: string | null;
  };

  @ApiProperty({ type: WorkspaceActionsFiltersDto })
  filters: WorkspaceActionsFiltersDto;

  @ApiProperty({ type: WorkspaceActionsSummaryItemDto, isArray: true })
  summary: {
    items: WorkspaceActionsSummaryItemDto[];
  };

  @ApiProperty({ type: WorkspaceActionsDecisionPanelDto })
  decisionPanel: WorkspaceActionsDecisionPanelDto;
}
