import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { ApiErrors, ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { WorkspaceService } from './workspace.service';
import { WorkspacePublicQueryDto } from './dto/workspace-public-query.dto';
import { WorkspacePublicOverviewResponseDto } from './dto/workspace-public-response.dto';
import {
  WorkspacePublicRequestsBatchDto,
  WorkspacePublicRequestsBatchResponseDto,
} from './dto/workspace-public-requests-batch.dto';
import { WorkspacePrivateOverviewResponseDto } from './dto/workspace-private-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('workspace')
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get('public')
  @ApiOperation({
    summary: 'Public workspace overview (BFF view-model)',
    description:
      'Returns request page + aggregated platform counters + demand map city activity + activity chart in one payload.',
  })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: WorkspacePublicOverviewResponseDto })
  @ApiPublicErrors()
  async getPublicOverview(@Query() query: WorkspacePublicQueryDto): Promise<WorkspacePublicOverviewResponseDto> {
    return this.workspace.getPublicOverview(query);
  }

  @Post('public/requests-batch')
  @ApiOperation({
    summary: 'Resolve request details by ids in one call',
    description: 'Batch endpoint to avoid N+1 request detail calls from frontend.',
  })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: WorkspacePublicRequestsBatchResponseDto })
  @ApiPublicErrors()
  @HttpCode(200)
  async getPublicRequestsBatch(
    @Body() body: WorkspacePublicRequestsBatchDto,
  ): Promise<WorkspacePublicRequestsBatchResponseDto> {
    return this.workspace.getPublicRequestsBatch(body.ids);
  }

  @UseGuards(JwtAuthGuard)
  @Get('private')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Private workspace overview (BFF view-model)',
    description:
      'Returns personalized counts, KPI metrics and last-6-month chart series in one payload for authenticated user.',
  })
  @ApiOkResponse({ type: WorkspacePrivateOverviewResponseDto })
  @ApiErrors({ conflict: false, notFound: false })
  async getPrivateOverview(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<WorkspacePrivateOverviewResponseDto> {
    return this.workspace.getPrivateOverview(user.userId, user.role);
  }
}
