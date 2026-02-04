// src/modules/requests/requests.controller.ts
import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
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
}
