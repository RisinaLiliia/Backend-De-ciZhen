import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class WorkspaceProvidersQueryDto {
  @ApiPropertyOptional({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cityId?: string;

  @ApiPropertyOptional({ example: 'cleaning' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryKey?: string;

  @ApiPropertyOptional({ example: 'window_cleaning' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subcategoryKey?: string;

  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  period?: '24h' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ enum: ['customer', 'provider'], example: 'customer' })
  @IsOptional()
  @IsIn(['customer', 'provider'])
  viewerMode?: 'customer' | 'provider';
}
