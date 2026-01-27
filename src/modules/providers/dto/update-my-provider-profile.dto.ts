// src/modules/providers/dto/update-my-provider-profile.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength, IsNumber, Min, ArrayMaxSize } from 'class-validator';

export class UpdateMyProviderProfileDto {
  @ApiPropertyOptional({ example: 'Anna Cleaner' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ example: 'I do cleaning in Berlin...' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: 'Sparkle GmbH' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @ApiPropertyOptional({ example: 'DE123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vatId?: string;

  @ApiPropertyOptional({ example: 'cityId_berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cityId?: string;

  @ApiPropertyOptional({ example: ['home_cleaning'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  serviceKeys?: string[];

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;
}
