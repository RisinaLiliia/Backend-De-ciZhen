import { BadRequestException, Injectable } from '@nestjs/common';
import type { Express } from 'express';

import { AuthService } from '../auth/auth.service';
import type { TokenResponse } from '../auth/auth.types';
import { CatalogServicesService } from '../catalog/services/services.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { isProviderProfileComplete } from '../providers/provider-profile-completeness';
import { ProvidersService } from '../providers/providers.service';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';
import {
  type RegisterWorkspaceProfileDto,
  type SaveWorkspaceProfileDto,
  type WorkspaceProfileResponseDto,
} from './dto/workspace-profile.dto';

@Injectable()
export class WorkspaceProfileService {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly providers: ProvidersService,
    private readonly uploads: UploadsService,
    private readonly cities: CitiesService,
    private readonly catalogServices: CatalogServicesService,
  ) {}

  private async uploadAvatar(userId: string, file?: Express.Multer.File): Promise<string | undefined> {
    if (!file) return undefined;
    const uploaded = await this.uploads.uploadImage(file, {
      folder: `avatars/${userId}`,
      publicIdPrefix: 'avatar',
      tags: ['avatar'],
    });
    return uploaded.url;
  }

  private parseOptionalBasePrice(raw: string | undefined): number | null | undefined {
    if (raw === undefined) return undefined;
    const normalized = String(raw).trim();
    if (!normalized) return null;
    const parsed = Number(normalized.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException('providerBasePrice must be a non-negative number');
    }
    return parsed;
  }

  private async resolveServiceKeys(categoryKey?: string, serviceKey?: string): Promise<string[] | undefined> {
    if (categoryKey === undefined && serviceKey === undefined) {
      return undefined;
    }

    const normalizedCategoryKey = String(categoryKey ?? '').trim().toLowerCase();
    const normalizedServiceKey = String(serviceKey ?? '').trim().toLowerCase();

    if (normalizedServiceKey) {
      const service = await this.catalogServices.getServiceByKey(normalizedServiceKey);
      if (!service) {
        throw new BadRequestException('providerServiceKey is invalid');
      }
      if (normalizedCategoryKey && service.categoryKey !== normalizedCategoryKey) {
        throw new BadRequestException('providerServiceKey does not belong to providerCategoryKey');
      }
      return [service.key];
    }

    if (!normalizedCategoryKey) {
      return [];
    }

    const category = await this.catalogServices.getCategoryByKey(normalizedCategoryKey);
    if (!category) {
      throw new BadRequestException('providerCategoryKey is invalid');
    }

    const services = await this.catalogServices.listServices(category.key);
    return services.map((service) => service.key);
  }

  private async resolveProviderSelection(serviceKeys: string[]): Promise<{
    selectedCategoryKey: string | null;
    selectedServiceKey: string | null;
  }> {
    const normalizedKeys = Array.from(
      new Set(
        (Array.isArray(serviceKeys) ? serviceKeys : [])
          .map((value) => String(value ?? '').trim().toLowerCase())
          .filter((value) => value.length > 0),
      ),
    );

    if (normalizedKeys.length === 0) {
      return { selectedCategoryKey: null, selectedServiceKey: null };
    }

    const services = await this.catalogServices.listServices();
    const byKey = new Map(services.map((service) => [service.key, service]));
    const matched = normalizedKeys
      .map((key) => byKey.get(key))
      .filter((service): service is NonNullable<typeof service> => Boolean(service));

    if (matched.length === 0) {
      return { selectedCategoryKey: null, selectedServiceKey: null };
    }

    const categoryKeys = Array.from(new Set(matched.map((service) => service.categoryKey)));
    return {
      selectedCategoryKey: categoryKeys.length === 1 ? categoryKeys[0] : null,
      selectedServiceKey: matched.length === 1 ? matched[0].key : null,
    };
  }

  private async resolveCityIdFromLabel(cityLabel: string | undefined): Promise<string | null | undefined> {
    if (cityLabel === undefined) return undefined;
    const normalized = String(cityLabel).trim();
    if (!normalized) return null;
    const city = await this.cities.findActiveByLabel(normalized, 'DE');
    return city?._id?.toString() ?? null;
  }

  private async buildResponse(userId: string): Promise<WorkspaceProfileResponseDto> {
    const [user, providerProfile] = await Promise.all([
      this.users.findById(userId),
      this.providers.getByUserId(userId),
    ]);

    const fallbackCity = providerProfile?.cityId
      ? providerProfile.cityId
      : await this.resolveCityIdFromLabel(user.city ?? undefined);
    const providerSelection = await this.resolveProviderSelection(providerProfile?.serviceKeys ?? []);

    return {
      common: {
        name: user.name,
        email: user.email,
        city: user.city ?? null,
        cityId: fallbackCity ?? null,
        phone: user.phone ?? null,
        avatarUrl: user.avatar?.url ?? null,
      },
      customer: {
        bio: user.bio ?? null,
      },
      provider: {
        displayName: providerProfile?.displayName ?? null,
        bio: providerProfile?.bio ?? null,
        cityId: providerProfile?.cityId ?? fallbackCity ?? null,
        selectedCategoryKey: providerSelection.selectedCategoryKey,
        selectedServiceKey: providerSelection.selectedServiceKey,
        serviceKeys: providerProfile?.serviceKeys ?? [],
        basePrice:
          typeof providerProfile?.basePrice === 'number' && Number.isFinite(providerProfile.basePrice)
            ? providerProfile.basePrice
            : null,
        status: providerProfile?.status ?? null,
        isBlocked: Boolean(providerProfile?.isBlocked ?? false),
        isProfileComplete: isProviderProfileComplete(providerProfile),
      },
    };
  }

  async getProfile(userId: string): Promise<WorkspaceProfileResponseDto> {
    return this.buildResponse(userId);
  }

  async saveProfile(
    userId: string,
    dto: SaveWorkspaceProfileDto,
    file?: Express.Multer.File,
  ): Promise<WorkspaceProfileResponseDto> {
    const avatarUrl = await this.uploadAvatar(userId, file);
    const userUpdates: Record<string, string | undefined> & { avatarUrl?: string } = {};

    if (dto.name !== undefined) userUpdates.name = dto.name.trim();
    if (dto.city !== undefined) userUpdates.city = String(dto.city).trim();
    if (dto.phone !== undefined) userUpdates.phone = String(dto.phone).trim();
    if (dto.customerBio !== undefined) userUpdates.bio = String(dto.customerBio).trim();
    if (avatarUrl !== undefined) userUpdates.avatarUrl = avatarUrl;

    if (Object.keys(userUpdates).length > 0) {
      await this.users.updateMe(userId, userUpdates);
    }

    const nextServiceKeys = await this.resolveServiceKeys(dto.providerCategoryKey, dto.providerServiceKey);
    const nextBasePrice = this.parseOptionalBasePrice(dto.providerBasePrice);
    const nextCityId = await this.resolveCityIdFromLabel(dto.city !== undefined ? dto.city : undefined);

    const shouldUpdateProvider =
      dto.providerDisplayName !== undefined
      || dto.providerBio !== undefined
      || nextServiceKeys !== undefined
      || nextBasePrice !== undefined
      || nextCityId !== undefined;

    if (shouldUpdateProvider) {
      await this.providers.getOrCreateMyProfile(userId);
      await this.providers.updateMyProfile(userId, {
        ...(dto.providerDisplayName !== undefined
          ? { displayName: String(dto.providerDisplayName).trim() || null }
          : {}),
        ...(dto.providerBio !== undefined ? { bio: String(dto.providerBio).trim() || null } : {}),
        ...(nextServiceKeys !== undefined ? { serviceKeys: nextServiceKeys } : {}),
        ...(nextBasePrice !== undefined ? { basePrice: nextBasePrice } : {}),
        ...(nextCityId !== undefined ? { cityId: nextCityId } : {}),
      });
    }

    return this.buildResponse(userId);
  }

  async registerProfile(
    dto: RegisterWorkspaceProfileDto,
    file?: Express.Multer.File,
  ): Promise<TokenResponse> {
    const city = await this.cities.getById(String(dto.cityId ?? '').trim());
    if (!city) {
      throw new BadRequestException('cityId is invalid');
    }

    const cityLabel = String(city.name ?? city.key ?? '').trim();
    if (!cityLabel) {
      throw new BadRequestException('cityId is invalid');
    }

    const tokens = await this.auth.register({
      name: dto.name.trim(),
      email: dto.email.trim(),
      password: dto.password,
      city: cityLabel,
      role: dto.viewerMode === 'provider' ? 'provider' : 'client',
      acceptPrivacyPolicy: dto.acceptPrivacyPolicy,
    });

    const userId = tokens.user.id;
    const avatarUrl = await this.uploadAvatar(userId, file);

    await this.users.updateMe(userId, {
      name: dto.name.trim(),
      city: cityLabel,
      ...(dto.phone !== undefined ? { phone: String(dto.phone).trim() } : {}),
      ...(dto.viewerMode === 'customer'
        ? { bio: String(dto.customerBio ?? '').trim() }
        : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    });

    if (dto.viewerMode === 'provider') {
      const serviceKeys = await this.resolveServiceKeys(dto.providerCategoryKey, dto.providerServiceKey);
      const basePrice = this.parseOptionalBasePrice(dto.providerBasePrice);
      await this.providers.getOrCreateMyProfile(userId);
      await this.providers.updateMyProfile(userId, {
        displayName: String(dto.providerDisplayName ?? dto.name).trim() || dto.name.trim(),
        bio: String(dto.providerBio ?? '').trim() || null,
        cityId: city._id.toString(),
        ...(serviceKeys !== undefined ? { serviceKeys } : {}),
        ...(basePrice !== undefined ? { basePrice } : {}),
      });
    }

    return tokens;
  }
}
