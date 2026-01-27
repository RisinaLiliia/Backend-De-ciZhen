// src/modules/catalog/cities.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiPublicErrors } from "../../../common/swagger/api-errors.decorator";
import { CitiesService } from "./cities.service";
import { CityResponseDto } from "./dto/city-response.dto";

@ApiTags("catalog")
@Controller("catalog/cities")
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  private toDto(doc: any): CityResponseDto {
    return {
      id: doc._id.toString(),
      name: doc.name,
      countryCode: doc.countryCode,
      isActive: doc.isActive,
    };
  }

  @Get()
  @ApiOperation({
    summary: "List active cities (public dictionary)",
    description: "Returns only active cities. Optionally filter by countryCode (e.g. DE).",
  })
  @ApiOkResponse({ type: CityResponseDto, isArray: true })
  @ApiPublicErrors()
  async list(@Query("countryCode") countryCode?: string): Promise<CityResponseDto[]> {
    const cities = await this.citiesService.listActive(countryCode);
    return cities.map((c) => this.toDto(c));
  }
}
