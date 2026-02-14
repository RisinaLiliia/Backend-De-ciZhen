import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateOfferDto {
  @ApiPropertyOptional({ example: 140 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: 'Updated availability and details.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

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
