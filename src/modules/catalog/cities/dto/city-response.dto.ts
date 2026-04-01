// src/modules/catalog/cities/dto/city-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class CityResponseDto {
  @ApiProperty({ example: "6981de2e9677bda5634a385e" })
  _id: string;

  @ApiProperty({ example: "city_berlin" })
  key: string;

  @ApiProperty({ example: "geonames" })
  source: string;

  @ApiProperty({ example: "2950159", nullable: true })
  sourceId: string | null;

  @ApiProperty({ example: "Berlin" })
  name: string;

  @ApiProperty({ example: "berlin" })
  normalizedName: string;

  @ApiProperty({
    example: {
      de: "Berlin",
      en: "Berlin",
    },
  })
  i18n: Record<string, string>;

  @ApiProperty({ example: "DE" })
  countryCode: string;

  @ApiProperty({ example: "BE", nullable: true })
  stateCode: string | null;

  @ApiProperty({ example: "Berlin", nullable: true })
  stateName: string | null;

  @ApiProperty({ example: "Berlin", nullable: true })
  districtName: string | null;

  @ApiProperty({ example: ["10115", "10117"] })
  postalCodes: string[];

  @ApiProperty({ example: 3669491, nullable: true })
  population: number | null;

  @ApiProperty({ example: 52.52, nullable: true })
  lat: number | null;

  @ApiProperty({ example: 13.405, nullable: true })
  lng: number | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  sortOrder: number;
}
