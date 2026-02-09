// test/geo-autocomplete.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { RedisService } from '../src/infra/redis.service';
import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';

jest.setTimeout(30000);

describe('Geo autocomplete (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;
  let redis: RedisService;

  beforeAll(async () => {
    process.env.GEOCODE_CACHE_TTL_SECONDS = '3600';
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /geo/autocomplete returns mapped items', async () => {
    const mockData = [
      {
        display_name: 'Hauptbahnhof, 60329 Frankfurt am Main, Germany',
        lat: '50.1109',
        lon: '8.6821',
        address: {
          city: 'Frankfurt am Main',
          postcode: '60329',
          country_code: 'de',
        },
      },
    ];

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const res = await request(app.getHttpServer())
      .get('/geo/autocomplete')
      .query({ query: '60329 Frankfurt', countryCode: 'DE', limit: 1 })
      .expect(200);

    expect(res.body.items).toEqual([
      {
        displayName: 'Hauptbahnhof, 60329 Frankfurt am Main, Germany',
        lat: 50.1109,
        lng: 8.6821,
        city: 'Frankfurt am Main',
        postalCode: '60329',
        countryCode: 'DE',
      },
    ]);
  });

  it('GET /geo/autocomplete uses cache on repeated requests', async () => {
    const mockData = [
      {
        display_name: 'Ulm, Baden-Württemberg, Germany',
        lat: '48.3984',
        lon: '9.9916',
        address: {
          city: 'Ulm',
          postcode: '89073',
          country_code: 'de',
        },
      },
    ];

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });
    (global as any).fetch = fetchMock;

    const cache = new Map<string, string>();
    jest.spyOn(redis, 'get').mockImplementation(async (key) => cache.get(key) ?? null);
    jest.spyOn(redis, 'set').mockImplementation(async (key, value) => {
      cache.set(key, value);
    });

    const query = { query: 'Ulm 89073', countryCode: 'DE', limit: 1 };

    await request(app.getHttpServer()).get('/geo/autocomplete').query(query).expect(200);
    await request(app.getHttpServer()).get('/geo/autocomplete').query(query).expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);
  });
});
