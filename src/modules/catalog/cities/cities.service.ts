// src/modules/catalog/cities/cities.service.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { City, CityDocument } from "./schemas/city.schema";

@Injectable()
export class CitiesService {
  constructor(@InjectModel(City.name) private readonly cityModel: Model<CityDocument>) {}

  async listActive(countryCode?: string): Promise<CityDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };

    if (countryCode && countryCode.trim().length > 0) {
      filter.countryCode = countryCode.trim().toUpperCase();
    }

    return this.cityModel
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }
}
