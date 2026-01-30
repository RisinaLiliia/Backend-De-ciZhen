// test/app.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

import { AppModule } from '../src/app.module';

jest.setTimeout(30000);

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let replSet: MongoMemoryReplSet;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = uri;
    process.env.MONGODB_URI = uri;
    process.env.DATABASE_URI = uri;
    process.env.DATABASE_URL = uri;

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('/health (GET)', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ ok: true });
  });

  it('/ (GET)', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });
});
