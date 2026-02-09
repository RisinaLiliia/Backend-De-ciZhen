// src/modules/reviews/dto/review-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  id: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  bookingId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  authorUserId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  targetUserId: string;

  @ApiProperty({ example: 'client', enum: ['client', 'provider'] })
  targetRole: 'client' | 'provider';

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiPropertyOptional({ example: 'Great client, on time', nullable: true })
  text: string | null;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  createdAt: Date;
}
