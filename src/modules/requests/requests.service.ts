// src/modules/requests/requests.service.ts
import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Request, RequestDocument, RequestStatus } from './schemas/request.schema';
import type { CreateRequestDto } from './dto/create-request.dto';
import { CatalogServicesService } from '../catalog/services/services.service';
import { CitiesService } from '../catalog/cities/cities.service';

type ListFilters = { status?: RequestStatus; from?: Date; to?: Date };
type ListPagination = { limit?: number; offset?: number };

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name)
    private readonly model: Model<RequestDocument>,
    private readonly catalogServices: CatalogServicesService,
    private readonly cities: CitiesService,
  ) {}

  private ensureObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${field} must be a valid ObjectId`);
    }
  }

  private parseDateOrThrow(value: string, field: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} must be a valid ISO date`);
    return d;
  }

  private buildLocation(input: { lat?: number; lng?: number } | undefined): { type: 'Point'; coordinates: [number, number] } | null {
    if (!input) return null;
    const lat = typeof input.lat === 'number' ? input.lat : undefined;
    const lng = typeof input.lng === 'number' ? input.lng : undefined;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return { type: 'Point', coordinates: [lng, lat] };
    }
    if (typeof lat === 'number' || typeof lng === 'number') {
      throw new BadRequestException('lat and lng must be provided together');
    }
    return null;
  }

  private applyGeoFilter(
    q: Record<string, unknown>,
    input: { lat?: number; lng?: number; radiusKm?: number } | undefined,
  ) {
    if (!input) return false;
    const lat = typeof input.lat === 'number' ? input.lat : undefined;
    const lng = typeof input.lng === 'number' ? input.lng : undefined;
    if (typeof lat === 'number' && typeof lng === 'number') {
      const radiusKm = typeof input.radiusKm === 'number' ? input.radiusKm : 10;
      if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
        throw new BadRequestException('radiusKm must be > 0');
      }
      const earthRadiusKm = 6378.1;
      q.location = {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusKm / earthRadiusKm],
        },
      };
      return true;
    }
    if (typeof lat === 'number' || typeof lng === 'number') {
      throw new BadRequestException('lat and lng must be provided together');
    }
    return false;
  }

  normalizeFilters(input?: {
    status?: RequestStatus;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): (ListFilters & ListPagination) | undefined {
    if (!input) return undefined;

    const filters: ListFilters & ListPagination = {};
    if (input.status) filters.status = input.status;
    if (input.from) filters.from = this.parseDateOrThrow(input.from, 'from');
    if (input.to) filters.to = this.parseDateOrThrow(input.to, 'to');

    if (filters.from && filters.to && filters.to.getTime() < filters.from.getTime()) {
      throw new BadRequestException('to must be >= from');
    }

    if (typeof input.limit === 'number') filters.limit = input.limit;
    if (typeof input.offset === 'number') filters.offset = input.offset;

    return filters;
  }

  async createPublic(dto: CreateRequestDto, clientId?: string | null): Promise<RequestDocument> {
    const serviceKey = String(dto.serviceKey).trim().toLowerCase();
    const cityId = typeof dto.cityId === 'string' ? dto.cityId.trim() : '';

    const servicePromise = this.catalogServices.getServiceByKey(serviceKey);
    const cityIdIsValid = cityId.length > 0 && Types.ObjectId.isValid(cityId);
    const cityPromise = cityIdIsValid ? this.cities.getById(cityId) : Promise.resolve(null);
    let [service, city] = await Promise.all([servicePromise, cityPromise]);

    if (!service) throw new BadRequestException('serviceKey not found');
    const cityNameInput = typeof dto.cityName === 'string' ? dto.cityName.trim() : '';
    if (cityId.length > 0 && !cityIdIsValid && cityNameInput.length === 0) {
      throw new BadRequestException('cityId must be a valid ObjectId');
    }
    if (cityId.length > 0 && !city && cityNameInput.length > 0) {
      city = await this.cities.createDynamic(cityNameInput);
    }
    if (cityId.length > 0 && !city) throw new BadRequestException('cityId not found');

    const category = await this.catalogServices.getCategoryByKey(service.categoryKey);

    const title = String(dto.title).trim();
    const description = dto.description ? String(dto.description).trim() : null;
    const photosInput: any = (dto as any).photos;
    const tagsInput: any = (dto as any).tags;
    const photos = Array.isArray(photosInput)
      ? photosInput.map((x) => String(x).trim()).filter((x) => x.length > 0)
      : typeof photosInput === 'string' && photosInput.trim().length > 0
        ? photosInput.split(',').map((x) => x.trim()).filter((x) => x.length > 0)
        : [];
    const tags = Array.isArray(tagsInput)
      ? tagsInput.map((x) => String(x).trim().toLowerCase()).filter((x) => x.length > 0)
      : typeof tagsInput === 'string' && tagsInput.trim().length > 0
        ? tagsInput.split(',').map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0)
        : [];

    const location = this.buildLocation({ lat: dto.lat, lng: dto.lng });
    if (cityId.length === 0 && cityNameInput.length === 0) {
      throw new BadRequestException('cityName is required when cityId is not provided');
    }
    if (cityId.length === 0 && !location) {
      throw new BadRequestException('lat and lng are required when cityId is not provided');
    }
    if (cityId.length === 0 && cityNameInput.length > 0) {
      city = await this.cities.createDynamic(cityNameInput);
    }
    const cityName = city
      ? city.name ?? (city.i18n as any)?.en ?? city.key ?? cityId
      : cityNameInput;
    const subcategoryName = service.name ?? (service.i18n as any)?.en ?? service.key;
    const categoryName = category?.name ?? (category?.i18n as any)?.en ?? category?.key ?? null;

    const imageUrl = photos[0] ?? null;
    const searchText = [title, description, tags.join(' '), cityName, categoryName, subcategoryName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const doc = await this.model.create({
      title,
      clientId: clientId ?? null,
      serviceKey,
      cityId: city?._id?.toString?.() ?? (cityId.length > 0 ? cityId : null),
      cityName,
      location,
      categoryKey: service.categoryKey,
      categoryName,
      subcategoryName,
      propertyType: dto.propertyType,
      area: dto.area,
      price: typeof dto.price === 'number' ? dto.price : null,
      preferredDate: new Date(dto.preferredDate),
      isRecurring: dto.isRecurring,
      comment: dto.comment ? String(dto.comment).trim() : null,
      description,
      photos,
      imageUrl,
      tags,
      searchText,
      status: 'published',
    });

    return doc;
  }

  async createForClient(dto: CreateRequestDto, clientId: string): Promise<RequestDocument> {
    const serviceKey = String(dto.serviceKey).trim().toLowerCase();
    const cityId = typeof dto.cityId === 'string' ? dto.cityId.trim() : '';

    const servicePromise = this.catalogServices.getServiceByKey(serviceKey);
    const cityIdIsValid = cityId.length > 0 && Types.ObjectId.isValid(cityId);
    const cityPromise = cityIdIsValid ? this.cities.getById(cityId) : Promise.resolve(null);
    let [service, city] = await Promise.all([servicePromise, cityPromise]);

    if (!service) throw new BadRequestException('serviceKey not found');
    const cityNameInput = typeof dto.cityName === 'string' ? dto.cityName.trim() : '';
    if (cityId.length > 0 && !cityIdIsValid && cityNameInput.length === 0) {
      throw new BadRequestException('cityId must be a valid ObjectId');
    }
    if (cityId.length > 0 && !city && cityNameInput.length > 0) {
      city = await this.cities.createDynamic(cityNameInput);
    }
    if (cityId.length > 0 && !city) throw new BadRequestException('cityId not found');

    const category = await this.catalogServices.getCategoryByKey(service.categoryKey);

    const title = String(dto.title).trim();
    const description = dto.description ? String(dto.description).trim() : null;
    const photosInput: any = (dto as any).photos;
    const tagsInput: any = (dto as any).tags;
    const photos = Array.isArray(photosInput)
      ? photosInput.map((x) => String(x).trim()).filter((x) => x.length > 0)
      : typeof photosInput === 'string' && photosInput.trim().length > 0
        ? photosInput.split(',').map((x) => x.trim()).filter((x) => x.length > 0)
        : [];
    const tags = Array.isArray(tagsInput)
      ? tagsInput.map((x) => String(x).trim().toLowerCase()).filter((x) => x.length > 0)
      : typeof tagsInput === 'string' && tagsInput.trim().length > 0
        ? tagsInput.split(',').map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0)
        : [];

    const location = this.buildLocation({ lat: dto.lat, lng: dto.lng });
    if (cityId.length === 0 && cityNameInput.length === 0) {
      throw new BadRequestException('cityName is required when cityId is not provided');
    }
    if (cityId.length === 0 && !location) {
      throw new BadRequestException('lat and lng are required when cityId is not provided');
    }
    if (cityId.length === 0 && cityNameInput.length > 0) {
      city = await this.cities.createDynamic(cityNameInput);
    }
    const cityName = city
      ? city.name ?? (city.i18n as any)?.en ?? city.key ?? cityId
      : cityNameInput;
    const subcategoryName = service.name ?? (service.i18n as any)?.en ?? service.key;
    const categoryName = category?.name ?? (category?.i18n as any)?.en ?? category?.key ?? null;

    const imageUrl = photos[0] ?? null;
    const searchText = [title, description, tags.join(' '), cityName, categoryName, subcategoryName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const doc = await this.model.create({
      title,
      clientId,
      serviceKey,
      cityId: city?._id?.toString?.() ?? (cityId.length > 0 ? cityId : null),
      cityName,
      location,
      categoryKey: service.categoryKey,
      categoryName,
      subcategoryName,
      propertyType: dto.propertyType,
      area: dto.area,
      price: typeof dto.price === 'number' ? dto.price : null,
      preferredDate: new Date(dto.preferredDate),
      isRecurring: dto.isRecurring,
      comment: dto.comment ? String(dto.comment).trim() : null,
      description,
      photos,
      imageUrl,
      tags,
      searchText,
      status: 'draft',
    });

    return doc;
  }

  async publishForClient(clientId: string, requestId: string): Promise<RequestDocument> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const existing = await this.model.findById(rid).exec();
    if (!existing || String(existing.clientId) !== clientId) {
      throw new NotFoundException('Request not found');
    }
    if (existing.status !== 'draft') {
      throw new ConflictException('Only draft requests can be published');
    }

    const updated = await this.model
      .findOneAndUpdate({ _id: rid, clientId }, { $set: { status: 'published' } }, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Request not found');
    return updated;
  }

  async listPublic(filters: {
    cityId?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    serviceKey?: string;
    categoryKey?: string;
    subcategoryKey?: string;
    sort?: 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc';
    page?: number;
    limit?: number;
    offset?: number;
    priceMin?: number;
    priceMax?: number;
  }): Promise<RequestDocument[]> {
    const q: Record<string, unknown> = { status: 'published' };

    const hasGeo = this.applyGeoFilter(q, {
      lat: filters.lat,
      lng: filters.lng,
      radiusKm: filters.radiusKm,
    });

    if (!hasGeo) {
      const cityId = (filters.cityId ?? '').trim();
      if (cityId.length > 0) q.cityId = cityId;
    }

    const subKey = (filters.subcategoryKey ?? filters.serviceKey ?? '').trim().toLowerCase();
    const categoryKey = (filters.categoryKey ?? '').trim().toLowerCase();

    if (subKey.length > 0) {
      q.serviceKey = subKey;

      if (categoryKey.length > 0) {
        const services = await this.catalogServices.listServices(categoryKey);
        const allowed = new Set(services.map((s) => s.key));
        if (!allowed.has(subKey)) return [];
      }
    } else if (categoryKey.length > 0) {
      const services = await this.catalogServices.listServices(categoryKey);
      if (services.length === 0) return [];
      q.serviceKey = { $in: services.map((s) => s.key) };
    }

    if (typeof filters.priceMin === 'number' || typeof filters.priceMax === 'number') {
      const min = typeof filters.priceMin === 'number' ? filters.priceMin : undefined;
      const max = typeof filters.priceMax === 'number' ? filters.priceMax : undefined;
      if (typeof min === 'number' && typeof max === 'number' && max < min) {
        throw new BadRequestException('priceMax must be >= priceMin');
      }
      q.price = {};
      if (typeof min === 'number') (q.price as any).$gte = min;
      if (typeof max === 'number') (q.price as any).$lte = max;
    }

    const sortKey = filters.sort ?? 'date_desc';
    const sort: Record<string, 1 | -1> =
      sortKey === 'date_asc'
        ? { createdAt: 1 }
        : sortKey === 'price_asc'
          ? { price: 1, createdAt: -1 }
          : sortKey === 'price_desc'
            ? { price: -1, createdAt: -1 }
            : { createdAt: -1 };

    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offsetRaw =
      typeof filters.offset === 'number'
        ? filters.offset
        : typeof filters.page === 'number'
          ? (filters.page - 1) * limit
          : 0;
    const offset = Math.max(offsetRaw, 0);

    return this.model.find(q).sort(sort).skip(offset).limit(limit).exec();
  }

  async countPublic(filters: {
    cityId?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    serviceKey?: string;
    categoryKey?: string;
    subcategoryKey?: string;
    priceMin?: number;
    priceMax?: number;
  }): Promise<number> {
    const q: Record<string, unknown> = { status: 'published' };

    const hasGeo = this.applyGeoFilter(q, {
      lat: filters.lat,
      lng: filters.lng,
      radiusKm: filters.radiusKm,
    });

    if (!hasGeo) {
      const cityId = (filters.cityId ?? '').trim();
      if (cityId.length > 0) q.cityId = cityId;
    }

    const subKey = (filters.subcategoryKey ?? filters.serviceKey ?? '').trim().toLowerCase();
    const categoryKey = (filters.categoryKey ?? '').trim().toLowerCase();

    if (subKey.length > 0) {
      q.serviceKey = subKey;

      if (categoryKey.length > 0) {
        const services = await this.catalogServices.listServices(categoryKey);
        const allowed = new Set(services.map((s) => s.key));
        if (!allowed.has(subKey)) return 0;
      }
    } else if (categoryKey.length > 0) {
      const services = await this.catalogServices.listServices(categoryKey);
      if (services.length === 0) return 0;
      q.serviceKey = { $in: services.map((s) => s.key) };
    }

    if (typeof filters.priceMin === 'number' || typeof filters.priceMax === 'number') {
      const min = typeof filters.priceMin === 'number' ? filters.priceMin : undefined;
      const max = typeof filters.priceMax === 'number' ? filters.priceMax : undefined;
      if (typeof min === 'number' && typeof max === 'number' && max < min) {
        throw new BadRequestException('priceMax must be >= priceMin');
      }
      q.price = {};
      if (typeof min === 'number') (q.price as any).$gte = min;
      if (typeof max === 'number') (q.price as any).$lte = max;
    }

    return this.model.countDocuments(q).exec();
  }

  async listMyClient(
    clientId: string,
    filters?: ListFilters & ListPagination,
  ): Promise<RequestDocument[]> {
    const q: Record<string, any> = { clientId };
    if (filters?.status) q.status = filters.status;

    if (filters?.from || filters?.to) {
      q.createdAt = {};
      if (filters.from) q.createdAt.$gte = filters.from;
      if (filters.to) q.createdAt.$lt = filters.to;
    }

    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);

    return this.model.find(q).sort({ createdAt: -1 }).skip(offset).limit(limit).exec();
  }
}
