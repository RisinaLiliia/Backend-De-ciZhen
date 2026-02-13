import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, MinLength, Min } from 'class-validator';

export class CreateOfferDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  requestId: string;

  @ApiPropertyOptional({ example: 'I can start tomorrow morning.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 'fixed', enum: ['fixed', 'estimate', 'hourly'] })
  @IsOptional()
  @IsIn(['fixed', 'estimate', 'hourly'])
  priceType?: 'fixed' | 'estimate' | 'hourly';

  @ApiPropertyOptional({ example: '2026-02-01T10:00:00.000Z' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  availableAt?: string;

  @ApiPropertyOptional({ example: 'Can do weekends too' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  availabilityNote?: string;
}
