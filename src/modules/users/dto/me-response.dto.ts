import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AppRole } from '../schemas/user.schema';

class AvatarDto {
  @ApiProperty({ example: '/avatars/default.png' })
  url: string;

  @ApiProperty({ example: true })
  isDefault: boolean;
}

export class MeResponseDto {
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

  @ApiPropertyOptional({ example: '+49123456789' })
  phone?: string;

  @ApiPropertyOptional({ type: AvatarDto })
  avatar?: AvatarDto;

  @ApiProperty({ example: true })
  acceptedPrivacyPolicy: boolean;

  @ApiPropertyOptional({ example: '2025-01-01T12:00:00.000Z' })
  acceptedPrivacyPolicyAt: Date | null;

  @ApiProperty({ example: false })
  isBlocked: boolean;

  @ApiPropertyOptional({ example: null })
  blockedAt: Date | null;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-02T12:00:00.000Z' })
  updatedAt: Date;
}
