import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetConversationsDto {
  @ApiPropertyOptional({ enum: ['customer', 'provider'] })
  @IsOptional()
  @IsString()
  @IsIn(['customer', 'provider'])
  role?: 'customer' | 'provider';

  @ApiPropertyOptional({ enum: ['active', 'archived'] })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'archived'])
  state?: 'active' | 'archived';

  @ApiPropertyOptional({ example: 'frankfurt' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 24, default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'eyJ2YWx1ZSI6IjIwMjYtMDMtMzFUMTc6MDU6MDAuMDAwWiIsImlkIjoiNjZmMGMxYTIifQ' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  cursor?: string;
}
