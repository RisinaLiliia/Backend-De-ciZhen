// src/modules/providers/dto/provider-profile.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderProfileDto {
  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  id: string;

  @ApiProperty({ example: 'userId1' })
  userId: string;

  @ApiPropertyOptional({ example: 'Anna Cleaner' })
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'I do cleaning in Berlin...' })
  bio?: string | null;

  @ApiPropertyOptional({ example: 'Sparkle GmbH' })
  companyName?: string | null;

  @ApiPropertyOptional({ example: 'DE123456789' })
  vatId?: string | null;

  @ApiPropertyOptional({ example: 'cityId_berlin' })
  cityId?: string | null;

  @ApiProperty({ example: ['home_cleaning'] })
  serviceKeys: string[];

  @ApiPropertyOptional({ example: 40 })
  basePrice?: number | null;

  @ApiProperty({ enum: ['draft', 'active', 'suspended'], example: 'draft' })
  status: 'draft' | 'active' | 'suspended';

  @ApiProperty({ example: false })
  isBlocked: boolean;

  @ApiPropertyOptional({ example: null })
  blockedAt?: Date | null;

  @ApiProperty({ example: '2026-01-27T10:20:30.123Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-27T10:20:30.123Z' })
  updatedAt: Date;
}
