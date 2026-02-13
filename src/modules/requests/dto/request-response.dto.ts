// src/modules/requests/dto/request-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestResponseDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  id: string;

  @ApiProperty({ example: 'Zwei IKEA Pax Schränke aufbauen' })
  title: string;

  @ApiProperty({ example: 'home_cleaning' })
  serviceKey: string;

  @ApiPropertyOptional({ example: '64f0c1a2b3c4d5e6f7a8b9c0', nullable: true })
  cityId: string | null;

  @ApiProperty({ example: 'Frankfurt am Main' })
  cityName: string;

  @ApiPropertyOptional({
    example: { type: 'Point', coordinates: [8.6821, 50.1109] },
    nullable: true,
  })
  location: { type: 'Point'; coordinates: [number, number] } | null;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', nullable: true })
  clientId: string | null;

  @ApiPropertyOptional({ example: 'Anna Schmidt', nullable: true })
  clientName: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/u/1.png', nullable: true })
  clientAvatarUrl: string | null;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  clientCity: string | null;

  @ApiPropertyOptional({ example: 4.8, nullable: true })
  clientRatingAvg: number | null;

  @ApiPropertyOptional({ example: 37, nullable: true })
  clientRatingCount: number | null;

  @ApiPropertyOptional({ example: 'furniture', nullable: true })
  categoryKey: string | null;

  @ApiPropertyOptional({ example: 'Möbelaufbau', nullable: true })
  categoryName: string | null;

  @ApiPropertyOptional({ example: 'IKEA Aufbau', nullable: true })
  subcategoryName: string | null;

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

  @ApiPropertyOptional({ example: 'Assemble two wardrobes, tools available', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ example: ['https://cdn.example.com/req/1.jpg'], nullable: true, isArray: true })
  photos: string[] | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/req/1.jpg', nullable: true })
  imageUrl: string | null;

  @ApiPropertyOptional({ example: ['ikea', 'assembly'], nullable: true, isArray: true })
  tags: string[] | null;

  @ApiProperty({ example: 'published', enum: ['draft', 'published', 'paused', 'matched', 'closed', 'cancelled'] })
  status: 'draft' | 'published' | 'paused' | 'matched' | 'closed' | 'cancelled';

  @ApiProperty({ example: '2026-01-28T10:20:30.123Z' })
  createdAt: Date;
}
