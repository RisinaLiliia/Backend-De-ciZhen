import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ProvidersService } from './providers.service';
import { ProviderProfileDto } from './dto/provider-profile.dto';
import { UpdateMyProviderProfileDto } from './dto/update-my-provider-profile.dto';
import { ApiErrors, ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { ProvidersPublicQueryDto } from './dto/provider-public-query.dto';
import { ProviderPublicDto } from './dto/provider-public.dto';


type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  private toDto(p: any): ProviderProfileDto {
    return {
      id: p._id.toString(),
      userId: p.userId,
      displayName: p.displayName,
      bio: p.bio,
      companyName: p.companyName,
      vatId: p.vatId,
      cityId: p.cityId,
      serviceKeys: p.serviceKeys ?? [],
      basePrice: p.basePrice,
      status: p.status,
      isBlocked: p.isBlocked,
      blockedAt: p.blockedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get or create my provider profile' })
  @ApiOkResponse({ type: ProviderProfileDto })
  @ApiErrors({ conflict: false })
  async myProfile(@CurrentUser() user: CurrentUserPayload): Promise<ProviderProfileDto> {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new Error('Forbidden');
    }

    const profile = await this.providers.getOrCreateMyProfile(user.userId);
    return this.toDto(profile);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update my provider profile' })
  @ApiOkResponse({ type: ProviderProfileDto })
  @ApiErrors({ conflict: false })
  async updateMyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateMyProviderProfileDto,
  ): Promise<ProviderProfileDto> {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new Error('Forbidden');
    }

    const updated = await this.providers.updateMyProfile(user.userId, dto);
    return this.toDto(updated);
  }

private toPublicDto(p: any): ProviderPublicDto {
  return {
    id: p._id.toString(),
    displayName: p.displayName ?? null,
    avatarUrl: p.avatarUrl ?? null, 
    ratingAvg: p.ratingAvg ?? 0,
    ratingCount: p.ratingCount ?? 0,
    completedJobs: p.completedJobs ?? 0,
    basePrice: p.basePrice ?? null,
  };
}


  @Get()
  @ApiOperation({
    summary: 'Public providers listing (catalog)',
    description: 'Active + not blocked providers. Filters: cityId, serviceKey.',
  })
  @ApiOkResponse({ type: ProviderPublicDto, isArray: true })
  @ApiPublicErrors()
  async listPublic(@Query() q: ProvidersPublicQueryDto): Promise<ProviderPublicDto[]> {
    const items = await this.providers.listPublic({
      cityId: q.cityId,
      serviceKey: q.serviceKey,
    });
    return items.map((p) => this.toPublicDto(p));
  }
}
