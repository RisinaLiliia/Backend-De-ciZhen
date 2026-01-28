// src/modules/requests/dto/requests-public-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
}
