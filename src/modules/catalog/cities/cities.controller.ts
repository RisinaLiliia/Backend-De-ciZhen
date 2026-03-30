// src/modules/catalog/cities.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPublicErrors } from "../../../common/swagger/api-errors.decorator";
import { CitiesService } from "./cities.service";
import { CityResponseDto } from "./dto/city-response.dto";

@ApiTags("catalog")
@Controller("catalog/cities")
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  private toDto(doc: any): CityResponseDto {
    const i18n = doc.i18n ?? {};
    const name =
      doc.name ??
      i18n.en ??
      Object.values(i18n)[0] ??
      "";

    return {
      _id: doc._id.toString(),
      key: doc.key,
      source: doc.source ?? "manual",
      sourceId: typeof doc.sourceId === "string" ? doc.sourceId : null,
      name,
      normalizedName: doc.normalizedName ?? name,
      i18n,
      countryCode: doc.countryCode,
      stateCode: typeof doc.stateCode === "string" ? doc.stateCode : null,
      stateName: typeof doc.stateName === "string" ? doc.stateName : null,
      districtName: typeof doc.districtName === "string" ? doc.districtName : null,
      population: typeof doc.population === "number" ? doc.population : null,
      lat: typeof doc.lat === "number" ? doc.lat : null,
      lng: typeof doc.lng === "number" ? doc.lng : null,
      isActive: doc.isActive,
      sortOrder: doc.sortOrder ?? 0,
    };
  }

  @Get()
  @ApiOperation({
    summary: "List active cities (public dictionary)",
    description: "Returns only active cities. Optionally filter by countryCode (e.g. DE).",
  })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: CityResponseDto, isArray: true })
  @ApiPublicErrors()
  async list(@Query("countryCode") countryCode?: string): Promise<CityResponseDto[]> {
    const cities = await this.citiesService.listActive(countryCode);
    return cities.map((c) => this.toDto(c));
  }
}
