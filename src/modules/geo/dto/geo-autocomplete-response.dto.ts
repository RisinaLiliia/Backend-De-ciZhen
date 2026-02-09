// src/modules/geo/dto/geo-autocomplete-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeoAutocompleteItemDto {
  @ApiProperty({ example: 'Hauptbahnhof, 60329 Frankfurt am Main, Germany' })
  displayName: string;

  @ApiProperty({ example: 50.1109 })
  lat: number;

  @ApiProperty({ example: 8.6821 })
  lng: number;

  @ApiPropertyOptional({ example: 'Frankfurt am Main', nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ example: '60329', nullable: true })
  postalCode?: string | null;

  @ApiPropertyOptional({ example: 'DE', nullable: true })
  countryCode?: string | null;
}

export class GeoAutocompleteResponseDto {
  @ApiProperty({ type: GeoAutocompleteItemDto, isArray: true })
  items: GeoAutocompleteItemDto[];
}
