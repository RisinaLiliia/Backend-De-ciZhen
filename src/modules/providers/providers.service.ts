// src/modules/providers/providers.service.ts
import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ProviderProfile, ProviderProfileDocument } from './schemas/provider-profile.schema';

type CreateProfileInput = {
  userId: string;
};

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

    Object.assign(profile, updates);
    return profile.save();
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

}
