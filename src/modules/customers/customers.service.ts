import { Injectable, NotFoundException } from '@nestjs/common';

import { CitiesService } from '../catalog/cities/cities.service';
import { PresenceService } from '../presence/presence.service';
import { ClientProfilesService } from '../users/client-profiles.service';
import { UsersService } from '../users/users.service';

export type CustomerPublicProfileView = {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  cityId: string | null;
  cityName: string | null;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  lastSeenAt: Date | null;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly users: UsersService,
    private readonly clientProfiles: ClientProfilesService,
    private readonly cities: CitiesService,
    private readonly presence: PresenceService,
  ) {}

  async getPublicById(id: string): Promise<CustomerPublicProfileView> {
    const customerId = String(id ?? '').trim();
    if (!customerId) {
      throw new NotFoundException('Customer profile not found');
    }

    const user = await this.users.findById(customerId);
    if (user.isBlocked) {
      throw new NotFoundException('Customer profile not found');
    }

    const [clientProfiles, city, onlineById] = await Promise.all([
      this.clientProfiles.getByUserIds([customerId]),
      this.cities.findActiveByLabel(user.city ?? '', 'DE'),
      this.presence.getOnlineMap([customerId]),
    ]);

    const profile = clientProfiles[0] ?? null;

    return {
      id: user._id.toString(),
      userId: user._id.toString(),
      displayName: user.name?.trim() || null,
      bio: user.bio?.trim() || null,
      avatarUrl: user.avatar?.url ?? null,
      cityId: city?._id?.toString() ?? null,
      cityName: user.city?.trim() || null,
      ratingAvg: Number(profile?.ratingAvg ?? 0),
      ratingCount: Number(profile?.ratingCount ?? 0),
      isOnline: onlineById.get(customerId) ?? false,
      lastSeenAt: user.lastSeenAt ?? null,
    };
  }
}
