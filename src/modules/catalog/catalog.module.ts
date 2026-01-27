// src/modules/catalog/catalog.module.ts
import { Module } from '@nestjs/common';
import { CitiesModule } from './cities/cities.module';
import { CatalogServicesModule } from './services/services.module';

@Module({
  imports: [CitiesModule, CatalogServicesModule],
})
export class CatalogModule {}
