// src/modules/requests/requests.controller.ts
import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrors, ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestResponseDto } from './dto/request-response.dto';
import { RequestsPublicQueryDto } from './dto/requests-public-query.dto';
import { RequestsPublicResponseDto } from './dto/requests-public-response.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { IMAGE_MULTER_OPTIONS } from '../uploads/multer.options';
import { UploadsService } from '../uploads/uploads.service';
import { RequestPhotosUploadResponseDto } from './dto/request-photos-upload-response.dto';
import { RequestsMyQueryDto } from './dto/requests-my-query.dto';
import { UsersService } from '../users/users.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { RequestPublicDto } from './dto/request-public.dto';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly uploads: UploadsService,
    private readonly users: UsersService,
    private readonly clientProfiles: ClientProfilesService,
  ) {}

  private toDto(
    doc: any,
    client?: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
      city: string | null;
      ratingAvg: number | null;
      ratingCount: number | null;
    },
  ): RequestResponseDto {
    return {
      id: doc._id.toString(),
      title: doc.title,
      serviceKey: doc.serviceKey,
      cityId: doc.cityId,
      cityName: doc.cityName,
      location: doc.location ?? null,
      clientId: client?.id ?? (doc.clientId ?? null),
      clientName: client?.name ?? null,
      clientAvatarUrl: client?.avatarUrl ?? null,
      clientCity: client?.city ?? null,
      clientRatingAvg: client?.ratingAvg ?? null,
      clientRatingCount: client?.ratingCount ?? null,
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

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @ApiOperation({
    summary: 'Create public request (no auth)',
    description: 'Creates a request and publishes it immediately (MVP).',
  })
  @ApiSecurity({} as any)
  @ApiCreatedResponse({ type: RequestResponseDto })
  @ApiPublicErrors()
  async create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user?: CurrentUserPayload | null,
  ): Promise<RequestResponseDto> {
    const clientId = user?.role === 'client' ? user.userId : null;
    const created = await this.requests.createPublic(dto, clientId);
    return this.toDto(created);
  }

  @Get('public/:id')
  @ApiOperation({
    summary: 'Get published request by id (public)',
    description: 'Returns a single published request with public client info.',
  })
  @ApiParam({ name: 'id', required: true, example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: RequestPublicDto })
  @ApiPublicErrors()
  async getPublicById(@Param('id') id: string): Promise<RequestPublicDto> {
    const doc = await this.requests.getPublicById(id);
    const clientId = this.normalizeId((doc as any).clientId);
    if (!clientId) return this.toPublicDto(doc);

    const [clients, profiles] = await Promise.all([
      this.users.findPublicByIds([clientId]),
      this.clientProfiles.getByUserIds([clientId]),
    ]);

    const user = clients[0];
    if (!user) return this.toPublicDto(doc);
    const profile = profiles[0];

    return this.toPublicDto(doc, {
      id: user._id.toString(),
      name: user.name ?? null,
      avatarUrl: user.avatar?.url ?? null,
      city: user.city ?? null,
      ratingAvg: profile?.ratingAvg ?? null,
      ratingCount: profile?.ratingCount ?? null,
    });
  }

  @Get('public')
  @ApiOperation({
    summary: 'List published requests (for providers)',
    description:
      'Returns published requests. Optional filters: lat/lng/radiusKm (nearby), cityId (fallback), categoryKey, subcategoryKey (preferred), serviceKey (deprecated).',
  })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: RequestsPublicResponseDto })
  @ApiPublicErrors()
  async listPublic(@Query() q: RequestsPublicQueryDto): Promise<RequestsPublicResponseDto> {
    const filters = {
      cityId: q.cityId,
      lat: q.lat,
      lng: q.lng,
      radiusKm: q.radiusKm,
      serviceKey: q.serviceKey,
      categoryKey: q.categoryKey,
      subcategoryKey: q.subcategoryKey,
      sort: q.sort,
      page: q.page,
      limit: q.limit,
      offset: q.offset,
      priceMin: q.priceMin,
      priceMax: q.priceMax,
    };

    const [items, total] = await Promise.all([
      this.requests.listPublic(filters),
      this.requests.countPublic(filters),
    ]);

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
        },
      ]),
    );
    const profileById = new Map(clientProfiles.map((p) => [p.userId, p]));

    const limit = Math.min(Math.max(q.limit ?? 20, 1), 100);
    const offset =
      typeof q.offset === 'number'
        ? Math.max(q.offset, 0)
        : typeof q.page === 'number'
          ? Math.max((q.page - 1) * limit, 0)
          : 0;
    const page = Math.floor(offset / limit) + 1;

    return {
      items: items.map((x) => {
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
        });
      }),
      total,
      page,
      limit,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: list my requests' })
  @ApiOkResponse({ type: RequestResponseDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async my(
    @CurrentUser() user: CurrentUserPayload,
    @Query() q: RequestsMyQueryDto,
  ): Promise<RequestResponseDto[]> {
    if (user.role !== 'client') {
      throw new ForbiddenException('Access denied');
    }

    const filters = this.requests.normalizeFilters(q);
    const items = await this.requests.listMyClient(user.userId, filters);
    return items.map((x) => this.toDto(x));
  }

  @UseGuards(JwtAuthGuard)
  @Post('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Client: create my request (draft)',
    description: 'Creates a request for an authenticated client. Default status: draft.',
  })
  @ApiExtraModels(RequestResponseDto)
  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RequestResponseDto) },
        {
          example: {
            id: '65f0c1a2b3c4d5e6f7a8b9c1',
            title: 'Zwei IKEA Pax Schränke aufbauen',
            serviceKey: 'home_cleaning',
            cityId: '64f0c1a2b3c4d5e6f7a8b9c0',
            cityName: 'Frankfurt am Main',
            categoryKey: 'furniture',
            categoryName: 'Möbelaufbau',
            subcategoryName: 'IKEA Aufbau',
            propertyType: 'apartment',
            area: 55,
            price: 120,
            preferredDate: '2026-02-01T10:00:00.000Z',
            isRecurring: false,
            comment: 'Need eco products, please',
            description: 'Assemble two wardrobes, tools available',
            photos: ['https://cdn.example.com/req/1.jpg'],
            imageUrl: 'https://cdn.example.com/req/1.jpg',
            tags: ['ikea', 'assembly'],
            status: 'draft',
            createdAt: '2026-01-28T10:20:30.123Z',
          },
        },
      ],
    },
  })
  @ApiErrors()
  async createMy(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRequestDto,
  ): Promise<RequestResponseDto> {
    if (user.role !== 'client') {
      throw new ForbiddenException('Access denied');
    }

    const created = await this.requests.createForClient(dto, user.userId);
    return this.toDto(created);
  }

  @UseGuards(JwtAuthGuard)
  @Post('my/photos')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload up to 8 photos',
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Client: upload request photos' })
  @ApiOkResponse({ type: RequestPhotosUploadResponseDto })
  @ApiErrors()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'photos', maxCount: 8 }], IMAGE_MULTER_OPTIONS))
  async uploadMyPhotos(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFiles() files?: { photos?: Express.Multer.File[] },
  ): Promise<RequestPhotosUploadResponseDto> {
    if (user.role !== 'client') throw new ForbiddenException('Access denied');
    const photos = files?.photos ?? [];
    if (photos.length === 0) return { urls: [] };

    const uploaded = await this.uploads.uploadImages(photos, {
      folder: `requests/${user.userId}`,
      publicIdPrefix: 'req_photo',
      tags: ['request'],
    });

    return { urls: uploaded.map((x) => x.url) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('my/:requestId/publish')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: publish my draft request' })
  @ApiParam({ name: 'requestId', required: true, example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @ApiExtraModels(RequestResponseDto)
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RequestResponseDto) },
        {
          example: {
            id: '65f0c1a2b3c4d5e6f7a8b9c1',
            title: 'Zwei IKEA Pax Schränke aufbauen',
            serviceKey: 'home_cleaning',
            cityId: '64f0c1a2b3c4d5e6f7a8b9c0',
            cityName: 'Frankfurt am Main',
            categoryKey: 'furniture',
            categoryName: 'Möbelaufbau',
            subcategoryName: 'IKEA Aufbau',
            propertyType: 'apartment',
            area: 55,
            price: 120,
            preferredDate: '2026-02-01T10:00:00.000Z',
            isRecurring: false,
            comment: 'Need eco products, please',
            description: 'Assemble two wardrobes, tools available',
            photos: ['https://cdn.example.com/req/1.jpg'],
            imageUrl: 'https://cdn.example.com/req/1.jpg',
            tags: ['ikea', 'assembly'],
            status: 'published',
            createdAt: '2026-01-28T10:20:30.123Z',
          },
        },
      ],
    },
  })
  @ApiErrors()
  @HttpCode(200)
  async publishMy(
    @CurrentUser() user: CurrentUserPayload,
    @Param('requestId') requestId: string,
  ): Promise<RequestResponseDto> {
    if (user.role !== 'client') {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.requests.publishForClient(user.userId, requestId);
    return this.toDto(updated);
  }
}
