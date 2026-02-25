// src/modules/providers/dto/provider-public.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderPublicDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  id: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  userId: string;

  @ApiPropertyOptional({ example: 'Anna K.', nullable: true })
  displayName: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/a.png', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: 4.8, description: 'Average rating (0..5)' })
  ratingAvg: number;

  @ApiProperty({ example: 37, description: 'Total ratings count' })
  ratingCount: number;

  @ApiProperty({ example: 120, description: 'Completed jobs count' })
  completedJobs: number;

  @ApiPropertyOptional({ example: 35, nullable: true, description: 'Base price (optional)' })
  basePrice: number | null;

  @ApiPropertyOptional({ example: '65f0c1a2b3c4d5e6f7a8b9c0', nullable: true })
  cityId: string | null;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  cityName: string | null;

  @ApiPropertyOptional({ example: 'home_cleaning', nullable: true })
  serviceKey: string | null;

  @ApiPropertyOptional({ example: ['home_cleaning', 'window_cleaning'], isArray: true })
  serviceKeys: string[];
}
