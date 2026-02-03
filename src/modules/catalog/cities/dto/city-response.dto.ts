// src/modules/catalog/cities/dto/city-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class CityResponseDto {
  @ApiProperty({ example: "6981de2e9677bda5634a385e" })
  _id: string;

  @ApiProperty({ example: "city_berlin" })
  key: string;

  @ApiProperty({ example: "Berlin" })
  name: string;

  @ApiProperty({
    example: {
      de: "Berlin",
      en: "Berlin",
    },
  })
  i18n: Record<string, string>;

  @ApiProperty({ example: "DE" })
  countryCode: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  sortOrder: number;
}
