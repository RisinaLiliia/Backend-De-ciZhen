// src/modules/geo/dto/geo-autocomplete-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class GeoAutocompleteQueryDto {
  @ApiProperty({ example: '60306 Frankfurt', description: 'PLZ or address query' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  query: string;

  @ApiProperty({ example: 'DE', required: false, description: 'Optional country code (ISO-2)' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiProperty({ example: 5, required: false, description: 'Max results (1..10). Default 5' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
