// src/database/seeds/seed-demo-marketplace.ts
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../../app.module';

import {
  ProviderProfile,
  ProviderProfileDocument,
} from '../../modules/providers/schemas/provider-profile.schema';
import { Request, RequestDocument } from '../../modules/requests/schemas/request.schema';
import { Response as Resp, ResponseDocument } from '../../modules/responses/schemas/response.schema';

import { User, UserDocument } from '../../modules/users/schemas/user.schema';
import { hashPassword } from '../../utils/password';

const DEMO_PASSWORD = 'Password1';

const DEMO = {
  clientEmail: 'demo-client@test.com',
  provider1Email: 'demo-provider-1@test.com',
  provider2Email: 'demo-provider-2@test.com',

  cityId: 'Berlin',
  serviceKey: 'home_cleaning',
};

async function bootstrap() {
  process.env.REDIS_DISABLED = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const providerModel = app.get<Model<ProviderProfileDocument>>(getModelToken(ProviderProfile.name));
  const requestModel = app.get<Model<RequestDocument>>(getModelToken(Request.name));
  const responseModel = app.get<Model<ResponseDocument>>(getModelToken(Resp.name));

  console.log('🌱 Seeding demo marketplace...');

  const ensureUser = async (email: string, role: 'client' | 'provider') => {
    const existing = await userModel.findOne({ email }).exec();
    if (existing) return existing;

    const passwordHash = await hashPassword(DEMO_PASSWORD);

    return userModel.create({
      email,
      name: email.split('@')[0],
      role,
      passwordHash,
      isBlocked: false,
      blockedAt: null,
      acceptedPrivacyPolicy: true,
      acceptedPrivacyPolicyAt: new Date(),
    } as any);
  };

  const client = await ensureUser(DEMO.clientEmail, 'client');
  const p1 = await ensureUser(DEMO.provider1Email, 'provider');
  const p2 = await ensureUser(DEMO.provider2Email, 'provider');

  const clientId = String((client as any)._id ?? (client as any).id);
  const p1Id = String((p1 as any)._id ?? (p1 as any).id);
  const p2Id = String((p2 as any)._id ?? (p2 as any).id);

  console.log('✓ demo users ready');

  const ensureProviderProfile = async (userId: string, displayName: string, basePrice: number) => {
    const existing = await providerModel.findOne({ userId }).exec();
    if (existing) {
      await providerModel
        .updateOne(
          { _id: (existing as any)._id },
          {
            $set: {
              displayName: existing.displayName ?? displayName,
              status: 'active',
              isBlocked: false,
              blockedAt: null,
              cityId: existing.cityId ?? DEMO.cityId,
            },
            $addToSet: { serviceKeys: DEMO.serviceKey },
            $setOnInsert: { metadata: {} },
          },
        )
        .exec();
      return existing;
    }

    return providerModel.create({
      userId,
      displayName,
      legalType: 'individual',
      cityId: DEMO.cityId,
      serviceKeys: [DEMO.serviceKey],
      basePrice,
      status: 'active',
      isBlocked: false,
      blockedAt: null,

      avatarUrl: null,
      ratingAvg: 4.8,
      ratingCount: 12,
      completedJobs: 40,

      metadata: {},
    } as any);
  };

  await ensureProviderProfile(p1Id, 'Anna Cleaner', 35);
  await ensureProviderProfile(p2Id, 'Mila Cleaning', 32);

  console.log('✓ provider profiles ready');

  let req = await requestModel
    .findOne({ clientId, cityId: DEMO.cityId, serviceKey: DEMO.serviceKey })
    .exec();

  if (req) {
    const status = String((req as any).status ?? '');
    if (status !== 'published') {
      await requestModel
        .updateOne(
          { _id: (req as any)._id },
          {
            $set: {
              status: 'published',
              matchedProviderUserId: null,
              matchedAt: null,
            },
            $setOnInsert: {},
          },
        )
        .exec();

      req = await requestModel.findById(String((req as any)._id)).exec();
    }

    console.log(`↺ request exists: ${String((req as any)?._id)}`);
  } else {
    req = await requestModel.create({
      clientId,
      cityId: DEMO.cityId,
      serviceKey: DEMO.serviceKey,

      propertyType: 'apartment',
      area: 45,
      preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000),

      comment: 'Demo request: please bring eco products if possible',

      status: 'published',
      matchedProviderUserId: null,
      matchedAt: null,
    } as any);

    console.log(`✓ request created: ${String((req as any)._id)}`);
  }

  const requestId = String((req as any)._id);

  if ((req as any).status !== 'published') {
    console.log(`⚠️ request is not published (${String((req as any).status)}), skip responses`);
  } else {
    const ensureResponse = async (providerUserId: string) => {
      const exists = await responseModel.findOne({ requestId, providerUserId }).exec();
      if (exists) return exists;

      return responseModel.create({
        requestId,
        providerUserId,
        clientUserId: clientId,
        status: 'pending',
        metadata: {},
      } as any);
    };

    await ensureResponse(p1Id);
    await ensureResponse(p2Id);

    console.log('✓ responses created');
  }

  console.log('✅ Demo seed completed');
  console.log('🔑 Demo credentials:');
  console.log(`Client: ${DEMO.clientEmail} / ${DEMO_PASSWORD}`);
  console.log(`Provider1: ${DEMO.provider1Email} / ${DEMO_PASSWORD}`);
  console.log(`Provider2: ${DEMO.provider2Email} / ${DEMO_PASSWORD}`);
  console.log(`RequestId: ${requestId}`);

  await app.close();
}

bootstrap().catch((e) => {
  console.error('❌ Demo seed failed', e);
  process.exit(1);
});
