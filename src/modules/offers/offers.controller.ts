// src/modules/offers/offers.controller.ts
import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferDto } from './dto/offer.dto';
import { OffersQueryDto } from './dto/offer-query.dto';
import { AcceptOfferResultDto } from './dto/accept-offer.dto';
import { RejectOfferResultDto } from './dto/reject-offer.dto';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';
import { CreateOfferResponseDto } from './dto/create-offer-response.dto';
import { ProviderProfileDto } from '../providers/dto/provider-profile.dto';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  private toProviderProfileDto(p: any): ProviderProfileDto {
    return {
      id: p._id.toString(),
      userId: p.userId,
      displayName: p.displayName ?? null,
      bio: p.bio ?? null,
      companyName: p.companyName ?? null,
      vatId: p.vatId ?? null,
      cityId: p.cityId ?? null,
      serviceKeys: p.serviceKeys ?? [],
      basePrice: p.basePrice ?? null,
      status: p.status,
      isBlocked: Boolean(p.isBlocked),
      blockedAt: p.blockedAt ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private toDto(o: any, viewer?: CurrentUserPayload): OfferDto {
    const role = viewer?.role;
    const isAdmin = role === 'admin';
    const providerUserId = isAdmin || role === 'provider' || role === 'client' ? o.providerUserId ?? null : null;
    const clientUserId = isAdmin || role === 'client' ? o.clientUserId ?? null : null;

    return {
      id: o._id.toString(),
      requestId: o.requestId,
      providerUserId,
      clientUserId,
      status: o.status,
      message: o.message ?? null,
      amount: o.pricing?.amount ?? null,
      priceType: o.pricing?.type ?? null,
      availableAt: o.availability?.date ?? null,
      availabilityNote: o.availability?.note ?? null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      providerDisplayName: o.providerDisplayName ?? null,
      providerAvatarUrl: o.providerAvatarUrl ?? null,
      providerRatingAvg: o.providerRatingAvg ?? 0,
      providerRatingCount: o.providerRatingCount ?? 0,
      providerCompletedJobs: o.providerCompletedJobs ?? 0,
      providerBasePrice: o.providerBasePrice ?? null,
      requestServiceKey: o.requestServiceKey ?? null,
      requestCityId: o.requestCityId ?? null,
      requestPreferredDate: o.requestPreferredDate ?? null,
      requestStatus: o.requestStatus ?? null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: create offer for request' })
  @ApiCreatedResponse({ type: CreateOfferResponseDto })
  @ApiErrors({ conflict: true })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateOfferDto,
  ): Promise<CreateOfferResponseDto> {
    if (user.role !== 'provider' && user.role !== 'admin' && user.role !== 'client') {
      throw new ForbiddenException('Access denied');
    }

    const created = await this.offers.createForProvider(user.userId, dto);
    return {
      offer: this.toDto(created.offer, user),
      providerProfile: this.toProviderProfileDto(created.providerProfile),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: list my offers' })
  @ApiOkResponse({ type: OfferDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async my(@CurrentUser() user: CurrentUserPayload, @Query() q: OffersQueryDto): Promise<OfferDto[]> {
    if (user.role !== 'provider' && user.role !== 'admin' && user.role !== 'client') {
      throw new ForbiddenException('Access denied');
    }

    const items = await this.offers.listMy(user.userId, { status: q.status });
    return items.map((o: any) => this.toDto(o, user));
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-client')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: list my offers (all requests)' })
  @ApiOkResponse({ type: OfferDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async myClient(
    @CurrentUser() user: CurrentUserPayload,
    @Query() q: OffersQueryDto,
  ): Promise<OfferDto[]> {
    if (user.role !== 'client') {
      throw new ForbiddenException('Access denied');
    }

    const items = await this.offers.listMyClient(user.userId, { status: q.status });
    return items.map((o: any) => this.toDto(o, user));
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-request/:requestId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: list offers for my request (UI)' })
  @ApiParam({ name: 'requestId', required: true })
  @ApiOkResponse({ type: OfferDto, isArray: true })
  @ApiErrors({ conflict: false })
  async listForRequest(
    @CurrentUser() user: CurrentUserPayload,
    @Param('requestId') requestId: string,
    @Query() q: OffersQueryDto,
  ): Promise<OfferDto[]> {
    if (user.role !== 'client' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const items = await this.offers.listByRequestForClient(user.userId, requestId, { status: q.status });
    return items.map((o: any) => this.toDto(o, user));
  }

  @UseGuards(JwtAuthGuard)
  @Patch('actions/:id/accept')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: accept provider offer (match)' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: AcceptOfferResultDto })
  @ApiErrors({ conflict: false })
  async accept(@CurrentUser() user: CurrentUserPayload, @Param('id') offerId: string): Promise<AcceptOfferResultDto> {
    if (user.role !== 'client' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    await this.offers.acceptForClient(user.userId, offerId);
    return { ok: true, acceptedOfferId: offerId };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('actions/:id/decline')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: decline provider offer' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: RejectOfferResultDto })
  @ApiErrors({ conflict: false })
  async decline(@CurrentUser() user: CurrentUserPayload, @Param('id') offerId: string): Promise<RejectOfferResultDto> {
    if (user.role !== 'client' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    await this.offers.declineForClient(user.userId, offerId);
    return { ok: true, rejectedOfferId: offerId };
  }
}
