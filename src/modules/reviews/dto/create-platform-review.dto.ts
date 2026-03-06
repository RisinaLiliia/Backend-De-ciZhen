import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePlatformReviewDto {
  @ApiProperty({ example: 5, description: 'Rating 1..5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Very good marketplace experience.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;

  @ApiPropertyOptional({ example: 'Anonymous', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorName?: string;
}
