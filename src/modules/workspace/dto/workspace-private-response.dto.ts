import { ApiProperty } from '@nestjs/swagger';

import type { AppRole } from '../../users/schemas/user.schema';

export type WorkspacePrivatePreferredRole = 'customer' | 'provider';

export class WorkspacePrivateStatusCountsDto {
  @ApiProperty({ example: 0 })
  draft: number;

  @ApiProperty({ example: 12 })
  published: number;

  @ApiProperty({ example: 1 })
  paused: number;

  @ApiProperty({ example: 3 })
  matched: number;

  @ApiProperty({ example: 7 })
  closed: number;

  @ApiProperty({ example: 1 })
  cancelled: number;

  @ApiProperty({ example: 24 })
  total: number;
}

export class WorkspacePrivateOfferStatusCountsDto {
  @ApiProperty({ example: 4 })
  sent: number;

  @ApiProperty({ example: 9 })
  accepted: number;

  @ApiProperty({ example: 3 })
  declined: number;

  @ApiProperty({ example: 1 })
  withdrawn: number;

  @ApiProperty({ example: 17 })
  total: number;
}

export class WorkspacePrivateContractStatusCountsDto {
  @ApiProperty({ example: 2 })
  pending: number;

  @ApiProperty({ example: 4 })
  confirmed: number;

  @ApiProperty({ example: 1 })
  in_progress: number;

  @ApiProperty({ example: 8 })
  completed: number;

  @ApiProperty({ example: 1 })
  cancelled: number;

  @ApiProperty({ example: 16 })
  total: number;
}

export class WorkspacePrivateProfilesDto {
  @ApiProperty({ example: 70, description: 'Provider profile completeness in percent (0..100).' })
  providerCompleteness: number;

  @ApiProperty({ example: 80, description: 'Client profile completeness in percent (0..100).' })
  clientCompleteness: number;
}

export class WorkspacePrivateFavoritesDto {
  @ApiProperty({ example: 3 })
  requests: number;

  @ApiProperty({ example: 2 })
  providers: number;
}

export class WorkspacePrivateReviewsDto {
  @ApiProperty({ example: 4, description: 'Reviews where current user is provider target.' })
  asProvider: number;

  @ApiProperty({ example: 1, description: 'Reviews where current user is client target.' })
  asClient: number;
}

export class WorkspacePrivateKpisDto {
  @ApiProperty({ example: 10 })
  myOpenRequests: number;

  @ApiProperty({ example: 5 })
  providerActiveContracts: number;

  @ApiProperty({ example: 4 })
  clientActiveContracts: number;

  @ApiProperty({ example: 70 })
  acceptanceRate: number;

  @ApiProperty({ example: 66 })
  activityProgress: number;

  @ApiProperty({ example: 18, nullable: true, description: 'Average offer response minutes or null.' })
  avgResponseMinutes: number | null;

  @ApiProperty({ example: 6 })
  recentOffers7d: number;
}

export class WorkspacePrivateMonthlyPointDto {
  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  monthStart: string;

  @ApiProperty({ example: 6, description: 'Primary series value (bars).' })
  bars: number;

  @ApiProperty({ example: 1200, description: 'Secondary series value (line).' })
  line: number;
}

export class WorkspacePrivateInsightsDto {
  @ApiProperty({ example: 3 })
  providerCompletedThisMonth: number;

  @ApiProperty({ example: 2 })
  providerCompletedLastMonth: number;

  @ApiProperty({ example: 'percent', enum: ['percent', 'new', 'none'] })
  providerCompletedDeltaKind: 'percent' | 'new' | 'none';

  @ApiProperty({ example: 50, nullable: true, description: 'Present only when delta kind is percent.' })
  providerCompletedDeltaPercent: number | null;
}

export class WorkspacePrivateUserDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  userId: string;

  @ApiProperty({ enum: ['client', 'provider', 'admin'], example: 'provider' })
  role: AppRole;
}

export class WorkspacePrivateOverviewResponseDto {
  @ApiProperty({ example: '2026-03-02T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: WorkspacePrivateUserDto })
  user: WorkspacePrivateUserDto;

  @ApiProperty({
    enum: ['customer', 'provider'],
    example: 'customer',
    description: 'Backend-owned default role for private workspace rendering.',
  })
  preferredRole: WorkspacePrivatePreferredRole;

  @ApiProperty({ type: WorkspacePrivateStatusCountsDto })
  requestsByStatus: WorkspacePrivateStatusCountsDto;

  @ApiProperty({ type: WorkspacePrivateOfferStatusCountsDto })
  providerOffersByStatus: WorkspacePrivateOfferStatusCountsDto;

  @ApiProperty({ type: WorkspacePrivateOfferStatusCountsDto })
  clientOffersByStatus: WorkspacePrivateOfferStatusCountsDto;

  @ApiProperty({ type: WorkspacePrivateContractStatusCountsDto })
  providerContractsByStatus: WorkspacePrivateContractStatusCountsDto;

  @ApiProperty({ type: WorkspacePrivateContractStatusCountsDto })
  clientContractsByStatus: WorkspacePrivateContractStatusCountsDto;

  @ApiProperty({ type: WorkspacePrivateFavoritesDto })
  favorites: WorkspacePrivateFavoritesDto;

  @ApiProperty({ type: WorkspacePrivateReviewsDto })
  reviews: WorkspacePrivateReviewsDto;

  @ApiProperty({ type: WorkspacePrivateProfilesDto })
  profiles: WorkspacePrivateProfilesDto;

  @ApiProperty({ type: WorkspacePrivateKpisDto })
  kpis: WorkspacePrivateKpisDto;

  @ApiProperty({ type: WorkspacePrivateInsightsDto })
  insights: WorkspacePrivateInsightsDto;

  @ApiProperty({ type: WorkspacePrivateMonthlyPointDto, isArray: true })
  providerMonthlySeries: WorkspacePrivateMonthlyPointDto[];

  @ApiProperty({ type: WorkspacePrivateMonthlyPointDto, isArray: true })
  clientMonthlySeries: WorkspacePrivateMonthlyPointDto[];
}
