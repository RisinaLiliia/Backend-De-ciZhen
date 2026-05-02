import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class WorkspaceRequestsQueryDto {
  @ApiPropertyOptional({
    enum: ['my', 'market'],
    example: 'my',
    description: 'Returns either the authenticated user workflow board (`my`) or the public market board (`market`).',
    default: 'my',
  })
  @IsOptional()
  @IsIn(['my', 'market'])
  scope?: 'my' | 'market';

  @ApiPropertyOptional({ enum: ['all', 'customer', 'provider'], example: 'all', default: 'all' })
  @IsOptional()
  @IsIn(['all', 'customer', 'provider'])
  role?: 'all' | 'customer' | 'provider';

  @ApiPropertyOptional({ enum: ['all', 'attention', 'execution', 'completed'], example: 'attention', default: 'all' })
  @IsOptional()
  @IsIn(['all', 'attention', 'execution', 'completed'])
  state?: 'all' | 'attention' | 'execution' | 'completed';

  @ApiPropertyOptional({ enum: ['24h', '7d', '30d', '90d'], example: '30d', default: '30d' })
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  period?: '24h' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({
    enum: ['activity', 'newest', 'deadline', 'budget', 'price_asc', 'price_desc', 'oldest', 'date_asc', 'date_desc'],
    example: 'activity',
  })
  @IsOptional()
  @IsIn(['activity', 'newest', 'deadline', 'budget', 'price_asc', 'price_desc', 'oldest', 'date_asc', 'date_desc'])
  sort?: 'activity' | 'newest' | 'deadline' | 'budget' | 'price_asc' | 'price_desc' | 'oldest' | 'date_asc' | 'date_desc';

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  service?: string | null;
}
