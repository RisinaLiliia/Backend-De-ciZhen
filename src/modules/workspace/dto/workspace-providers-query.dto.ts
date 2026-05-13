import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const WORKSPACE_PROVIDERS_SORT_VALUES = ['date_desc', 'date_asc', 'price_asc', 'price_desc'] as const;
export type WorkspaceProvidersSortDto = (typeof WORKSPACE_PROVIDERS_SORT_VALUES)[number];

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

  @ApiPropertyOptional({ enum: WORKSPACE_PROVIDERS_SORT_VALUES, example: 'date_desc' })
  @IsOptional()
  @IsIn(WORKSPACE_PROVIDERS_SORT_VALUES)
  sort?: WorkspaceProvidersSortDto;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
