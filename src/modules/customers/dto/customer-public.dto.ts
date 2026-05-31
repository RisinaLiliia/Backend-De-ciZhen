import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerPublicDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  userId: string;

  @ApiPropertyOptional({ example: 'Ban Raflas', nullable: true })
  displayName: string | null;

  @ApiPropertyOptional({
    example: 'Ich beschreibe hier meine Anforderungen und Arbeitsweise.',
    nullable: true,
  })
  bio: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/customer-u1.png', nullable: true })
  avatarUrl: string | null;

  @ApiPropertyOptional({ example: '68163f3d8ff0c1a8f677a111', nullable: true })
  cityId: string | null;

  @ApiPropertyOptional({ example: 'Frankfurt', nullable: true })
  cityName: string | null;

  @ApiProperty({ example: 4.8, description: 'Average rating (0..5)' })
  ratingAvg: number;

  @ApiProperty({ example: 12, description: 'Total ratings count' })
  ratingCount: number;

  @ApiProperty({ example: false })
  isOnline: boolean;

  @ApiPropertyOptional({ example: '2026-05-31T10:15:00.000Z', nullable: true })
  lastSeenAt: Date | null;
}
