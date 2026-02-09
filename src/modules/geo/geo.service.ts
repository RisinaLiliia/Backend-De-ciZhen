// src/modules/geo/geo.service.ts
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../infra/redis.service';

type NominatimItem = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    postcode?: string;
    country_code?: string;
  };
};

@Injectable()
export class GeoService {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private buildCacheKey(input: { query: string; countryCode?: string; limit?: number }) {
    const query = input.query.trim().toLowerCase();
    const country = (input.countryCode ?? '').trim().toLowerCase();
    const limit = input.limit ?? 5;
    return `geo:autocomplete:v1:q=${encodeURIComponent(query)}:cc=${country}:limit=${limit}`;
  }

  async autocomplete(input: { query: string; countryCode?: string; limit?: number }) {
    const query = (input.query ?? '').trim();
    if (!query) throw new BadRequestException('query is required');

    const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
    const countryCode = (input.countryCode ?? '').trim().toLowerCase();
    const cacheKey = this.buildCacheKey({ query, countryCode, limit });
    const cacheTtl = Number(this.config.get('app.geocodeCacheTtlSeconds') ?? 3600);

    if (cacheTtl > 0) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ReturnType<GeoService['autocomplete']>;
          return parsed;
        } catch {
          // ignore invalid cache
        }
      }
    }

    const baseUrl =
      this.config.get<string>('app.geocodeBaseUrl') ??
      'https://nominatim.openstreetmap.org/search';
    const userAgent =
      this.config.get<string>('app.geocodeUserAgent') ??
      'decizhen-backend/1.0 (contact: admin@example.com)';
    const acceptLanguage = this.config.get<string>('app.geocodeAcceptLanguage') ?? 'en';

    const url = new URL(baseUrl);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('q', query);
    if (countryCode) url.searchParams.set('countrycodes', countryCode);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          'User-Agent': userAgent,
          'Accept-Language': acceptLanguage,
        },
      });
    } catch (err) {
      throw new ServiceUnavailableException('geocode provider unreachable');
    }

    if (!res.ok) {
      throw new ServiceUnavailableException('geocode provider error');
    }

    let data: NominatimItem[];
    try {
      data = (await res.json()) as NominatimItem[];
    } catch {
      throw new ServiceUnavailableException('geocode provider response invalid');
    }

    const items = data.map((item) => {
      const address = item.address ?? {};
      const city =
        address.city ?? address.town ?? address.village ?? address.hamlet ?? null;
      const postalCode = address.postcode ?? null;
      const country = address.country_code ? address.country_code.toUpperCase() : null;
      const lat = Number(item.lat);
      const lng = Number(item.lon);

      return {
        displayName: item.display_name ?? '',
        lat,
        lng,
        city,
        postalCode,
        countryCode: country,
      };
    });

    if (cacheTtl > 0) {
      await this.redis.set(cacheKey, JSON.stringify(items), cacheTtl);
    }

    return items;
  }
}
