// src/modules/catalog/services/services.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogServicesService } from './services.service';
import { ServiceDto } from './dto/service.dto';
import { ServiceCategoryDto } from './dto/service-category.dto';
import { ApiErrors } from '../../../common/swagger/api-errors.decorator';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogServicesController {
  constructor(private readonly catalog: CatalogServicesService) {}

  @Get('service-categories')
  @ApiOperation({ summary: 'List service categories (active)' })
  @ApiOkResponse({ type: ServiceCategoryDto, isArray: true })
  @ApiErrors({ unauthorized: false, forbidden: false, conflict: false, notFound: false })
  async categories(): Promise<ServiceCategoryDto[]> {
    const cats = await this.catalog.listCategories();
    return cats.map((c) => ({
      key: c.key,
      name: c.name ?? c.i18n?.en ?? c.i18n?.de ?? '',
      i18n: c.i18n ?? {},
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    }));
  }

  @Get('services')
  @ApiOperation({ summary: 'List services (active). Optional filter by category' })
  @ApiOkResponse({ type: ServiceDto, isArray: true })
  @ApiErrors({ unauthorized: false, forbidden: false, conflict: false, notFound: false })
  async services(@Query('category') category?: string): Promise<ServiceDto[]> {
    const items = await this.catalog.listServices(category);
    return items.map((s) => ({
      key: s.key,
      name: s.name ?? s.i18n?.en ?? s.i18n?.de ?? '',
      i18n: s.i18n ?? {},
      categoryKey: s.categoryKey,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
    }));
  }
}
