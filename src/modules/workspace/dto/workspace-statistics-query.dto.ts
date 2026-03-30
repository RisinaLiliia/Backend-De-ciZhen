import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export type WorkspaceStatisticsRange = '24h' | '7d' | '30d' | '90d';
export type WorkspaceStatisticsViewerMode = 'provider' | 'customer';

export class WorkspaceStatisticsQueryDto {
  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  range?: WorkspaceStatisticsRange;

  @ApiPropertyOptional({
    example: '64f0c1a2b3c4d5e6f7a8b9c0',
    description: 'Optional city focus for the decision dashboard context.',
  })
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional({
    example: 'de-berlin',
    description: 'Optional region focus. Accepted for contract completeness; currently informational until region data is available.',
  })
  @IsOptional()
  @IsString()
  regionId?: string;

  @ApiPropertyOptional({
    example: 'cleaning',
    description: 'Optional category focus for the decision dashboard context.',
  })
  @IsOptional()
  @IsString()
  categoryKey?: string;

  @ApiPropertyOptional({
    example: 'wc_repair',
    description: 'Optional service focus within the selected category for the decision dashboard context.',
  })
  @IsOptional()
  @IsString()
  subcategoryKey?: string;

  @ApiPropertyOptional({
    enum: ['provider', 'customer'],
    example: 'provider',
    description: 'Personalized statistics perspective for authenticated Analyse.',
  })
  @IsOptional()
  @IsIn(['provider', 'customer'])
  viewerMode?: WorkspaceStatisticsViewerMode;
}
