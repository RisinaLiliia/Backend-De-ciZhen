import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContractDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  requestId: string;

  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  offerId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  clientId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c9' })
  providerUserId: string;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
  })
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

  @ApiPropertyOptional({ example: 120, nullable: true })
  priceAmount: number | null;

  @ApiPropertyOptional({ example: 'fixed', enum: ['fixed', 'estimate', 'hourly'], nullable: true })
  priceType: 'fixed' | 'estimate' | 'hourly' | null;

  @ApiPropertyOptional({ example: 'Includes materials', nullable: true })
  priceDetails: string | null;

  @ApiPropertyOptional({ example: '2026-02-01T10:00:00.000Z', nullable: true })
  confirmedAt: Date | null;

  @ApiPropertyOptional({ example: '2026-02-01T10:00:00.000Z', nullable: true })
  completedAt: Date | null;

  @ApiPropertyOptional({ example: '2026-02-01T10:00:00.000Z', nullable: true })
  cancelledAt: Date | null;

  @ApiPropertyOptional({ example: 'Client cancelled', nullable: true })
  cancelReason: string | null;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  updatedAt: Date;
}
