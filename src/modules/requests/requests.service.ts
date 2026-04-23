// src/modules/requests/requests.service.ts
import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Request, RequestDocument, RequestStatus } from './schemas/request.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Favorite, type FavoriteDocument } from '../favorites/schemas/favorite.schema';
import { ChatThread, type ChatThreadDocument } from '../chats/schemas/chat-thread.schema';
import type { CreateRequestDto } from './dto/create-request.dto';
import type { UpdateMyRequestDto } from './dto/update-my-request.dto';
import { CatalogServicesService } from '../catalog/services/services.service';
import { CitiesService } from '../catalog/cities/cities.service';

type ListFilters = { status?: RequestStatus; from?: Date; to?: Date };
type ListPagination = { limit?: number; offset?: number };
type DeleteMyClientRequestResult = {
  ok: true;
  deletedRequestId: string;
  result: 'deleted' | 'cancelled';
  removedFromPublicFeed: boolean;
  retainedForParticipants: boolean;
  purgeAt: Date | null;
};

const REQUEST_RETENTION_DAYS = 7;

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name)
    private readonly model: Model<RequestDocument>,
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(ChatThread.name)
    private readonly chatThreadModel: Model<ChatThreadDocument>,
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

  private buildSearchText(input: {
    title: string;
    description?: string | null;
    tags?: string[] | null;
    cityName?: string | null;
    categoryName?: string | null;
    subcategoryName?: string | null;
  }) {
    return [
      input.title,
      input.description,
      (input.tags ?? []).join(' '),
      input.cityName,
      input.categoryName,
      input.subcategoryName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private async getOwnedRequestOrThrow(clientId: string, requestId: string): Promise<RequestDocument> {
    const existing = await this.model.findById(requestId).exec();
    if (!existing || String(existing.clientId) !== clientId) {
      throw new NotFoundException('Request not found');
    }
    return existing;
  }

  private calculatePurgeAt(from: Date) {
    return new Date(from.getTime() + (REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000));
  }

  private buildInactiveMessage() {
    return 'Dieser Auftrag wurde vom Auftraggeber storniert.';
  }

  private async hasOffers(requestId: string) {
    return (await this.offerModel.countDocuments({ requestId }).exec()) > 0;
  }

  private async hasRetainedParticipants(requestId: string) {
    const [offersCount, favoritesCount, chatCount] = await Promise.all([
      this.offerModel.countDocuments({ requestId }).exec(),
      this.favoriteModel.countDocuments({ type: 'request', targetId: requestId }).exec(),
      this.chatThreadModel.countDocuments({ requestId }).exec(),
    ]);

    return offersCount > 0 || favoritesCount > 0 || chatCount > 0;
  }

  private async canViewerAccessRetainedRequest(userId: string, requestId: string, ownerId?: string | null) {
    if (userId === ownerId) return true;

    const [hasOffer, hasFavorite, hasChat] = await Promise.all([
      this.offerModel.countDocuments({
        requestId,
        $or: [{ providerUserId: userId }, { clientUserId: userId }],
      }).exec(),
      this.favoriteModel.countDocuments({ type: 'request', targetId: requestId, userId }).exec(),
      this.chatThreadModel.countDocuments({
        requestId,
        $or: [{ clientId: userId }, { providerUserId: userId }, { participants: userId }],
      }).exec(),
    ]);

    return hasOffer > 0 || hasFavorite > 0 || hasChat > 0;
  }

  private buildDuplicatePayload(source: RequestDocument, clientId: string) {
    const location =
      source.location
      && source.location.type === 'Point'
      && Array.isArray(source.location.coordinates)
      && source.location.coordinates.length === 2
      ? {
          type: 'Point' as const,
          coordinates: [source.location.coordinates[0], source.location.coordinates[1]] as [number, number],
        }
      : undefined;

    return {
      title: source.title,
      clientId,
      serviceKey: source.serviceKey,
      cityId: source.cityId ?? null,
      cityName: source.cityName,
      ...(location ? { location } : {}),
      propertyType: source.propertyType,
      area: source.area,
      price: typeof source.price === 'number' ? source.price : null,
      previousPrice: null,
      priceTrend: null,
      preferredDate: new Date(),
      isRecurring: Boolean(source.isRecurring),
      comment: source.comment ?? null,
      description: source.description ?? null,
      photos: Array.isArray(source.photos) ? [...source.photos] : [],
      imageUrl: source.imageUrl ?? (source.photos?.[0] ?? null),
      categoryKey: source.categoryKey,
      categoryName: source.categoryName ?? null,
      subcategoryName: source.subcategoryName ?? null,
      tags: Array.isArray(source.tags) ? [...source.tags] : [],
      searchText: this.buildSearchText({
        title: source.title,
        description: source.description ?? null,
        tags: Array.isArray(source.tags) ? source.tags : [],
        cityName: source.cityName,
        categoryName: source.categoryName ?? null,
        subcategoryName: source.subcategoryName ?? null,
      }),
      status: 'draft' as const,
      publishedAt: null,
      cancelledAt: null,
      purgeAt: null,
      inactiveReason: null,
      inactiveMessage: null,
      matchedProviderUserId: null,
      assignedContractId: null,
      matchedAt: null,
      archivedAt: null,
    };
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
    const searchText = this.buildSearchText({
      title,
      description,
      tags,
      cityName,
      categoryName,
      subcategoryName,
    });

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
      publishedAt: new Date(),
      cancelledAt: null,
      purgeAt: null,
      inactiveReason: null,
      inactiveMessage: null,
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
    const searchText = this.buildSearchText({
      title,
      description,
      tags,
      cityName,
      categoryName,
      subcategoryName,
    });

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
      publishedAt: null,
      cancelledAt: null,
      purgeAt: null,
      inactiveReason: null,
      inactiveMessage: null,
    });

    return doc;
  }

  async publishForClient(clientId: string, requestId: string): Promise<RequestDocument> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const existing = await this.getOwnedRequestOrThrow(clientId, rid);
    if (existing.archivedAt) {
      throw new ConflictException('Archived requests cannot be published');
    }
    if (!['draft', 'paused', 'cancelled'].includes(existing.status)) {
      throw new ConflictException('Only draft, paused or cancelled requests can be published');
    }

    const publishedAt = new Date();
    const updated = await this.model
      .findOneAndUpdate(
        { _id: rid, clientId },
        {
          $set: {
            status: 'published',
            publishedAt,
            cancelledAt: null,
            purgeAt: null,
            inactiveReason: null,
            inactiveMessage: null,
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) throw new NotFoundException('Request not found');
    return updated;
  }

  async unpublishMyClientRequest(clientId: string, requestId: string): Promise<RequestDocument> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const existing = await this.getOwnedRequestOrThrow(clientId, rid);
    if (existing.archivedAt) {
      throw new ConflictException('Archived requests cannot be unpublished');
    }
    if (existing.status !== 'published') {
      throw new ConflictException('Only published requests can be unpublished');
    }
    if (await this.hasOffers(rid)) {
      throw new ConflictException('Requests with offers cannot be unpublished');
    }

    const updated = await this.model
      .findOneAndUpdate(
        { _id: rid, clientId },
        {
          $set: {
            status: 'paused',
            cancelledAt: null,
            purgeAt: null,
            inactiveReason: null,
            inactiveMessage: null,
          },
        },
        { new: true },
      )
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
    const q: Record<string, unknown> = { status: 'published', archivedAt: null };

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
        ? { publishedAt: 1, createdAt: 1 }
        : sortKey === 'price_asc'
          ? { price: 1, publishedAt: -1, createdAt: -1 }
          : sortKey === 'price_desc'
            ? { price: -1, publishedAt: -1, createdAt: -1 }
            : { publishedAt: -1, createdAt: -1 };

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

  async getPublicById(requestId: string, viewerUserId?: string | null): Promise<RequestDocument> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const doc = await this.model.findOne({ _id: rid, archivedAt: null }).exec();
    if (!doc) throw new NotFoundException('Request not found');
    if (doc.status === 'published') return doc;

    const viewerId = String(viewerUserId ?? '').trim();
    if (
      doc.status === 'cancelled'
      && viewerId
      && await this.canViewerAccessRetainedRequest(viewerId, rid, String(doc.clientId ?? ''))
    ) {
      return doc;
    }

    throw new NotFoundException('Request not found');
  }

  async listPublicByIds(requestIds: string[]): Promise<RequestDocument[]> {
    const ids = Array.isArray(requestIds)
      ? Array.from(
          new Set(
            requestIds.map((x) => String(x)).filter((x) => Types.ObjectId.isValid(x)),
          ),
        )
      : [];
    if (ids.length === 0) return [];
    return this.model.find({ _id: { $in: ids }, status: 'published', archivedAt: null }).exec();
  }

  async listVisibleByIdsForUser(userId: string, requestIds: string[]): Promise<RequestDocument[]> {
    const ids = Array.isArray(requestIds)
      ? Array.from(new Set(requestIds.map((x) => String(x)).filter((x) => Types.ObjectId.isValid(x))))
      : [];
    if (ids.length === 0) return [];

    return this.model
      .find({
        _id: { $in: ids },
        archivedAt: null,
        $or: [
          { status: 'published' },
          {
            status: 'cancelled',
            $or: [{ clientId: userId }, { _id: { $in: ids } }],
          },
        ],
      })
      .sort({ publishedAt: -1, createdAt: -1 })
      .exec();
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
    const q: Record<string, unknown> = { status: 'published', archivedAt: null };

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
    const q: Record<string, any> = { clientId, archivedAt: null };
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

  async getMyClientRequestById(clientId: string, requestId: string): Promise<RequestDocument> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');
    return this.getOwnedRequestOrThrow(clientId, rid);
  }

  async updateMyClientRequest(
    clientId: string,
    requestId: string,
    dto: UpdateMyRequestDto,
  ): Promise<RequestDocument> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const existing = await this.getOwnedRequestOrThrow(clientId, rid);
    if (existing.archivedAt) {
      throw new ConflictException('Archived requests cannot be updated');
    }
    if (existing.status === 'matched' || existing.status === 'closed') {
      throw new ConflictException('Only draft, published, paused or cancelled requests can be updated');
    }

    const patch: Record<string, unknown> = {};
    if (typeof dto.title === 'string') patch.title = dto.title.trim();
    if (typeof dto.cityId === 'string') {
      const nextCityId = dto.cityId.trim();
      if (!Types.ObjectId.isValid(nextCityId)) {
        throw new BadRequestException('cityId must be a valid ObjectId');
      }
      const city = await this.cities.getById(nextCityId);
      if (!city) throw new BadRequestException('cityId not found');
      patch.cityId = city._id?.toString?.() ?? nextCityId;
      patch.cityName = city.name ?? (city.i18n as any)?.en ?? city.key ?? nextCityId;
      patch.location = city.location ?? null;
    }
    if (dto.propertyType !== undefined) patch.propertyType = dto.propertyType;
    if (typeof dto.area === 'number') patch.area = dto.area;
    if (typeof dto.price === 'number') {
      const nextPrice = dto.price;
      const currentPrice = typeof existing.price === 'number' ? existing.price : null;

      patch.price = nextPrice;

      if (currentPrice === null) {
        patch.previousPrice = null;
        patch.priceTrend = null;
      } else if (nextPrice < currentPrice) {
        patch.previousPrice = currentPrice;
        patch.priceTrend = 'down';
      } else if (nextPrice > currentPrice) {
        patch.previousPrice = currentPrice;
        patch.priceTrend = 'up';
      } else {
        patch.previousPrice = null;
        patch.priceTrend = null;
      }
    }
    if (typeof dto.preferredDate === 'string') patch.preferredDate = new Date(dto.preferredDate);
    if (typeof dto.isRecurring === 'boolean') patch.isRecurring = dto.isRecurring;
    if (typeof dto.comment === 'string') patch.comment = dto.comment.trim();
    if (typeof dto.description === 'string') patch.description = dto.description.trim();
    if (Array.isArray(dto.photos)) {
      const photos = dto.photos.map((x) => String(x).trim()).filter((x) => x.length > 0);
      patch.photos = photos;
      patch.imageUrl = photos[0] ?? null;
    }
    if (Array.isArray(dto.tags)) {
      patch.tags = dto.tags
        .map((x) => String(x).trim().toLowerCase())
        .filter((x) => x.length > 0);
    }

    const nextTitle = (patch.title as string | undefined) ?? existing.title;
    const nextDescription =
      (patch.description as string | undefined) ??
      (typeof existing.description === 'string' ? existing.description : '');
    const nextTags = (patch.tags as string[] | undefined) ?? (Array.isArray(existing.tags) ? existing.tags : []);

    patch.searchText = this.buildSearchText({
      title: nextTitle,
      description: nextDescription,
      tags: nextTags,
      cityName: (patch.cityName as string | undefined) ?? existing.cityName,
      categoryName: existing.categoryName,
      subcategoryName: existing.subcategoryName,
    });

    const updated = await this.model
      .findOneAndUpdate({ _id: rid, clientId }, { $set: patch }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Request not found');
    return updated;
  }

  async duplicateMyClientRequest(clientId: string, requestId: string): Promise<RequestDocument> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const existing = await this.getOwnedRequestOrThrow(clientId, rid);
    const payload = this.buildDuplicatePayload(existing, clientId);
    if (!('location' in payload) || payload.location == null) {
      delete (payload as { location?: unknown }).location;
    }
    return this.model.create(payload);
  }

  async archiveMyClientRequest(
    clientId: string,
    requestId: string,
  ): Promise<{ ok: true; archivedRequestId: string; archivedAt: Date }> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const existing = await this.getOwnedRequestOrThrow(clientId, rid);
    if (existing.archivedAt instanceof Date) {
      return {
        ok: true as const,
        archivedRequestId: rid,
        archivedAt: existing.archivedAt,
      };
    }

    const archivedAt = new Date();
    const updated = await this.model
      .findOneAndUpdate({ _id: rid, clientId }, { $set: { archivedAt } }, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Request not found');

    return {
      ok: true as const,
      archivedRequestId: rid,
      archivedAt,
    };
  }

  async deleteMyClientRequest(
    clientId: string,
    requestId: string,
  ): Promise<DeleteMyClientRequestResult> {
    const rid = String(requestId ?? '').trim();
    if (!rid) throw new BadRequestException('requestId is required');
    this.ensureObjectId(rid, 'requestId');

    const existing = await this.getOwnedRequestOrThrow(clientId, rid);
    if (existing.status === 'matched' || existing.status === 'closed') {
      throw new ConflictException('Matched or closed requests cannot be deleted');
    }

    const retainedForParticipants = await this.hasRetainedParticipants(rid);
    if (retainedForParticipants) {
      const cancelledAt = new Date();
      const purgeAt = this.calculatePurgeAt(cancelledAt);

      await this.model
        .findOneAndUpdate(
          { _id: rid, clientId },
          {
            $set: {
              status: 'cancelled',
              cancelledAt,
              purgeAt,
              inactiveReason: 'cancelled_by_customer',
              inactiveMessage: this.buildInactiveMessage(),
            },
          },
          { new: true },
        )
        .exec();

      return {
        ok: true,
        deletedRequestId: rid,
        result: 'cancelled',
        removedFromPublicFeed: true,
        retainedForParticipants: true,
        purgeAt,
      };
    }

    await this.model.deleteOne({ _id: rid, clientId }).exec();
    return {
      ok: true,
      deletedRequestId: rid,
      result: 'deleted',
      removedFromPublicFeed: true,
      retainedForParticipants: false,
      purgeAt: null,
    };
  }
}
