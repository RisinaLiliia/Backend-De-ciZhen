// src/modules/requests/dto/request-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestResponseDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  id: string;

  @ApiProperty({ example: 'home_cleaning' })
  serviceKey: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  cityId: string;

  @ApiProperty({ example: 'apartment', enum: ['apartment', 'house'] })
  propertyType: 'apartment' | 'house';

  @ApiProperty({ example: 55 })
  area: number;

  @ApiPropertyOptional({ example: 120, nullable: true })
  price: number | null;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  preferredDate: Date;

  @ApiProperty({ example: false })
  isRecurring: boolean;

  @ApiPropertyOptional({ example: 'Need eco products, please', nullable: true })
  comment: string | null;

  @ApiProperty({ example: 'published', enum: ['draft', 'published', 'matched', 'closed', 'cancelled'] })
  status: 'draft' | 'published' | 'matched' | 'closed' | 'cancelled';

  @ApiProperty({ example: '2026-01-28T10:20:30.123Z' })
  createdAt: Date;
}
