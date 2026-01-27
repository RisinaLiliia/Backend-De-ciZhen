import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ProvidersService } from './providers.service';
import { ProviderProfileDto } from './dto/provider-profile.dto';
import { UpdateMyProviderProfileDto } from './dto/update-my-provider-profile.dto';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';

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
}
