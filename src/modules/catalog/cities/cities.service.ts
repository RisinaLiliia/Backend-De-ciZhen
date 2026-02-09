// src/modules/catalog/cities/cities.service.ts
import { BadRequestException, Injectable } from "@nestjs/common";
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
      .sort({ sortOrder: 1, "i18n.en": 1, name: 1 })
      .exec();
  }

  async getById(id: string): Promise<CityDocument | null> {
    const normalized = (id ?? '').trim();
    if (!normalized) return null;
    return this.cityModel.findById(normalized).exec();
  }

  private normalizeKey(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[\s\-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 80);
  }

  async createDynamic(name: string, countryCode?: string): Promise<CityDocument> {
    const rawName = (name ?? "").trim();
    if (!rawName) throw new BadRequestException("cityName is required");

    const baseKey = this.normalizeKey(rawName);
    if (!baseKey) throw new BadRequestException("cityName is invalid");

    let key = baseKey;
    let suffix = 1;
    // Ensure key uniqueness; reuse existing when same key already present.
    // Avoid infinite loops by capping suffix attempts.
    for (;;) {
      const existing = await this.cityModel.findOne({ key }).exec();
      if (!existing) break;
      if ((existing.name ?? "").toLowerCase() === rawName.toLowerCase()) return existing;
      suffix += 1;
      if (suffix > 50) throw new BadRequestException("cityName is not unique enough");
      key = `${baseKey}_${suffix}`;
    }

    const country = (countryCode ?? "").trim().toUpperCase() || "DE";

    return this.cityModel.create({
      key,
      name: rawName,
      countryCode: country,
      isActive: false,
      sortOrder: 999,
    });
  }
}
