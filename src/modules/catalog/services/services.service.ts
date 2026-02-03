// src/modules/catalog/services/services.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
import {
  ServiceCategory,
  ServiceCategoryDocument,
} from './schemas/service-category.schema';

@Injectable()
export class CatalogServicesService {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(ServiceCategory.name)
    private readonly categoryModel: Model<ServiceCategoryDocument>,
  ) {}

  async listCategories(): Promise<ServiceCategoryDocument[]> {
    return this.categoryModel
      .find({ isActive: true })
      .sort({ sortOrder: 1, 'i18n.en': 1, name: 1 })
      .exec();
  }

  async listServices(categoryKey?: string): Promise<ServiceDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };

    const normalized = (categoryKey ?? '').trim().toLowerCase();
    if (normalized.length > 0) {
      filter.categoryKey = normalized;
    }

    return this.serviceModel
      .find(filter)
      .sort({ sortOrder: 1, 'i18n.en': 1, name: 1 })
      .exec();
  }
}
