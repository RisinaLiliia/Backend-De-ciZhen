// src/modules/reviews/dto/create-review.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Booking id' })
  @IsString()
  @MaxLength(64)
  bookingId: string;

  @ApiProperty({ example: 5, description: 'Rating 1..5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Great client, on time', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;
}
