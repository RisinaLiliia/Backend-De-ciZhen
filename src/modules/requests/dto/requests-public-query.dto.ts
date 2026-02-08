// src/modules/requests/dto/requests-public-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RequestsPublicQueryDto {
  @ApiPropertyOptional({ example: '64f0c1a2b3c4d5e6f7a8b9c0' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cityId?: string;

  @ApiPropertyOptional({ example: 'home_cleaning' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceKey?: string;

  @ApiPropertyOptional({ enum: ['date_desc', 'date_asc', 'price_asc', 'price_desc'], example: 'date_desc' })
  @IsOptional()
  @IsString()
  @IsIn(['date_desc', 'date_asc', 'price_asc', 'price_desc'])
  sort?: 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc';

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
