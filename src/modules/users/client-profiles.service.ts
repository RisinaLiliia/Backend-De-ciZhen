// src/modules/users/client-profiles.service.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ClientProfile, ClientProfileDocument } from "./schemas/client-profile.schema";

@Injectable()
export class ClientProfilesService {
  constructor(
    @InjectModel(ClientProfile.name)
    private readonly model: Model<ClientProfileDocument>,
  ) {}

  async getOrCreateByUserId(userId: string): Promise<ClientProfileDocument> {
    const existing = await this.model.findOne({ userId }).exec();
    if (existing) return existing;
    return this.model.create({ userId });
  }

  async getByUserIds(userIds: string[]): Promise<ClientProfileDocument[]> {
    const ids = Array.isArray(userIds)
      ? Array.from(new Set(userIds.map((x) => String(x)).filter(Boolean)))
      : [];
    if (ids.length === 0) return [];
    return this.model.find({ userId: { $in: ids } }).exec();
  }

  async applyRating(userId: string, rating: number): Promise<ClientProfileDocument> {
    const profile = await this.getOrCreateByUserId(userId);
    const count = Number(profile.ratingCount ?? 0);
    const avg = Number(profile.ratingAvg ?? 0);
    const nextCount = count + 1;
    const nextAvg = Math.round(((avg * count + rating) / nextCount) * 100) / 100;
    profile.ratingCount = nextCount;
    profile.ratingAvg = nextAvg;
    return profile.save();
  }
}
