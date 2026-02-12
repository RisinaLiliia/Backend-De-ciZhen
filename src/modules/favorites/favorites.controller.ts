import { Controller, Delete, Get, Param, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ProvidersService } from '../providers/providers.service';
import { RequestsService } from '../requests/requests.service';
import { RequestPublicDto } from '../requests/dto/request-public.dto';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { PresenceService } from '../presence/presence.service';
import { FavoritesOkDto } from './dto/favorites-ok.dto';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(
    private readonly providers: ProvidersService,
    private readonly requests: RequestsService,
    private readonly users: UsersService,
    private readonly clientProfiles: ClientProfilesService,
    private readonly presence: PresenceService,
  ) {}

  private roundCoord(n: number, decimals = 2): number {
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
  }

  private normalizeId(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value.length > 0 ? value : null;
    const s = (value as any)?.toString?.();
    return typeof s === 'string' && s.length > 0 ? s : null;
  }

  private toPublicDto(
    doc: any,
    client?: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
      city: string | null;
      ratingAvg: number | null;
      ratingCount: number | null;
      isOnline?: boolean | null;
      lastSeenAt?: Date | null;
    },
  ): RequestPublicDto {
    const loc = doc.location?.coordinates;
    const location =
      Array.isArray(loc) && loc.length === 2
        ? ({
            type: 'Point' as const,
            coordinates: [this.roundCoord(loc[0]), this.roundCoord(loc[1])] as [number, number],
          } as const)
        : null;

    return {
      id: doc._id.toString(),
      title: doc.title,
      serviceKey: doc.serviceKey,
      cityId: doc.cityId,
      cityName: doc.cityName,
      location,
      clientId: client?.id ?? this.normalizeId(doc.clientId),
      clientName: client?.name ?? null,
      clientAvatarUrl: client?.avatarUrl ?? null,
      clientCity: client?.city ?? null,
      clientRatingAvg: client?.ratingAvg ?? null,
      clientRatingCount: client?.ratingCount ?? null,
      clientIsOnline: client?.isOnline ?? null,
      clientLastSeenAt: client?.lastSeenAt ?? null,
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
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests/:requestId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: add request to favorites' })
  @ApiParam({ name: 'requestId', required: true, example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @ApiOkResponse({ type: FavoritesOkDto })
  @ApiErrors({ conflict: false, notFound: false })
  async addFavorite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('requestId') requestId: string,
  ): Promise<FavoritesOkDto> {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }
    await this.providers.addFavoriteRequest(user.userId, requestId);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('requests/:requestId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: remove request from favorites' })
  @ApiParam({ name: 'requestId', required: true, example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @ApiOkResponse({ type: FavoritesOkDto })
  @ApiErrors({ conflict: false, notFound: false })
  async removeFavorite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('requestId') requestId: string,
  ): Promise<FavoritesOkDto> {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }
    await this.providers.removeFavoriteRequest(user.userId, requestId);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: list favorite requests' })
  @ApiOkResponse({ type: RequestPublicDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async listFavorites(@CurrentUser() user: CurrentUserPayload): Promise<RequestPublicDto[]> {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const ids = await this.providers.listFavoriteRequestIds(user.userId);
    const items = await this.requests.listPublicByIds(ids);

    const clientIds = Array.from(
      new Set(
        items
          .map((x) => this.normalizeId((x as any).clientId))
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    );

    const [clients, clientProfiles] =
      clientIds.length > 0
        ? await Promise.all([
            this.users.findPublicByIds(clientIds),
            this.clientProfiles.getByUserIds(clientIds),
          ])
        : [[], []];

    const clientById = new Map(
      clients.map((u) => [
        u._id.toString(),
        {
          id: u._id.toString(),
          name: u.name ?? null,
          avatarUrl: u.avatar?.url ?? null,
          city: u.city ?? null,
          lastSeenAt: u.lastSeenAt ?? null,
        },
      ]),
    );
    const profileById = new Map(clientProfiles.map((p) => [p.userId, p]));
    const onlineById = await this.presence.getOnlineMap(clientIds);

    return items.map((x) => {
      const id = this.normalizeId((x as any).clientId);
      if (!id) return this.toPublicDto(x);
      const base = clientById.get(id);
      if (!base) return this.toPublicDto(x);
      const profile = profileById.get(id);
      return this.toPublicDto(x, {
        id,
        name: base.name,
        avatarUrl: base.avatarUrl,
        city: base.city,
        ratingAvg: profile?.ratingAvg ?? null,
        ratingCount: profile?.ratingCount ?? null,
        isOnline: onlineById.get(id) ?? false,
        lastSeenAt: base.lastSeenAt ?? null,
      });
    });
  }
}
