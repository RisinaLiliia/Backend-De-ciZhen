// src/modules/requests/dto/requests-public-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RequestsPublicQueryDto {
  @ApiPropertyOptional({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cityId?: string;

  @ApiPropertyOptional({ example: 50.1109, description: 'Latitude for nearby search (WGS84)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 8.6821, description: 'Longitude for nearby search (WGS84)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: 10, description: 'Search radius in km. Default 10' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(200)
  radiusKm?: number;

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

  @ApiPropertyOptional({ example: 'home_cleaning', deprecated: true, description: 'Use subcategoryKey instead' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceKey?: string;

  @ApiPropertyOptional({ enum: ['date_desc', 'date_asc', 'price_asc', 'price_desc'], example: 'date_desc' })
  @IsOptional()
  @IsString()
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

  @ApiPropertyOptional({ example: 0, description: 'Offset for pagination. Default 0' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
