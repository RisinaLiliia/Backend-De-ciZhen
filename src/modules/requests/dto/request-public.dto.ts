// src/modules/requests/dto/request-public.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestPublicDto {
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
    example: { type: 'Point', coordinates: [8.68, 50.11] },
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

  @ApiPropertyOptional({ example: true, nullable: true })
  clientIsOnline: boolean | null;

  @ApiPropertyOptional({ example: '2026-02-11T10:00:00.000Z', nullable: true })
  clientLastSeenAt: Date | null;

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

  @ApiPropertyOptional({ example: 140, nullable: true })
  previousPrice: number | null;

  @ApiPropertyOptional({ example: 'down', enum: ['up', 'down'], nullable: true })
  priceTrend: 'up' | 'down' | null;

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

  @ApiPropertyOptional({ example: '2026-04-22T11:20:30.123Z', nullable: true })
  publishedAt: Date | null;

  @ApiPropertyOptional({ example: '2026-04-29T11:20:30.123Z', nullable: true })
  purgeAt: Date | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  isInactive: boolean | null;

  @ApiPropertyOptional({ enum: ['cancelled_by_customer'], example: 'cancelled_by_customer', nullable: true })
  inactiveReason: 'cancelled_by_customer' | null;

  @ApiPropertyOptional({ example: 'Dieser Auftrag wurde vom Auftraggeber storniert.', nullable: true })
  inactiveMessage: string | null;

  @ApiProperty({ example: '2026-01-28T10:20:30.123Z' })
  createdAt: Date;
}
