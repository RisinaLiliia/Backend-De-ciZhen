import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import cookieParser from 'cookie-parser';

import { AppModule } from '../../src/app.module';

export type E2EContext = {
  app: INestApplication;
  moduleRef: TestingModule;
  replSet: MongoMemoryReplSet;
};

export async function setupTestApp(opts?: {
  useValidationPipe?: boolean;
  overrides?: Array<{ token: any; useValue: any }>;
}): Promise<E2EContext> {
  process.env.MONGOMS_IP = '127.0.0.1';

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ ip: '127.0.0.1' }],
  });

  const uri = replSet.getUri();
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  process.env.DATABASE_URI = uri;
  process.env.DATABASE_URL = uri;

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  for (const o of opts?.overrides ?? []) {
    moduleBuilder.overrideProvider(o.token).useValue(o.useValue);
  }

  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();

  app.use(cookieParser());

  if (opts?.useValidationPipe) {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
  }

  await app.init();

  return { app, moduleRef, replSet };
}

export async function teardownTestApp(ctx: E2EContext | null | undefined, mongoose: any) {
  if (!ctx) return;
  if (ctx.app) await ctx.app.close();
  await mongoose.disconnect();
  if (ctx.replSet) await ctx.replSet.stop();
}

export async function registerAndGetToken(
  app: INestApplication,
  role: 'client' | 'provider',
  email: string,
  name?: string,
): Promise<{ accessToken: string; userId?: string }> {
  const password = 'Passw0rd!123';

  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .set('Content-Type', 'application/json')
    .send({
      name: name ?? `${role} Test`,
      email,
      password,
      role,
      acceptPrivacyPolicy: true,
    })
    .expect(201);

  expect(res.body?.accessToken).toBeTruthy();

  return {
    accessToken: res.body.accessToken as string,
    userId: res.body?.user?.id ?? res.body?.user?._id,
  };
}
