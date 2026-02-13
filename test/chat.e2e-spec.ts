// test/chat.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { Request as Req, RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { ChatThread, ChatThreadDocument } from '../src/modules/chats/schemas/chat-thread.schema';
import { ChatMessage, ChatMessageDocument } from '../src/modules/chats/schemas/chat-message.schema';

jest.setTimeout(30000);

describe('chat (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let requestModel: Model<RequestDocument>;
  let threadModel: Model<ChatThreadDocument>;
  let messageModel: Model<ChatMessageDocument>;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    requestModel = app.get(getModelToken(Req.name));
    threadModel = app.get(getModelToken(ChatThread.name));
    messageModel = app.get(getModelToken(ChatMessage.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([requestModel.deleteMany({}), threadModel.deleteMany({}), messageModel.deleteMany({})]);
  });

  it('can create thread, send message, list messages', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-chat@test.local', 'Client Chat');
    const provider = await registerAndGetToken(app, 'provider', 'prov-chat@test.local', 'Provider Chat');

    const req = await requestModel.create({
      title: 'Need cleaning',
      clientId: client.userId,
      serviceKey: 'home_cleaning',
      cityId: 'c1',
      cityName: 'Berlin',
      categoryKey: 'cleaning',
      categoryName: 'Cleaning',
      subcategoryName: 'Home cleaning',
      propertyType: 'apartment',
      area: 55,
      price: 120,
      preferredDate: new Date('2026-03-05T09:00:00.000Z'),
      isRecurring: false,
      status: 'published',
    });

    const threadRes = await request(app.getHttpServer())
      .post('/chat/threads')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ requestId: req._id.toString(), providerUserId: provider.userId })
      .expect(201);

    const threadId = threadRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ text: 'Hello!' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get(`/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toMatchObject({ threadId, text: 'Hello!' });
  });
});
