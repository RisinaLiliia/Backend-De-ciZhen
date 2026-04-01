// src/modules/catalog/cities.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPublicErrors } from "../../../common/swagger/api-errors.decorator";
import { CitiesService } from "./cities.service";
import { CityResponseDto } from "./dto/city-response.dto";
import { CitiesListQueryDto } from "./dto/cities-list-query.dto";

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
    description:
      "Returns active cities for browse and autocomplete flows. Supports countryCode, q, ids, and limit.",
  })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: CityResponseDto, isArray: true })
  @ApiPublicErrors()
  async list(@Query() query: CitiesListQueryDto): Promise<CityResponseDto[]> {
    const limit = query.limit ?? 50;
    const normalizedQuery = query.q?.trim() ?? "";

    if (query.ids?.length && !normalizedQuery) {
      const cities = await this.citiesService.listByIds(query.ids, query.countryCode);
      return cities.slice(0, limit).map((city) => this.toDto(city));
    }

    const [matchedCities, selectedCities] = await Promise.all([
      normalizedQuery
        ? this.citiesService.searchCities(normalizedQuery, limit, query.countryCode)
        : this.citiesService.listActive(query.countryCode, limit),
      query.ids?.length
        ? this.citiesService.listByIds(query.ids, query.countryCode)
        : Promise.resolve([]),
    ]);

    const merged = [...selectedCities, ...matchedCities];
    const unique = new Map<string, CityResponseDto>();

    for (const city of merged) {
      const dto = this.toDto(city);
      if (!unique.has(dto._id)) {
        unique.set(dto._id, dto);
      }
      if (unique.size >= limit) break;
    }

    return Array.from(unique.values());
  }
}
