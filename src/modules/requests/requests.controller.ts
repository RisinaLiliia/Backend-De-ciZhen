// src/modules/requests/requests.controller.ts
import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
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
import { RequestsMyQueryDto } from './dto/requests-my-query.dto';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  private toDto(doc: any): RequestResponseDto {
    return {
      id: doc._id.toString(),
      serviceKey: doc.serviceKey,
      cityId: doc.cityId,
      propertyType: doc.propertyType,
      area: doc.area,
      preferredDate: doc.preferredDate,
      isRecurring: doc.isRecurring,
      comment: doc.comment ?? null,
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

  @Get('public')
  @ApiOperation({
    summary: 'List published requests (for providers)',
    description: 'Returns published requests. Optional filters: cityId, serviceKey.',
  })
  @ApiOkResponse({ type: RequestResponseDto, isArray: true })
  @ApiPublicErrors()
  async listPublic(@Query() q: RequestsPublicQueryDto): Promise<RequestResponseDto[]> {
    const items = await this.requests.listPublic({ cityId: q.cityId, serviceKey: q.serviceKey });
    return items.map((x) => this.toDto(x));
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
  @ApiCreatedResponse({ type: RequestResponseDto })
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
  @Post('my/:requestId/publish')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: publish my draft request' })
  @ApiParam({ name: 'requestId', required: true, example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @ApiOkResponse({ type: RequestResponseDto })
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
