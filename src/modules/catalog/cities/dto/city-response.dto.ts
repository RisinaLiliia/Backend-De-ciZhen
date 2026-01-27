// src/modules/catalog/cities/dto/city-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class CityResponseDto {
  @ApiProperty({ example: "64f0c1a2b3c4d5e6f7a8b9c0" })
  id: string;

  @ApiProperty({ example: "Berlin" })
  name: string;

  @ApiProperty({ example: "DE" })
  countryCode: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}
