// test/users.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';

import { setupTestApp, teardownTestApp, registerAndGetToken, type E2EContext } from './helpers/e2e';
import { UploadsService } from '../src/modules/uploads/uploads.service';

jest.setTimeout(30000);

describe('users (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  const uploadsMock = {
    uploadImage: jest.fn().mockResolvedValue({
      url: 'https://cdn.example.com/u/1.png',
      publicId: 'avatar_1',
      width: 100,
      height: 100,
      format: 'png',
      bytes: 1234,
    }),
  };

  beforeAll(async () => {
    ctx = await setupTestApp({
      useValidationPipe: true,
      overrides: [{ token: UploadsService, useValue: uploadsMock }],
    });
    app = ctx.app;
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  it('GET /users/me returns current user profile', async () => {
    const client = await registerAndGetToken(app, 'client', 'user-me@test.local', 'User Me');

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: client.userId,
      email: 'user-me@test.local',
      role: 'client',
    });
  });

  it('PATCH /users/me updates profile', async () => {
    const client = await registerAndGetToken(app, 'client', 'user-update@test.local', 'User Update');

    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ name: 'New Name', city: 'Hamburg', language: 'de' })
      .expect(200);

    expect(res.body).toMatchObject({
      id: client.userId,
      name: 'New Name',
      city: 'Hamburg',
      language: 'de',
    });
  });

  it('POST /users/me/avatar uploads avatar', async () => {
    const client = await registerAndGetToken(app, 'client', 'user-avatar@test.local', 'User Avatar');

    const res = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .attach('avatar', Buffer.from('x'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(res.body?.avatar?.url).toBe('https://cdn.example.com/u/1.png');
    expect(uploadsMock.uploadImage).toHaveBeenCalled();
  });
});
