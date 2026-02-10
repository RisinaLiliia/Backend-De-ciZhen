// src/modules/reviews/dto/review-public.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewPublicDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  id: string;

  @ApiProperty({ example: 'client', enum: ['client', 'provider'] })
  targetRole: 'client' | 'provider';

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiPropertyOptional({ example: 'Great client, on time', nullable: true })
  text: string | null;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  createdAt: Date;
}
