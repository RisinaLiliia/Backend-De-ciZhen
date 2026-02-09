// src/modules/reviews/reviews.controller.ts
import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

class ReviewsQueryDto {
  @IsString()
  targetUserId: string;

  @IsOptional()
  @IsString()
  @IsIn(['client', 'provider'])
  targetRole?: 'client' | 'provider';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('client')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: review a client for completed booking' })
  @ApiCreatedResponse({ type: ReviewResponseDto })
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
  @ApiOkResponse({ type: ReviewResponseDto, isArray: true })
  async listByTarget(@Query() q: ReviewsQueryDto): Promise<ReviewResponseDto[]> {
    const items = await this.reviews.listByTarget(q.targetUserId, q.targetRole, q.limit, q.offset);
    return items.map((r) => ({
      id: r._id.toString(),
      bookingId: r.bookingId,
      authorUserId: r.authorUserId,
      targetUserId: r.targetUserId,
      targetRole: r.targetRole,
      rating: r.rating,
      text: r.text ?? null,
      createdAt: r.createdAt,
    }));
  }
}
