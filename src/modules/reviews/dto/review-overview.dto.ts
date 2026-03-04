import { ApiProperty } from '@nestjs/swagger';
import { ReviewPublicDto } from './review-public.dto';
import { ReviewSummaryDistributionDto } from './review-summary.dto';

export class ReviewOverviewSummaryDto {
  @ApiProperty({ example: 21 })
  total: number;

  @ApiProperty({ example: 4.4 })
  averageRating: number;

  @ApiProperty({ type: ReviewSummaryDistributionDto })
  distribution: ReviewSummaryDistributionDto;
}

export class ReviewOverviewDto {
  @ApiProperty({ type: ReviewPublicDto, isArray: true })
  items: ReviewPublicDto[];

  @ApiProperty({ example: 21 })
  total: number;

  @ApiProperty({ example: 4 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ type: ReviewOverviewSummaryDto })
  summary: ReviewOverviewSummaryDto;
}
