// src/modules/catalog/cities/cities.service.ts
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { City, CityDocument } from "./schemas/city.schema";

const CITY_GEO_FALLBACK: Record<string, { lat: number; lng: number }> = {
  hamburg: { lat: 53.5511, lng: 9.9937 },
  berlin: { lat: 52.52, lng: 13.405 },
  bremen: { lat: 53.0793, lng: 8.8017 },
  hannover: { lat: 52.3759, lng: 9.732 },
  dortmund: { lat: 51.5136, lng: 7.4653 },
  duisburg: { lat: 51.4344, lng: 6.7623 },
  essen: { lat: 51.4556, lng: 7.0116 },
  dusseldorf: { lat: 51.2277, lng: 6.7735 },
  koln: { lat: 50.9375, lng: 6.9603 },
  bonn: { lat: 50.7374, lng: 7.0982 },
  mannheim: { lat: 49.4875, lng: 8.466 },
  heidelberg: { lat: 49.3988, lng: 8.6724 },
  karlsruhe: { lat: 49.0069, lng: 8.4037 },
  ludwigshafen: { lat: 49.4774, lng: 8.4452 },
  darmstadt: { lat: 49.8728, lng: 8.6512 },
  frankfurt: { lat: 50.1109, lng: 8.6821 },
  wiesbaden: { lat: 50.0782, lng: 8.2398 },
  mainz: { lat: 49.9929, lng: 8.2473 },
  stuttgart: { lat: 48.7758, lng: 9.1829 },
  nurnberg: { lat: 49.4521, lng: 11.0767 },
  leipzig: { lat: 51.3397, lng: 12.3731 },
  dresden: { lat: 51.0504, lng: 13.7373 },
  augsburg: { lat: 48.3705, lng: 10.8978 },
  munchen: { lat: 48.1351, lng: 11.582 },
};

type CityGeoReference = {
  cityId?: string | null;
  citySlug: string;
  cityName?: string | null;
  countryCode?: string | null;
};

type CityGeoResolution = {
  cityId: string | null;
  lat: number | null;
  lng: number | null;
};

type NormalizedCityGeoReference = {
  cityId: string | null;
  citySlug: string;
  cityName: string;
  countryCode: string;
};

type NearbyCityParams = {
  cityId: string;
  radiusKm?: number;
  countryCode?: string;
  limit?: number;
};

type CitySearchTokens = {
  normalizedQuery: string;
  nameToken: string;
  postalToken: string;
};

@Injectable()
export class CitiesService {
  constructor(@InjectModel(City.name) private readonly cityModel: Model<CityDocument>) {}

  private buildActiveFilter(countryCode?: string): Record<string, unknown> {
    const filter: Record<string, unknown> = { isActive: true };

    if (countryCode && countryCode.trim().length > 0) {
      filter.countryCode = countryCode.trim().toUpperCase();
    }

    return filter;
  }

  async listActive(countryCode?: string, limit?: number): Promise<CityDocument[]> {
    const filter = this.buildActiveFilter(countryCode);
    const safeLimit =
      typeof limit === "number"
        ? Math.max(1, Math.min(100, Math.round(limit)))
        : null;

    const query = this.cityModel
      .find(filter)
      .sort({ sortOrder: 1, population: -1, "i18n.en": 1, name: 1 });

    if (safeLimit !== null) {
      query.limit(safeLimit);
    }

    return query.exec();
  }

  async listByIds(ids: string[], countryCode?: string): Promise<CityDocument[]> {
    const normalizedIds = Array.from(
      new Set(
        ids
          .map((id) => String(id ?? "").trim())
          .filter((id) => id.length > 0),
      ),
    );
    if (normalizedIds.length === 0) return [];

    const filter: Record<string, unknown> = {
      ...this.buildActiveFilter(countryCode),
      _id: { $in: normalizedIds },
    };

    return this.cityModel
      .find(filter)
      .sort({ sortOrder: 1, population: -1, "i18n.en": 1, name: 1 })
      .exec();
  }

  async getById(id: string): Promise<CityDocument | null> {
    const normalized = (id ?? '').trim();
    if (!normalized) return null;
    return this.cityModel.findById(normalized).exec();
  }

  async findActiveByLabel(label: string, countryCode?: string): Promise<CityDocument | null> {
    const normalizedLabel = this.normalizeGeoKey(label);
    if (!normalizedLabel) return null;

    return this.cityModel
      .findOne({
        ...this.buildActiveFilter(countryCode),
        $or: [
          { normalizedName: normalizedLabel },
          { normalizedAliases: { $in: [normalizedLabel] } },
        ],
      })
      .sort({ population: -1, sortOrder: 1, name: 1 })
      .exec();
  }

  private normalizeGeoKey(value: string | null | undefined): string {
    return String(value ?? "")
      .replace(/ß/g, "ss")
      .replace(/ä/gi, (match) => (match === "Ä" ? "Ae" : "ae"))
      .replace(/ö/gi, (match) => (match === "Ö" ? "Oe" : "oe"))
      .replace(/ü/gi, (match) => (match === "Ü" ? "Ue" : "ue"))
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  private roundCoord(value: number, decimals = 6): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  private toValidLatLng(
    latRaw: unknown,
    lngRaw: unknown,
  ): { lat: number; lng: number } | null {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90) return null;
    if (lng < -180 || lng > 180) return null;
    if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return null;
    return {
      lat: this.roundCoord(lat),
      lng: this.roundCoord(lng),
    };
  }

  private toLocation(lat: number | null, lng: number | null) {
    if (lat === null || lng === null) return null;
    return {
      type: "Point" as const,
      coordinates: [lng, lat] as [number, number],
    };
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private toCatalogKeyToken(value: string): string {
    return value.replace(/\s+/g, "_");
  }

  private normalizePostalCode(value: string | null | undefined): string {
    return String(value ?? "").replace(/\D+/g, "").trim();
  }

  private extractSearchTokens(rawQuery: string): CitySearchTokens {
    const compactQuery = String(rawQuery ?? "").trim().replace(/\s+/g, " ");
    const postalToken = this.normalizePostalCode(compactQuery.match(/\b\d{3,10}\b/)?.[0]);
    const textPart = postalToken
      ? compactQuery.replace(new RegExp(`\\b${this.escapeRegex(postalToken)}\\b`, "g"), " ")
      : compactQuery;

    return {
      normalizedQuery: this.normalizeGeoKey(compactQuery),
      nameToken: this.normalizeGeoKey(textPart),
      postalToken,
    };
  }

  private getCitySearchPostalCodes(city: Partial<CityDocument>): string[] {
    return Array.isArray(city.postalCodes)
      ? city.postalCodes
          .map((value) => this.normalizePostalCode(value))
          .filter((value) => value.length > 0)
      : [];
  }

  private getCitySearchNameTokens(city: Partial<CityDocument>): string[] {
    const i18nValues =
      city.i18n && typeof city.i18n === "object"
        ? Object.values(city.i18n).map((value) => this.normalizeGeoKey(String(value ?? "")))
        : [];
    const aliasValues = Array.isArray(city.normalizedAliases)
      ? city.normalizedAliases.map((value) => this.normalizeGeoKey(value))
      : [];

    return Array.from(
      new Set(
        [
          this.normalizeGeoKey(city.normalizedName),
          this.normalizeGeoKey(city.name),
          this.normalizeGeoKey(city.key?.replace(/_/g, " ")),
          ...aliasValues,
          ...i18nValues,
        ].filter((value) => value.length > 0),
      ),
    );
  }

  private scoreCitySearchMatch(city: Partial<CityDocument>, tokens: CitySearchTokens): number {
    let score = 0;
    const postalCodes = this.getCitySearchPostalCodes(city);
    const nameTokens = this.getCitySearchNameTokens(city);

    if (tokens.postalToken) {
      if (postalCodes.some((postalCode) => postalCode === tokens.postalToken)) {
        score += 500;
      } else if (postalCodes.some((postalCode) => postalCode.startsWith(tokens.postalToken))) {
        score += 320;
      }
    }

    if (tokens.nameToken) {
      const exactNameMatch = nameTokens.some((token) => token === tokens.nameToken);
      const prefixNameMatch = nameTokens.some((token) => token.startsWith(tokens.nameToken));

      if (exactNameMatch) {
        score += 220;
      } else if (prefixNameMatch) {
        score += 160;
      }
    }

    if (!tokens.nameToken && !tokens.postalToken && tokens.normalizedQuery) {
      if (nameTokens.some((token) => token === tokens.normalizedQuery)) {
        score += 180;
      } else if (nameTokens.some((token) => token.startsWith(tokens.normalizedQuery))) {
        score += 120;
      }
    }

    const population = typeof city.population === "number" ? city.population : 0;
    if (population > 0) {
      score += Math.min(60, Math.round(Math.log10(population + 1) * 10));
    }

    const sortOrder = typeof city.sortOrder === "number" ? city.sortOrder : 0;
    score += Math.max(0, 20 - Math.min(sortOrder, 20));

    return score;
  }

  private buildActivityLookupQuery(refs: NormalizedCityGeoReference[]): Record<string, unknown> | null {
    const cityIds = Array.from(
      new Set(
        refs
          .map((ref) => ref.cityId)
          .filter(
            (cityId): cityId is string =>
              typeof cityId === "string"
              && cityId.length > 0
              && Types.ObjectId.isValid(cityId),
          ),
      ),
    );
    const geoTokens = Array.from(
      new Set(
        refs.flatMap((ref) => [ref.citySlug, ref.cityName]).filter((token) => token.length > 0),
      ),
    );
    const keyTokens = Array.from(new Set(geoTokens.map((token) => this.toCatalogKeyToken(token))));

    const conditions: Record<string, unknown>[] = [];
    if (cityIds.length > 0) {
      conditions.push({ _id: { $in: cityIds } });
    }
    if (keyTokens.length > 0) {
      conditions.push({ key: { $in: keyTokens } });
    }
    if (geoTokens.length > 0) {
      conditions.push({ normalizedName: { $in: geoTokens } });
      conditions.push({ normalizedAliases: { $in: geoTokens } });
    }

    if (conditions.length === 0) return null;

    const countryCodes = Array.from(new Set(refs.map((ref) => ref.countryCode)));
    return {
      isActive: true,
      ...(countryCodes.length === 1
        ? { countryCode: countryCodes[0] }
        : { countryCode: { $in: countryCodes } }),
      $or: conditions,
    };
  }

  async resolveCityByName(name: string, countryCode?: string): Promise<CityDocument | null> {
    const normalizedName = this.normalizeGeoKey(name);
    if (!normalizedName) return null;

    const filter: Record<string, unknown> = { isActive: true };
    if (countryCode && countryCode.trim().length > 0) {
      filter.countryCode = countryCode.trim().toUpperCase();
    }

    return this.cityModel
      .findOne({
        ...filter,
        $or: [
          { normalizedName },
          { normalizedAliases: normalizedName },
          { key: normalizedName.replace(/\s+/g, "_") },
        ],
      })
      .exec();
  }

  async searchCities(query: string, limit = 10, countryCode?: string): Promise<CityDocument[]> {
    const tokens = this.extractSearchTokens(query);
    if (!tokens.normalizedQuery && !tokens.postalToken) return [];

    const safeLimit = Math.max(1, Math.min(50, Math.round(limit || 10)));
    const filter = this.buildActiveFilter(countryCode);
    const candidateLimit = Math.min(100, Math.max(safeLimit * 4, 12));
    const lookups: Promise<CityDocument[]>[] = [];

    if (tokens.postalToken) {
      const postalPrefix = new RegExp(`^${this.escapeRegex(tokens.postalToken)}`);
      lookups.push(
        this.cityModel
          .find({
            ...filter,
            postalCodes: postalPrefix,
          })
          .sort({ sortOrder: 1, population: -1, normalizedName: 1 })
          .limit(candidateLimit)
          .exec(),
      );
    }

    const nameQuery = tokens.nameToken || (!tokens.postalToken ? tokens.normalizedQuery : "");
    if (nameQuery) {
      const prefix = new RegExp(`^${this.escapeRegex(nameQuery)}`, "i");
      lookups.push(
        this.cityModel
          .find({
            ...filter,
            $or: [{ normalizedName: prefix }, { normalizedAliases: prefix }],
          })
          .sort({ sortOrder: 1, population: -1, normalizedName: 1 })
          .limit(candidateLimit)
          .exec(),
      );
    }

    const resultSets = await Promise.all(lookups);
    const unique = new Map<string, CityDocument>();
    for (const resultSet of resultSets) {
      for (const city of resultSet) {
        const cityId = city._id.toString();
        if (!unique.has(cityId)) {
          unique.set(cityId, city);
        }
      }
    }

    return Array.from(unique.values())
      .sort((left, right) => {
        const scoreDelta = this.scoreCitySearchMatch(right, tokens) - this.scoreCitySearchMatch(left, tokens);
        if (scoreDelta !== 0) return scoreDelta;

        const leftSortOrder = typeof left.sortOrder === "number" ? left.sortOrder : 0;
        const rightSortOrder = typeof right.sortOrder === "number" ? right.sortOrder : 0;
        if (leftSortOrder !== rightSortOrder) return leftSortOrder - rightSortOrder;

        const leftPopulation = typeof left.population === "number" ? left.population : 0;
        const rightPopulation = typeof right.population === "number" ? right.population : 0;
        if (leftPopulation !== rightPopulation) return rightPopulation - leftPopulation;

        const leftName = this.normalizeGeoKey(left.name ?? left.normalizedName ?? left.key);
        const rightName = this.normalizeGeoKey(right.name ?? right.normalizedName ?? right.key);
        return leftName.localeCompare(rightName);
      })
      .slice(0, safeLimit);
  }

  async getNearbyCities(params: NearbyCityParams): Promise<CityDocument[]> {
    const anchor = await this.getById(params.cityId);
    if (!anchor || !anchor.location?.coordinates) return [];

    const radiusKm = Math.max(1, params.radiusKm ?? 50);
    const limit = Math.max(1, Math.min(100, Math.round(params.limit ?? 20)));
    const filter: Record<string, unknown> = {
      isActive: true,
      _id: { $ne: anchor._id },
      location: {
        $nearSphere: {
          $geometry: anchor.location,
          $maxDistance: radiusKm * 1000,
        },
      },
    };
    if (params.countryCode && params.countryCode.trim().length > 0) {
      filter.countryCode = params.countryCode.trim().toUpperCase();
    }

    return this.cityModel
      .find(filter)
      .limit(limit)
      .exec();
  }

  async resolveActivityCoords(
    refs: CityGeoReference[],
  ): Promise<Map<string, CityGeoResolution>> {
    const normalizedRefs = refs
      .map((ref) => ({
        cityId: (ref.cityId ?? "").trim() || null,
        citySlug: this.normalizeGeoKey(ref.citySlug),
        cityName: this.normalizeGeoKey(ref.cityName),
        countryCode: (ref.countryCode ?? "").trim().toUpperCase() || "DE",
      }))
      .filter((ref) => ref.cityId !== null || ref.citySlug.length > 0 || ref.cityName.length > 0);

    if (normalizedRefs.length === 0) return new Map();

    const lookupQuery = this.buildActivityLookupQuery(normalizedRefs);
    if (!lookupQuery) return new Map();

    const cities = await this.cityModel.find(lookupQuery).exec();

    const byId = new Map<string, CityDocument>();
    const byGeoKey = new Map<string, CityDocument>();
    for (const city of cities) {
      const cityId = city._id?.toString?.();
      if (typeof cityId === "string" && cityId.trim().length > 0 && !byId.has(cityId)) {
        byId.set(cityId, city);
      }

      const geoKeys = [city.key, city.name, ...Object.values(city.i18n ?? {})]
        .map((token) => this.normalizeGeoKey(token))
        .filter((token) => token.length > 0);

      for (const geoKey of geoKeys) {
        if (!byGeoKey.has(geoKey)) {
          byGeoKey.set(geoKey, city);
        }
      }
    }

    const resolved = new Map<string, CityGeoResolution>();
    for (const ref of normalizedRefs) {
      const resultKey = ref.citySlug || ref.cityName || ref.cityId || "";
      if (!resultKey) continue;
      const city =
        (ref.cityId ? byId.get(ref.cityId) : undefined) ??
        byGeoKey.get(ref.citySlug) ??
        (ref.cityName ? byGeoKey.get(ref.cityName) : undefined) ??
        null;
      const catalogCoords = city ? this.toValidLatLng(city.lat, city.lng) : null;
      const fallbackCoords =
        CITY_GEO_FALLBACK[ref.citySlug] ??
        (ref.cityName ? CITY_GEO_FALLBACK[ref.cityName] : undefined) ??
        null;
      const coords = catalogCoords ?? fallbackCoords ?? null;
      const resolvedCityId = city?._id?.toString?.();

      resolved.set(resultKey, {
        cityId:
          typeof resolvedCityId === "string" && resolvedCityId.trim().length > 0
            ? resolvedCityId
            : ref.cityId,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
    }

    return resolved;
  }

  private normalizeKey(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 80);
  }

  async createDynamic(name: string, countryCode?: string): Promise<CityDocument> {
    const rawName = (name ?? "").trim();
    if (!rawName) throw new BadRequestException("cityName is required");

    const normalizedName = this.normalizeGeoKey(rawName);
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
      source: "manual",
      sourceId: null,
      name: rawName,
      normalizedName,
      aliases: [rawName],
      normalizedAliases: normalizedName ? [normalizedName] : [],
      stateCode: null,
      stateName: null,
      districtName: null,
      postalCodes: [],
      countryCode: country,
      population: null,
      lat: null,
      lng: null,
      isActive: false,
      sortOrder: 999,
    });
  }
}
