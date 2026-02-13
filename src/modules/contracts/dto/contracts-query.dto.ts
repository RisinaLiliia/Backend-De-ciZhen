import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class ContractsQueryDto {
  @ApiPropertyOptional({ enum: ['client', 'provider', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['client', 'provider', 'all'])
  role?: 'client' | 'provider' | 'all';

  @ApiPropertyOptional({
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'])
  status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
