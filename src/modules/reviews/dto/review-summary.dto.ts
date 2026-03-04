import { ApiProperty } from '@nestjs/swagger';

export class ReviewSummaryDistributionDto {
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

export class ReviewSummaryDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  targetUserId: string;

  @ApiProperty({ enum: ['client', 'provider'], nullable: true, example: 'provider' })
  targetRole: 'client' | 'provider' | null;

  @ApiProperty({ example: 21 })
  total: number;

  @ApiProperty({ example: 4.4 })
  averageRating: number;

  @ApiProperty({ type: ReviewSummaryDistributionDto })
  distribution: ReviewSummaryDistributionDto;
}
