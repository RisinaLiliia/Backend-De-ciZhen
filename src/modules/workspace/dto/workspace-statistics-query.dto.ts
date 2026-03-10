import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export type WorkspaceStatisticsRange = '24h' | '7d' | '30d' | '90d';

export class WorkspaceStatisticsQueryDto {
  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  range?: WorkspaceStatisticsRange;
}
