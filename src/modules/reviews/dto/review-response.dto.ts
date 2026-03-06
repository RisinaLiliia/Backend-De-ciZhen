// src/modules/reviews/dto/review-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  id: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', nullable: true })
  bookingId: string | null;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', nullable: true })
  authorUserId: string | null;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', nullable: true })
  targetUserId: string | null;

  @ApiProperty({ example: 'client', enum: ['client', 'provider', 'platform'] })
  targetRole: 'client' | 'provider' | 'platform';

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiPropertyOptional({ example: 'Great client, on time', nullable: true })
  text: string | null;

  @ApiPropertyOptional({ example: 'Anonymous', nullable: true })
  authorName: string | null;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  createdAt: Date;
}
