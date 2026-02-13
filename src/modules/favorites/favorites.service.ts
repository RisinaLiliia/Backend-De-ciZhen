// src/modules/favorites/favorites.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import { Favorite, FavoriteDocument, FavoriteType } from './schemas/favorite.schema';
import { RequestsService } from '../requests/requests.service';
import { ProvidersService } from '../providers/providers.service';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    private readonly requests: RequestsService,
    private readonly providers: ProvidersService,
  ) {}

  private ensureObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${field} must be a valid ObjectId`);
    }
  }

  async add(userId: string, type: FavoriteType, targetId: string): Promise<void> {
    const uid = String(userId ?? '').trim();
    const tid = String(targetId ?? '').trim();
    if (!uid) throw new BadRequestException('userId is required');
    if (!tid) throw new BadRequestException('targetId is required');
    this.ensureObjectId(tid, 'targetId');

    try {
      await this.favoriteModel.create({ userId: uid, type, targetId: tid });
    } catch (e: any) {
      if (e?.code === 11000) return;
      throw e;
    }
  }

  async remove(userId: string, type: FavoriteType, targetId: string): Promise<void> {
    const uid = String(userId ?? '').trim();
    const tid = String(targetId ?? '').trim();
    if (!uid) throw new BadRequestException('userId is required');
    if (!tid) throw new BadRequestException('targetId is required');
    this.ensureObjectId(tid, 'targetId');

    await this.favoriteModel.deleteOne({ userId: uid, type, targetId: tid }).exec();
  }

  async listIds(userId: string, type: FavoriteType): Promise<string[]> {
    const uid = String(userId ?? '').trim();
    if (!uid) throw new BadRequestException('userId is required');

    const items = await this.favoriteModel
      .find({ userId: uid, type })
      .sort({ createdAt: -1 })
      .exec();
    return items.map((x) => x.targetId);
  }

  async listByType(userId: string, type: FavoriteType): Promise<any[]> {
    const ids = await this.listIds(userId, type);
    if (type === 'request') {
      return this.requests.listPublicByIds(ids);
    }
    return this.providers.listPublicByIds(ids);
  }
}
