// src/modules/providers/providers.service.ts
import { ConflictException, Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { ProviderProfile, ProviderProfileDocument } from './schemas/provider-profile.schema';
import { isProviderProfileComplete } from './provider-profile-completeness';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectModel(ProviderProfile.name)
    private readonly model: Model<ProviderProfileDocument>,
  ) {}

  async getByUserId(userId: string): Promise<ProviderProfileDocument | null> {
    return this.model.findOne({ userId }).exec();
  }

  async getOrCreateMyProfile(userId: string): Promise<ProviderProfileDocument> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;

    try {
      return await this.model.create({
        userId,
        status: 'draft',
        isBlocked: false,
        blockedAt: null,
        serviceKeys: [],
        metadata: {},
      });
    } catch (e) {
      const after = await this.getByUserId(userId);
      if (after) return after;
      throw new ConflictException('Provider profile already exists');
    }
  }

  async updateMyProfile(
    userId: string,
    updates: Partial<Pick<ProviderProfile, 'displayName' | 'bio' | 'companyName' | 'vatId' | 'cityId' | 'serviceKeys' | 'basePrice'>>,
  ): Promise<ProviderProfileDocument> {
    const profile = await this.model.findOne({ userId }).exec();
    if (!profile) throw new NotFoundException('Provider profile not found');
    if (profile.isBlocked) throw new ForbiddenException('Provider profile is blocked');

    const normalizeText = (value: string | null | undefined) => {
      if (value === undefined) return undefined;
      const normalized = String(value ?? '').trim();
      return normalized.length > 0 ? normalized : null;
    };

    if (updates.displayName !== undefined) profile.displayName = normalizeText(updates.displayName) ?? null;
    if (updates.bio !== undefined) profile.bio = normalizeText(updates.bio) ?? null;
    if (updates.companyName !== undefined) profile.companyName = normalizeText(updates.companyName) ?? null;
    if (updates.vatId !== undefined) profile.vatId = normalizeText(updates.vatId) ?? null;
    if (updates.cityId !== undefined) profile.cityId = normalizeText(updates.cityId) ?? null;
    if (updates.serviceKeys !== undefined) {
      profile.serviceKeys = Array.from(
        new Set(
          (Array.isArray(updates.serviceKeys) ? updates.serviceKeys : [])
            .map((value) => String(value ?? '').trim().toLowerCase())
            .filter((value) => value.length > 0),
        ),
      );
    }
    if (updates.basePrice !== undefined) {
      profile.basePrice = updates.basePrice === null ? null : Number(updates.basePrice);
    }

    if (profile.status === 'draft' && !profile.isBlocked && isProviderProfileComplete(profile)) {
      profile.status = 'active';
    }
    return profile.save();
  }

  async activateIfComplete(userId: string): Promise<void> {
    const profile = await this.getOrCreateMyProfile(userId);
    if (profile.isBlocked) return;
    if (profile.status === 'draft' && isProviderProfileComplete(profile)) {
      profile.status = 'active';
      await profile.save();
    }
  }

  async applyRating(userId: string, rating: number): Promise<ProviderProfileDocument> {
    const profile = await this.getOrCreateMyProfile(userId);
    const count = Number(profile.ratingCount ?? 0);
    const avg = Number(profile.ratingAvg ?? 0);
    const nextCount = count + 1;
    const nextAvg = Math.round(((avg * count + rating) / nextCount) * 100) / 100;
    profile.ratingCount = nextCount;
    profile.ratingAvg = nextAvg;
    return profile.save();
  }

  private ensureObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${field} must be a valid ObjectId`);
    }
  }

  async blockProfile(userId: string): Promise<void> {
    const res = await this.model
      .findOneAndUpdate({ userId }, { isBlocked: true, blockedAt: new Date(), status: 'suspended' })
      .exec();
    if (!res) throw new NotFoundException('Provider profile not found');
  }

  async unblockProfile(userId: string): Promise<void> {
    const res = await this.model
      .findOneAndUpdate({ userId }, { isBlocked: false, blockedAt: null })
      .exec();
    if (!res) throw new NotFoundException('Provider profile not found');
  }

  async listPublic(filters: { cityId?: string; serviceKey?: string }): Promise<ProviderProfileDocument[]> {
    const q: Record<string, unknown> = {
      status: 'active',
      isBlocked: false,
    };

    const cityId = (filters.cityId ?? '').trim();
    if (cityId.length > 0) q.cityId = cityId;

    const serviceKey = (filters.serviceKey ?? '').trim().toLowerCase();
    if (serviceKey.length > 0) q.serviceKeys = { $in: [serviceKey] };

    return this.model
      .find(q)
      .sort({ ratingAvg: -1, ratingCount: -1, basePrice: 1, updatedAt: -1 })
      .exec();
  }

  async listPublicByIds(userIds: string[]): Promise<ProviderProfileDocument[]> {
    const ids = Array.isArray(userIds)
      ? Array.from(new Set(userIds.map((x) => String(x)).filter((x) => Types.ObjectId.isValid(x))))
      : [];
    if (ids.length === 0) return [];
    return this.model
      .find({ userId: { $in: ids }, status: 'active', isBlocked: false })
      .sort({ ratingAvg: -1, ratingCount: -1, basePrice: 1, updatedAt: -1 })
      .exec();
  }

  async getPublicById(id: string): Promise<ProviderProfileDocument> {
    const value = String(id ?? '').trim();
    if (!value) throw new NotFoundException('Provider profile not found');

    const byObjectId = Types.ObjectId.isValid(value) ? { _id: value } : null;
    const byUserId = { userId: value };
    const or = byObjectId ? [byObjectId, byUserId] : [byUserId];

    const item = await this.model
      .findOne({
        status: 'active',
        isBlocked: false,
        $or: or,
      })
      .exec();

    if (!item) throw new NotFoundException('Provider profile not found');
    return item;
  }

  // Exposed to keep one domain rule for profile readiness checks in controllers/BFF mappings.
  isProfileComplete(profile: ProviderProfile | null | undefined): boolean {
    return isProviderProfileComplete(profile);
  }
}
