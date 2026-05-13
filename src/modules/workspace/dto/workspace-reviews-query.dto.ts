import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class WorkspaceReviewsQueryDto {
  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d' })
  @IsOptional()
  @IsString()
  @IsIn(['24h', '7d', '30d', '90d'])
  range?: '24h' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ enum: ['created_desc', 'rating_desc'], example: 'created_desc' })
  @IsOptional()
  @IsString()
  @IsIn(['created_desc', 'rating_desc'])
  sort?: 'created_desc' | 'rating_desc';
}
