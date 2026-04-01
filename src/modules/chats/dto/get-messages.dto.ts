import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class GetMessagesDto {
  @ApiPropertyOptional({ example: 24, default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'eyJ2YWx1ZSI6IjIwMjYtMDMtMzFUMTc6MDA6MDAuMDAwWiIsImlkIjoiNjZmMGMxYTIifQ' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  cursor?: string;
}
