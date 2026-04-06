import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class WorkspacePrivateQueryDto {
  @ApiPropertyOptional({
    enum: ['24h', '7d', '30d', '90d'],
    example: '30d',
    description: 'Activity period used for backend-owned preferredRole resolution.',
  })
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  period?: '24h' | '7d' | '30d' | '90d';
}
