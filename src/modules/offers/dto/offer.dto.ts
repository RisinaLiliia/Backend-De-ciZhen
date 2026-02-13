// src/modules/offers/dto/offer.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OfferDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  requestId: string;

  @ApiPropertyOptional({ example: '64f0c1a2b3c4d5e6f7a8b9c9', nullable: true })
  providerUserId?: string | null;

  @ApiPropertyOptional({ example: '64f0c1a2b3c4d5e6f7a8b9a1', nullable: true })
  clientUserId?: string | null;

  @ApiProperty({ enum: ['sent', 'accepted', 'declined', 'withdrawn'], example: 'sent' })
  status: 'sent' | 'accepted' | 'declined' | 'withdrawn';

  @ApiPropertyOptional({ example: 'I can start tomorrow morning.', nullable: true })
  message?: string | null;

  @ApiPropertyOptional({ example: 120, nullable: true })
  amount?: number | null;

  @ApiPropertyOptional({ example: 'fixed', enum: ['fixed', 'estimate', 'hourly'], nullable: true })
  priceType?: 'fixed' | 'estimate' | 'hourly' | null;

  @ApiPropertyOptional({ example: '2026-02-01T10:00:00.000Z', nullable: true })
  availableAt?: string | null;

  @ApiPropertyOptional({ example: 'Can do weekends too', nullable: true })
  availabilityNote?: string | null;

  @ApiProperty({ example: '2026-01-28T10:20:30.123Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-28T10:20:30.123Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: 'Anna Cleaner', nullable: true })
  providerDisplayName?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/a.png', nullable: true })
  providerAvatarUrl?: string | null;

  @ApiPropertyOptional({ example: 4.8 })
  providerRatingAvg?: number;

  @ApiPropertyOptional({ example: 12 })
  providerRatingCount?: number;

  @ApiPropertyOptional({ example: 40 })
  providerCompletedJobs?: number;

  @ApiPropertyOptional({ example: 35, nullable: true })
  providerBasePrice?: number | null;

  @ApiPropertyOptional({ example: 'home_cleaning', nullable: true })
  requestServiceKey?: string | null;

  @ApiPropertyOptional({ example: 'Berlin', nullable: true })
  requestCityId?: string | null;

  @ApiPropertyOptional({ example: '2026-01-29T10:20:30.123Z', nullable: true })
  requestPreferredDate?: Date | null;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'paused', 'matched', 'closed', 'cancelled'], nullable: true })
  requestStatus?: 'draft' | 'published' | 'paused' | 'matched' | 'closed' | 'cancelled' | null;
}
