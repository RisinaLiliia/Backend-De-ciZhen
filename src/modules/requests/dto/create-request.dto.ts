// src/modules/requests/dto/create-request.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestDto {
  @ApiProperty({ example: 'Zwei IKEA Pax Schränke aufbauen' })
  @IsString()
  @MaxLength(120)
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'home_cleaning' })
  @IsString()
  @MaxLength(80)
  serviceKey: string;

  @ApiPropertyOptional({ example: '64f0c1a2b3c4d5e6f7a8b9c0', description: 'City id from /catalog/cities' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cityId?: string;

  @ApiPropertyOptional({ example: 'Frankfurt am Main', description: 'City name (used when cityId is not provided)' })
  @ValidateIf((o) => !o.cityId)
  @IsString()
  @MaxLength(120)
  cityName?: string;

  @ApiPropertyOptional({ example: 50.1109, description: 'Latitude (WGS84)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 8.6821, description: 'Longitude (WGS84)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiProperty({ example: 'apartment', enum: ['apartment', 'house'] })
  @IsIn(['apartment', 'house'])
  propertyType: 'apartment' | 'house';

  @ApiProperty({ example: 55, description: 'Area in m²' })
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  area: number;

  @ApiPropertyOptional({ example: 120, description: 'Optional price in EUR' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  @IsDateString()
  preferredDate: string;

  @ApiProperty({ example: false })
  @Type(() => Boolean)
  @IsBoolean()
  isRecurring: boolean;

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
