// src/modules/reviews/reviews.controller.ts
import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { ReviewPublicDto } from './dto/review-public.dto';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiErrors, ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { UsersService } from '../users/users.service';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

class ReviewsQueryDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  targetUserId: string;

  @ApiPropertyOptional({ enum: ['client', 'provider'], example: 'client' })
  @IsOptional()
  @IsString()
  @IsIn(['client', 'provider'])
  targetRole?: 'client' | 'provider';

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

class ReviewsMyQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'client', 'provider'], example: 'all' })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'client', 'provider'])
  role?: 'all' | 'client' | 'provider';

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly users: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my received reviews (workspace)' })
  @ApiOkResponse({ type: ReviewPublicDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async listMy(
    @CurrentUser() user: CurrentUserPayload,
    @Query() q: ReviewsMyQueryDto,
  ): Promise<ReviewPublicDto[]> {
    const items = await this.reviews.listMyReceived(
      user.userId,
      q.role ?? 'all',
      q.limit,
      q.offset,
    );

    return items.map((r) => ({
      id: r._id.toString(),
      targetRole: r.targetRole,
      rating: r.rating,
      text: r.text ?? null,
      authorName: null,
      authorAvatarUrl: null,
      createdAt: r.createdAt,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('client')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: review a client for completed booking' })
  @ApiCreatedResponse({ type: ReviewResponseDto })
  @ApiErrors({ conflict: false })
  async createClientReview(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    if (user.role !== 'provider') {
      throw new ForbiddenException('Access denied');
    }

    const created = await this.reviews.createForProvider(user.userId, dto);

    return {
      id: created._id.toString(),
      bookingId: created.bookingId,
      authorUserId: created.authorUserId,
      targetUserId: created.targetUserId,
      targetRole: created.targetRole,
      rating: created.rating,
      text: created.text ?? null,
      createdAt: created.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('provider')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: review a provider for completed booking' })
  @ApiCreatedResponse({ type: ReviewResponseDto })
  @ApiErrors({ conflict: false })
  async createProviderReview(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    if (user.role !== 'client') {
      throw new ForbiddenException('Access denied');
    }

    const created = await this.reviews.createForClient(user.userId, dto);

    return {
      id: created._id.toString(),
      bookingId: created.bookingId,
      authorUserId: created.authorUserId,
      targetUserId: created.targetUserId,
      targetRole: created.targetRole,
      rating: created.rating,
      text: created.text ?? null,
      createdAt: created.createdAt,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List reviews by target user' })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: ReviewPublicDto, isArray: true })
  @ApiPublicErrors()
  async listByTarget(@Query() q: ReviewsQueryDto): Promise<ReviewPublicDto[]> {
    const items = await this.reviews.listByTarget(q.targetUserId, q.targetRole, q.limit, q.offset);
    const authorIds = Array.from(
      new Set(
        items
          .map((r: any) => String(r.authorUserId ?? '').trim())
          .filter((x) => x.length > 0),
      ),
    );
    const users = authorIds.length > 0 ? await this.users.findPublicByIds(authorIds) : [];
    const authorById = new Map<string, { name: string | null; avatarUrl: string | null }>();
    for (const u of users as any[]) {
      authorById.set(String(u._id), {
        name: u.name ?? null,
        avatarUrl: u.avatar?.url ?? null,
      });
    }

    return items.map((r) => ({
      id: r._id.toString(),
      targetRole: r.targetRole,
      rating: r.rating,
      text: r.text ?? null,
      authorName: authorById.get(String((r as any).authorUserId))?.name ?? null,
      authorAvatarUrl: authorById.get(String((r as any).authorUserId))?.avatarUrl ?? null,
      createdAt: r.createdAt,
    }));
  }
}
