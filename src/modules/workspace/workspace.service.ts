import { Injectable, UnauthorizedException } from '@nestjs/common';

import type { TokenResponse } from '../auth/auth.types';
import type { AppRole } from '../users/schemas/user.schema';
import type {
  WorkspacePublicQueryDto,
} from './dto/workspace-public-query.dto';
import type {
  WorkspacePublicOverviewResponseDto,
} from './dto/workspace-public-response.dto';
import type { WorkspacePublicRequestsBatchResponseDto } from './dto/workspace-public-requests-batch.dto';
import type {
  WorkspacePrivateOverviewResponseDto,
} from './dto/workspace-private-response.dto';
import type { WorkspaceProvidersQueryDto } from './dto/workspace-providers-query.dto';
import type { WorkspaceProvidersResponseDto } from './dto/workspace-providers-response.dto';
import type { WorkspaceReviewsQueryDto } from './dto/workspace-reviews-query.dto';
import type { WorkspaceReviewsResponseDto } from './dto/workspace-reviews-response.dto';
import type { WorkspaceActionsResponseDto } from './dto/workspace-actions-response.dto';
import type { WorkspaceRequestsQueryDto } from './dto/workspace-requests-query.dto';
import type { WorkspaceRequestsResponseDto } from './dto/workspace-requests-response.dto';
import type { RegisterWorkspaceProfileDto, SaveWorkspaceProfileDto, WorkspaceProfileResponseDto } from './dto/workspace-profile.dto';
import { WorkspaceMarketRequestsService } from './workspace-market-requests.service';
import { WorkspaceProvidersService } from './workspace-providers.service';
import { WorkspaceReviewsService } from './workspace-reviews.service';
import { WorkspaceRequestsService } from './workspace-requests.service';
import { WorkspacePublicOverviewService } from './workspace-public-overview.service';
import { WorkspacePrivateOverviewService } from './workspace-private-overview.service';
import { WorkspaceProfileService } from './workspace-profile.service';
import { WorkspaceActionsService } from './workspace-actions.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly workspaceRequests: WorkspaceRequestsService,
    private readonly workspaceMarketRequests: WorkspaceMarketRequestsService,
    private readonly workspaceProviders: WorkspaceProvidersService,
    private readonly workspaceReviews: WorkspaceReviewsService,
    private readonly workspaceActions: WorkspaceActionsService,
    private readonly workspacePublicOverview: WorkspacePublicOverviewService,
    private readonly workspacePrivateOverview: WorkspacePrivateOverviewService,
    private readonly workspaceProfile: WorkspaceProfileService,
  ) {}

  async getPublicOverview(query: WorkspacePublicQueryDto): Promise<WorkspacePublicOverviewResponseDto> {
    return this.workspacePublicOverview.getPublicOverview(query);
  }

  async getPublicRequestsBatch(ids: string[]): Promise<WorkspacePublicRequestsBatchResponseDto> {
    return this.workspacePublicOverview.getPublicRequestsBatch(ids);
  }

  async getPrivateOverview(
    userId: string,
    role: AppRole,
    period: '24h' | '7d' | '30d' | '90d' = '30d',
  ): Promise<WorkspacePrivateOverviewResponseDto> {
    return this.workspacePrivateOverview.getPrivateOverview(userId, role, period);
  }

  async getRequestsOverview(
    userId: string | null | undefined,
    role: AppRole | null | undefined,
    query: WorkspaceRequestsQueryDto,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceRequestsResponseDto> {
    if (query.scope === 'market') {
      return this.workspaceMarketRequests.getMarketOverview(query, acceptLanguage);
    }

    if (!userId || !role) {
      throw new UnauthorizedException();
    }

    return this.workspaceRequests.getRequestsOverview(userId, role, query, acceptLanguage);
  }

  async getProvidersOverview(
    query: WorkspaceProvidersQueryDto,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceProvidersResponseDto> {
    return this.workspaceProviders.getProvidersOverview(query, acceptLanguage);
  }

  async getReviewsRail(
    query: WorkspaceReviewsQueryDto,
    userId?: string | null,
    role?: AppRole | null,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceReviewsResponseDto> {
    return this.workspaceReviews.getReviewsRail(query, userId, role, acceptLanguage);
  }

  async getActionsRail(
    userId?: string | null,
    role?: AppRole | null,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceActionsResponseDto> {
    return this.workspaceActions.getActionsRail(userId, role, acceptLanguage);
  }

  async getProfile(userId: string): Promise<WorkspaceProfileResponseDto> {
    return this.workspaceProfile.getProfile(userId);
  }

  async saveProfile(userId: string, dto: SaveWorkspaceProfileDto, file?: Express.Multer.File): Promise<WorkspaceProfileResponseDto> {
    return this.workspaceProfile.saveProfile(userId, dto, file);
  }

  async registerProfile(dto: RegisterWorkspaceProfileDto, file?: Express.Multer.File): Promise<TokenResponse> {
    return this.workspaceProfile.registerProfile(dto, file);
  }
}
