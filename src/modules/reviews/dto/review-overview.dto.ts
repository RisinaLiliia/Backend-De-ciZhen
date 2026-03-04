import { ApiProperty } from '@nestjs/swagger';
import { ReviewPublicDto } from './review-public.dto';

export class ReviewOverviewDistributionDto {
  @ApiProperty({ example: 0 })
  '1': number;

  @ApiProperty({ example: 1 })
  '2': number;

  @ApiProperty({ example: 3 })
  '3': number;

  @ApiProperty({ example: 5 })
  '4': number;

  @ApiProperty({ example: 12 })
  '5': number;
}

export class ReviewOverviewSummaryDto {
  @ApiProperty({ example: 21 })
  total: number;

  @ApiProperty({ example: 4.4 })
  averageRating: number;

  @ApiProperty({ type: ReviewOverviewDistributionDto })
  distribution: ReviewOverviewDistributionDto;
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
