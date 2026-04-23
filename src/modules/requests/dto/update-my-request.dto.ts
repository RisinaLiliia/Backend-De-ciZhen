import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMyRequestDto {
  @ApiPropertyOptional({ example: 'Zwei IKEA Pax Schränke aufbauen' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityId?: string;

  @ApiPropertyOptional({ example: 'apartment', enum: ['apartment', 'house'] })
  @IsOptional()
  @IsIn(['apartment', 'house'])
  propertyType?: 'apartment' | 'house';

  @ApiPropertyOptional({ example: 55, description: 'Area in m²' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  area?: number;

  @ApiPropertyOptional({ example: 120, description: 'Optional price in EUR' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: '2026-02-01T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: 'Need eco products, please', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({ example: 'Assemble two wardrobes, tools available', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    example: ['https://cdn.example.com/req/1.jpg'],
    description: 'Optional photos for the request card',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  photos?: string[];

  @ApiPropertyOptional({
    example: ['ikea', 'assembly'],
    description: 'Optional tags for search',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}
