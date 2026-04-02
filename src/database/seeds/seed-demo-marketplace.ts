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
import { Offer, OfferDocument } from '../../modules/offers/schemas/offer.schema';
import { City, CityDocument } from '../../modules/catalog/cities/schemas/city.schema';

import { User, UserDocument } from '../../modules/users/schemas/user.schema';
import { hashPassword } from '../../utils/password';

const DEMO_PASSWORD = 'Password1';

const DEMO = {
  clientEmail: 'demo-client@test.com',
  provider1Email: 'demo-provider-1@test.com',
  provider2Email: 'demo-provider-2@test.com',

  cityKey: 'berlin',
  serviceKey: 'home_cleaning',
};

function pickCityName(city: CityDocument): string {
  const i18n = (city as any).i18n as Record<string, string> | undefined;
  const byDe = i18n?.de?.trim();
  const byEn = i18n?.en?.trim();
  const byName = (city as any).name ? String((city as any).name).trim() : '';
  const byKey = (city as any).key ? String((city as any).key).trim() : '';
  return byDe || byEn || byName || byKey || 'Berlin';
}

async function bootstrap() {
  process.env.REDIS_DISABLED = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const providerModel = app.get<Model<ProviderProfileDocument>>(getModelToken(ProviderProfile.name));
  const requestModel = app.get<Model<RequestDocument>>(getModelToken(Request.name));
  const offerModel = app.get<Model<OfferDocument>>(getModelToken(Offer.name));
  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));

  console.log('🌱 Seeding demo marketplace...');

  const city = await cityModel
    .findOne({
      $or: [{ key: DEMO.cityKey }, { name: /^Berlin$/i }],
    })
    .exec();

  if (!city) {
    throw new Error('Demo city not found. Run `npm run seed:cities` first.');
  }

  const cityId = String((city as any)._id ?? (city as any).id);
  const cityName = pickCityName(city);

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

  const ensureProviderProfile = async (userId: string, displayName: string, basePrice: number, bio: string) => {
    const existing = await providerModel.findOne({ userId }).exec();
    if (existing) {
      await providerModel
        .updateOne(
          { _id: (existing as any)._id },
          {
            $set: {
              displayName: existing.displayName ?? displayName,
              bio: existing.bio ?? bio,
              status: 'active',
              isBlocked: false,
              blockedAt: null,
              cityId,
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
      bio,
      legalType: 'individual',
      cityId,
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

  await ensureProviderProfile(
    p1Id,
    'Anna Cleaner',
    35,
    'Gründliche Wohnungsreinigung mit klarer Kommunikation und flexiblen Zeitfenstern.',
  );
  await ensureProviderProfile(
    p2Id,
    'Mila Cleaning',
    32,
    'Zuverlässige Reinigung mit strukturiertem Ablauf, sauberem Finish und schnellen Rückmeldungen.',
  );

  console.log('✓ provider profiles ready');

  let req = await requestModel
    .findOne({ clientId, cityId, serviceKey: DEMO.serviceKey })
    .exec();

  if (req) {
    await requestModel
      .updateOne(
        { _id: (req as any)._id },
        {
          $set: {
            title: (req as any).title || 'Apartment cleaning in Berlin',
            cityName: (req as any).cityName || cityName,
          },
        },
      )
      .exec();

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
          },
        )
        .exec();

      req = await requestModel.findById(String((req as any)._id)).exec();
    }

    console.log(`↺ request exists: ${String((req as any)?._id)}`);
  } else {
    req = await requestModel.create({
      title: 'Apartment cleaning in Berlin',
      clientId,
      cityId,
      cityName,
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
    console.log(`⚠️ request is not published (${String((req as any).status)}), skip offers`);
  } else {
    const ensureOffer = async (providerUserId: string) => {
      const exists = await offerModel.findOne({ requestId, providerUserId }).exec();
      if (exists) return exists;

      return offerModel.create({
        requestId,
        providerUserId,
        clientUserId: clientId,
        status: 'sent',
        metadata: {},
      } as any);
    };

    await ensureOffer(p1Id);
    await ensureOffer(p2Id);

    console.log('✓ offers created');
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
