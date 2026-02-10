// src/modules/reviews/reviews.controller.ts
import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
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

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

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
  @ApiOkResponse({ type: ReviewPublicDto, isArray: true })
  @ApiPublicErrors()
  async listByTarget(@Query() q: ReviewsQueryDto): Promise<ReviewPublicDto[]> {
    const items = await this.reviews.listByTarget(q.targetUserId, q.targetRole, q.limit, q.offset);
    return items.map((r) => ({
      id: r._id.toString(),
      targetRole: r.targetRole,
      rating: r.rating,
      text: r.text ?? null,
      createdAt: r.createdAt,
    }));
  }
}
