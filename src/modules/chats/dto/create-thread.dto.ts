import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateThreadDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1', description: 'Request id' })
  @IsString()
  @MaxLength(64)
  requestId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c9', description: 'Provider user id' })
  @IsString()
  @MaxLength(64)
  providerUserId: string;

  @ApiPropertyOptional({ example: '66f0c1a2b3c4d5e6f7a8b9ff', description: 'Offer id (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  offerId?: string;

  @ApiPropertyOptional({ example: '66f0c1a2b3c4d5e6f7a8b9aa', description: 'Contract id (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contractId?: string;
}
