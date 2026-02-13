import { Body, Controller, Delete, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';
import { FavoritesOkDto } from './dto/favorites-ok.dto';
import { FavoriteActionDto } from './dto/favorite-action.dto';
import { FavoriteListQueryDto } from './dto/favorite-list-query.dto';
import { FavoritesService } from './favorites.service';
import { RequestPublicDto } from '../requests/dto/request-public.dto';
import { ProviderPublicDto } from '../providers/dto/provider-public.dto';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add favorite (provider or request)' })
  @ApiOkResponse({ type: FavoritesOkDto })
  @ApiErrors({ conflict: false })
  async addFavorite(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: FavoriteActionDto,
  ): Promise<FavoritesOkDto> {
    if (user.role !== 'client' && user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }
    await this.favorites.add(user.userId, dto.type, dto.targetId);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove favorite (provider or request)' })
  @ApiOkResponse({ type: FavoritesOkDto })
  @ApiErrors({ conflict: false })
  async removeFavorite(
    @CurrentUser() user: CurrentUserPayload,
    @Query() dto: FavoriteActionDto,
  ): Promise<FavoritesOkDto> {
    if (user.role !== 'client' && user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }
    await this.favorites.remove(user.userId, dto.type, dto.targetId);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List favorites by type' })
  @ApiOkResponse({ schema: { oneOf: [{ $ref: '#/components/schemas/RequestPublicDto' }, { $ref: '#/components/schemas/ProviderPublicDto' }] } })
  @ApiErrors({ conflict: false, notFound: false })
  async listFavorites(
    @CurrentUser() user: CurrentUserPayload,
    @Query() dto: FavoriteListQueryDto,
  ): Promise<RequestPublicDto[] | ProviderPublicDto[]> {
    if (user.role !== 'client' && user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }
    const items = await this.favorites.listByType(user.userId, dto.type);
    if (dto.type === 'provider') {
      return (items as any[]).map((p) => ({
        id: p._id?.toString?.() ?? p.id,
        displayName: p.displayName ?? null,
        avatarUrl: p.avatarUrl ?? null,
        ratingAvg: p.ratingAvg ?? 0,
        ratingCount: p.ratingCount ?? 0,
        completedJobs: p.completedJobs ?? 0,
        basePrice: p.basePrice ?? null,
      }));
    }
    return (items as any[]).map((doc) => ({
      id: doc._id?.toString?.() ?? doc.id,
      title: doc.title,
      serviceKey: doc.serviceKey,
      cityId: doc.cityId ?? null,
      cityName: doc.cityName,
      location: doc.location ?? null,
      clientId: doc.clientId ?? null,
      clientName: doc.clientName ?? null,
      clientAvatarUrl: doc.clientAvatarUrl ?? null,
      clientCity: doc.clientCity ?? null,
      clientRatingAvg: doc.clientRatingAvg ?? null,
      clientRatingCount: doc.clientRatingCount ?? null,
      clientIsOnline: doc.clientIsOnline ?? null,
      clientLastSeenAt: doc.clientLastSeenAt ?? null,
      categoryKey: doc.categoryKey ?? null,
      categoryName: doc.categoryName ?? null,
      subcategoryName: doc.subcategoryName ?? null,
      propertyType: doc.propertyType,
      area: doc.area,
      price: doc.price ?? null,
      preferredDate: doc.preferredDate,
      isRecurring: doc.isRecurring,
      comment: doc.comment ?? null,
      description: doc.description ?? null,
      photos: doc.photos ?? [],
      imageUrl: doc.imageUrl ?? null,
      tags: doc.tags ?? [],
      status: doc.status,
      createdAt: doc.createdAt,
    }));
  }
}
