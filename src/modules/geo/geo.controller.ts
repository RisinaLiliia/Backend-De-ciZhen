// src/modules/geo/geo.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { GeoAutocompleteQueryDto } from './dto/geo-autocomplete-query.dto';
import { GeoAutocompleteResponseDto } from './dto/geo-autocomplete-response.dto';
import { ApiPublicErrors } from '../../common/swagger/api-errors.decorator';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete PLZ/address' })
  @ApiOkResponse({ type: GeoAutocompleteResponseDto })
  @ApiPublicErrors()
  async autocomplete(
    @Query() q: GeoAutocompleteQueryDto,
  ): Promise<GeoAutocompleteResponseDto> {
    const items = await this.geo.autocomplete({
      query: q.query,
      countryCode: q.countryCode,
      limit: q.limit,
    });

    return { items };
  }
}
