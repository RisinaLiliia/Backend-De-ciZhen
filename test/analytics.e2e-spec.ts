import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';
import { Request, type RequestDocument } from '../src/modules/requests/schemas/request.schema';
import {
  SearchAnalyticsAggregate,
  type SearchAnalyticsAggregateDocument,
} from '../src/modules/analytics/schemas/search-analytics-aggregate.schema';

jest.setTimeout(120000);

describe('analytics search-event (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let requestModel: Model<RequestDocument>;
  let searchAggregateModel: Model<SearchAnalyticsAggregateDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    requestModel = app.get(getModelToken(Request.name));
    searchAggregateModel = app.get(getModelToken(SearchAnalyticsAggregate.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      requestModel.deleteMany({}),
      searchAggregateModel.deleteMany({}),
    ]);
  });

  it('POST /analytics/search-event dedupes duplicates and updates workspace statistics counters', async () => {
    await requestModel.create({
      title: 'Stats request Berlin',
      serviceKey: 'home_cleaning',
      cityId: 'berlin-city',
      cityName: 'Berlin',
      propertyType: 'apartment',
      area: 42,
      preferredDate: new Date('2026-03-06T10:00:00.000Z'),
      isRecurring: false,
      status: 'published',
      categoryKey: 'cleaning',
    });

    const payload = {
      target: 'request',
      source: 'workspace_filters',
      cityId: 'berlin-city',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      subcategoryKey: 'home_cleaning',
    };

    const first = await request(app.getHttpServer())
      .post('/analytics/search-event')
      .send(payload)
      .expect(202);

    const second = await request(app.getHttpServer())
      .post('/analytics/search-event')
      .send(payload)
      .expect(202);

    expect(first.body.accepted).toBe(true);
    expect(first.body.deduped).toBe(false);
    expect(second.body.accepted).toBe(true);
    expect(second.body.deduped).toBe(true);

    await request(app.getHttpServer())
      .post('/analytics/search-event')
      .send({
        target: 'provider',
        source: 'workspace_filters',
        cityId: 'berlin-city',
        cityName: 'Berlin',
        categoryKey: 'cleaning',
      })
      .expect(202);

    const stats = await request(app.getHttpServer())
      .get('/workspace/statistics')
      .query({ range: '30d' })
      .expect(200);

    const berlin = (stats.body?.demand?.cities ?? []).find((row: any) => row.cityId === 'berlin-city');
    expect(berlin).toBeDefined();
    expect(Number(berlin.auftragSuchenCount)).toBeGreaterThanOrEqual(1);
    expect(Number(berlin.anbieterSuchenCount)).toBeGreaterThanOrEqual(1);
  });
});
