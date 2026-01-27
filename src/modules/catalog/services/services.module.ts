// src/modules/catalog/services/services.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogServicesController } from './services.controller';
import { CatalogServicesService } from './services.service';
import { Service, ServiceSchema } from './schemas/service.schema';
import { ServiceCategory, ServiceCategorySchema } from './schemas/service-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: ServiceCategory.name, schema: ServiceCategorySchema },
    ]),
  ],
  controllers: [CatalogServicesController],
  providers: [CatalogServicesService],
  exports: [CatalogServicesService],
})
export class CatalogServicesModule {}
