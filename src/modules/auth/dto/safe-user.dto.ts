// src/modules/auth/dto/safe-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AppRole } from '../auth.types';

export class SafeUserDto {
  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  id: string;

  @ApiProperty({ example: 'Liliia' })
  name: string;

  @ApiProperty({ example: 'liliia@test.com' })
  email: string;

  @ApiProperty({ enum: ['client', 'provider', 'admin'], example: 'client' })
  role: AppRole;

  @ApiPropertyOptional({ example: 'Berlin' })
  city?: string;

  @ApiPropertyOptional({ example: 'de' })
  language?: string;

  @ApiPropertyOptional({ example: '2025-01-01T12:00:00.000Z' })
  createdAt?: Date;
}
