// src/modules/requests/dto/create-request.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, Min, IsNumber } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({ example: 'home_cleaning' })
  @IsString()
  @MaxLength(80)
  serviceKey: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0', description: 'City id from /catalog/cities' })
  @IsString()
  @MaxLength(64)
  cityId: string;

  @ApiProperty({ example: 'apartment', enum: ['apartment', 'house'] })
  @IsIn(['apartment', 'house'])
  propertyType: 'apartment' | 'house';

  @ApiProperty({ example: 55, description: 'Area in m²' })
  @IsNumber()
  @Min(10)
  area: number;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  @IsDateString()
  preferredDate: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isRecurring: boolean;

  @ApiPropertyOptional({ example: 'Need eco products, please', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
