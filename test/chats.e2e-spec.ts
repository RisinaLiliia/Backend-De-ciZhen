// test/chats.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  setupTestApp,
  teardownTestApp,
  registerAndGetToken,
  type E2EContext,
} from './helpers/e2e';
import { Request as RequestEntity, type RequestDocument } from '../src/modules/requests/schemas/request.schema';
import { City, type CityDocument } from '../src/modules/catalog/cities/schemas/city.schema';
import { Service, type ServiceDocument } from '../src/modules/catalog/services/schemas/service.schema';
import {
  ServiceCategory,
  type ServiceCategoryDocument,
} from '../src/modules/catalog/services/schemas/service-category.schema';
import { ChatThread, type ChatThreadDocument } from '../src/modules/chats/schemas/chat-thread.schema';
import { ChatMessage, type ChatMessageDocument } from '../src/modules/chats/schemas/chat-message.schema';

jest.setTimeout(30000);

describe('chats (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  let requestModel: Model<RequestDocument>;
  let cityModel: Model<CityDocument>;
  let serviceModel: Model<ServiceDocument>;
  let categoryModel: Model<ServiceCategoryDocument>;
  let threadModel: Model<ChatThreadDocument>;
  let messageModel: Model<ChatMessageDocument>;

  const categoryKey = 'cleaning';
  const serviceKey = 'home_cleaning';
  let cityId: string;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;

    requestModel = app.get(getModelToken(RequestEntity.name));
    cityModel = app.get(getModelToken(City.name));
    serviceModel = app.get(getModelToken(Service.name));
    categoryModel = app.get(getModelToken(ServiceCategory.name));
    threadModel = app.get(getModelToken(ChatThread.name));
    messageModel = app.get(getModelToken(ChatMessage.name));
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  beforeEach(async () => {
    await Promise.all([
      requestModel.deleteMany({}),
      cityModel.deleteMany({}),
      serviceModel.deleteMany({}),
      categoryModel.deleteMany({}),
      threadModel.deleteMany({}),
      messageModel.deleteMany({}),
    ]);

    const city = await cityModel.create({
      key: 'frankfurt',
      name: 'Frankfurt am Main',
      isActive: true,
    });
    cityId = String(city._id);

    await categoryModel.create({ key: categoryKey, name: 'Cleaning', isActive: true });
    await serviceModel.create({
      key: serviceKey,
      categoryKey,
      name: 'Home cleaning',
      isActive: true,
    });
  });

  it('creates a conversation, sends messages, lists conversations, and marks read via new endpoints', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-chat-1@test.local', 'Client Chat');
    const provider = await registerAndGetToken(app, 'provider', 'provider-chat-1@test.local', 'Provider Chat');

    const createReq = await request(app.getHttpServer())
      .post('/requests/my')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        title: 'Window cleaning in Frankfurt',
        serviceKey,
        cityId,
        propertyType: 'apartment',
        area: 55,
        preferredDate: '2026-04-05T10:00:00.000Z',
        isRecurring: false,
        price: 180,
      })
      .expect(201);

    const requestId = createReq.body?.id;
    expect(requestId).toBeTruthy();

    const createConversationRes = await request(app.getHttpServer())
      .post('/chat/conversations')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        relatedEntity: {
          type: 'request',
          id: requestId,
        },
        requestId,
        participantUserId: provider.userId,
        participantRole: 'provider',
        providerUserId: provider.userId,
      })
      .expect(201);

    expect(createConversationRes.body).toMatchObject({
      relatedEntity: expect.objectContaining({
        type: 'request',
        requestId,
        title: 'Window cleaning in Frankfurt',
      }),
      participants: expect.arrayContaining([
        expect.objectContaining({ userId: client.userId, role: 'customer' }),
        expect.objectContaining({ userId: provider.userId, role: 'provider' }),
      ]),
      unreadCount: {
        [client.userId as string]: 0,
        [provider.userId as string]: 0,
      },
      state: 'active',
    });

    const conversationId = createConversationRes.body?.id as string;

    await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        text: 'Hello from provider',
      })
      .expect(201);

    const conversationInfoRes = await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(conversationInfoRes.body).toMatchObject({
      id: conversationId,
      counterpart: {
        userId: provider.userId,
        role: 'provider',
        displayName: 'Provider Chat',
      },
      unread: 1,
      lastMessagePreview: 'Hello from provider',
    });

    const conversationListRes = await request(app.getHttpServer())
      .get('/chat/conversations')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(conversationListRes.body.items).toHaveLength(1);
    expect(conversationListRes.body.items[0]).toMatchObject({
      id: conversationId,
      lastMessage: expect.objectContaining({ text: 'Hello from provider' }),
      counterpart: expect.objectContaining({
        userId: provider.userId,
        displayName: 'Provider Chat',
      }),
      unread: 1,
      lastMessagePreview: 'Hello from provider',
      unreadCount: {
        [client.userId as string]: 1,
        [provider.userId as string]: 0,
      },
    });

    const messagesRes = await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(messagesRes.body.items).toHaveLength(1);
    expect(messagesRes.body.items[0]).toMatchObject({
      conversationId,
      senderId: provider.userId,
      text: 'Hello from provider',
      deliveryStatus: 'delivered',
    });

    await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(201);

    const afterReadRes = await request(app.getHttpServer())
      .get('/chat/conversations')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(afterReadRes.body.items[0].unreadCount[client.userId as string]).toBe(0);

    const afterReadMessagesRes = await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(afterReadMessagesRes.body.items[0].deliveryStatus).toBe('read');
  });

  it('supports search and role filters on conversations', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-chat-2@test.local', 'Client Search');
    const provider = await registerAndGetToken(app, 'provider', 'provider-chat-2@test.local', 'Provider Search');

    const createReq = await request(app.getHttpServer())
      .post('/requests/my')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        title: 'Deep kitchen cleaning',
        serviceKey,
        cityId,
        propertyType: 'apartment',
        area: 60,
        preferredDate: '2026-04-10T09:00:00.000Z',
        isRecurring: false,
      })
      .expect(201);

    const requestId = createReq.body?.id as string;

    const conversationRes = await request(app.getHttpServer())
      .post('/chat/conversations')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        relatedEntity: { type: 'request', id: requestId },
        requestId,
        participantUserId: provider.userId,
        participantRole: 'provider',
        providerUserId: provider.userId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/chat/messages')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        conversationId: conversationRes.body.id,
        text: 'Kitchen scope confirmed',
      })
      .expect(201);

    const filteredRes = await request(app.getHttpServer())
      .get('/chat/conversations?role=customer&search=kitchen')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(filteredRes.body.items).toHaveLength(1);
    expect(filteredRes.body.items[0].relatedEntity.title).toBe('Deep kitchen cleaning');
  });

  it('keeps legacy thread endpoints compatible', async () => {
    const client = await registerAndGetToken(app, 'client', 'client-chat-3@test.local', 'Client Legacy');
    const provider = await registerAndGetToken(app, 'provider', 'provider-chat-3@test.local', 'Provider Legacy');

    const createReq = await request(app.getHttpServer())
      .post('/requests/my')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        title: 'Legacy chat request',
        serviceKey,
        cityId,
        propertyType: 'apartment',
        area: 40,
        preferredDate: '2026-04-12T09:00:00.000Z',
        isRecurring: false,
      })
      .expect(201);

    const requestId = createReq.body?.id as string;

    const legacyThreadRes = await request(app.getHttpServer())
      .post('/chat/threads')
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({
        requestId,
        providerUserId: provider.userId,
      })
      .expect(201);

    const threadId = legacyThreadRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${provider.accessToken}`)
      .send({ text: 'Legacy hello' })
      .expect(201);

    const legacyMessagesRes = await request(app.getHttpServer())
      .get(`/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(legacyMessagesRes.body[0]).toMatchObject({
      threadId,
      text: 'Legacy hello',
    });
  });
});
