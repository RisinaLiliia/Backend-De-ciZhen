import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class WorkspacePublicQueryDto {
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

  @ApiPropertyOptional({ enum: ['date_desc', 'date_asc', 'price_asc', 'price_desc'], example: 'date_desc' })
  @IsOptional()
  @IsIn(['date_desc', 'date_asc', 'price_asc', 'price_desc'])
  sort?: 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc';

  @ApiPropertyOptional({ example: 50, description: 'Filter by price >= priceMin' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional({ example: 200, description: 'Filter by price <= priceMax' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({ example: 1, description: 'Page number (>=1). Default 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Page size (1..100). Default 20' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d', description: 'Range for activity chart' })
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  activityRange?: '24h' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, description: 'Top city points for demand map' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  cityActivityLimit?: number;
}
