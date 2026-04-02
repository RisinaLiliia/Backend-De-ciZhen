import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import { User, UserDocument } from '../../modules/users/schemas/user.schema';
import {
  ProviderProfile,
  ProviderProfileDocument,
} from '../../modules/providers/schemas/provider-profile.schema';
import { City, CityDocument } from '../../modules/catalog/cities/schemas/city.schema';
import { Service, ServiceDocument } from '../../modules/catalog/services/schemas/service.schema';
import { hashPassword } from '../../utils/password';

const DEFAULT_COUNT = 40;
const PROVIDER_PASSWORD = 'Password1';

const FIRST_NAMES = [
  'Anna',
  'Markus',
  'Sofia',
  'Lukas',
  'Nina',
  'Mila',
  'Jonas',
  'Laura',
  'David',
  'Elena',
  'Tobias',
  'Mara',
  'Felix',
  'Leonie',
  'Paul',
  'Amira',
];

const LAST_INITIALS = ['K.', 'S.', 'M.', 'B.', 'T.', 'R.', 'W.', 'L.', 'F.', 'H.'];
const PROVIDER_BIOS = [
  'Spezialisiert auf saubere Ausführung, klare Absprachen und verlässliche Termine.',
  'Mehrjährige Praxiserfahrung mit schnellen Rückmeldungen und transparentem Ablauf.',
  'Arbeitet strukturiert, zuverlässig und mit hohem Qualitätsanspruch im Detail.',
  'Unterstützt kurzfristig bei passenden Anfragen und kommuniziert proaktiv den Fortschritt.',
  'Fokussiert auf effiziente Lösungen mit sauberem Finish und fairer Preisstruktur.',
  'Setzt Anfragen pragmatisch um und hält Kunden mit klaren Updates auf dem Laufenden.',
];

function readSeedCount() {
  const raw = Number(process.env.SEED_PROVIDERS_COUNT ?? DEFAULT_COUNT);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_COUNT;
  return Math.max(1, Math.floor(raw));
}

function buildDisplayName(index: number) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_INITIALS[Math.floor(index / FIRST_NAMES.length) % LAST_INITIALS.length];
  return `${first} ${last}`;
}

function deriveRating(index: number) {
  const topTier = index < 8;
  const ratingAvg = topTier
    ? Number((4.9 - (index % 3) * 0.05).toFixed(1))
    : Number((4.2 + ((index * 7) % 9) * 0.08).toFixed(1));
  const ratingCount = topTier ? 110 + ((index * 17) % 90) : 18 + ((index * 13) % 190);
  const completedJobs = topTier ? 180 + ((index * 19) % 240) : 12 + ((index * 11) % 260);
  return { ratingAvg, ratingCount, completedJobs };
}

function buildProviderBio(index: number) {
  return PROVIDER_BIOS[index % PROVIDER_BIOS.length]!;
}

async function bootstrap() {
  process.env.REDIS_DISABLED = process.env.REDIS_DISABLED ?? 'true';

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const providerModel = app.get<Model<ProviderProfileDocument>>(getModelToken(ProviderProfile.name));
  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));
  const serviceModel = app.get<Model<ServiceDocument>>(getModelToken(Service.name));

  const count = readSeedCount();

  console.log(`🌱 Seeding providers (${count})...`);

  const [citiesRaw, servicesRaw] = await Promise.all([
    cityModel
      .find({ isActive: true }, { _id: 1, key: 1, sortOrder: 1 })
      .lean()
      .exec(),
    serviceModel
      .find({ isActive: true }, { _id: 1, key: 1, sortOrder: 1 })
      .lean()
      .exec(),
  ]);

  const cities = [...citiesRaw].sort((left: any, right: any) => {
    const leftSort = Number(left?.sortOrder ?? 0);
    const rightSort = Number(right?.sortOrder ?? 0);
    if (leftSort !== rightSort) return leftSort - rightSort;
    return String(left?.key ?? '').localeCompare(String(right?.key ?? ''));
  });

  const services = [...servicesRaw].sort((left: any, right: any) => {
    const leftSort = Number(left?.sortOrder ?? 0);
    const rightSort = Number(right?.sortOrder ?? 0);
    if (leftSort !== rightSort) return leftSort - rightSort;
    return String(left?.key ?? '').localeCompare(String(right?.key ?? ''));
  });

  if (cities.length === 0) {
    throw new Error('No active cities found. Run `npm run seed:cities` first.');
  }

  if (services.length === 0) {
    throw new Error('No active services found. Run `npm run seed:services` first.');
  }

  const passwordHash = await hashPassword(PROVIDER_PASSWORD);

  let usersCreated = 0;
  let usersUpdated = 0;
  let profilesCreated = 0;
  let profilesUpdated = 0;

  for (let index = 0; index < count; index += 1) {
    const seq = index + 1;
    const displayName = buildDisplayName(index);
    const email = `seed-provider-${seq}@test.com`;
    const city = cities[index % cities.length];
    const service = services[index % services.length];

    const { ratingAvg, ratingCount, completedJobs } = deriveRating(index);
    const basePrice = 35 + ((index * 9) % 120);
    const bio = buildProviderBio(index);

    const existingUser = await userModel.findOne({ email }).exec();

    let userId: string;
    if (!existingUser) {
      const created = await userModel.create({
        email,
        name: displayName,
        role: 'provider',
        passwordHash,
        isBlocked: false,
        blockedAt: null,
        acceptedPrivacyPolicy: true,
        acceptedPrivacyPolicyAt: new Date(),
      } as any);
      userId = String((created as any)._id ?? (created as any).id);
      usersCreated += 1;
    } else {
      userId = String((existingUser as any)._id ?? (existingUser as any).id);
      const update: Record<string, unknown> = {};
      if (existingUser.role !== 'provider') update.role = 'provider';
      if (existingUser.isBlocked) {
        update.isBlocked = false;
        update.blockedAt = null;
      }
      if (!existingUser.acceptedPrivacyPolicy) {
        update.acceptedPrivacyPolicy = true;
        update.acceptedPrivacyPolicyAt = new Date();
      }
      if (Object.keys(update).length > 0) {
        await userModel.updateOne({ _id: userId }, { $set: update }).exec();
        usersUpdated += 1;
      }
    }

    const upsertRes = await providerModel
      .updateOne(
        { userId },
        {
          $set: {
            displayName,
            bio,
            avatarUrl: null,
            cityId: String((city as any)._id ?? (city as any).id),
            serviceKeys: [String((service as any).key ?? '')],
            basePrice,
            status: 'active',
            isBlocked: false,
            blockedAt: null,
            ratingAvg,
            ratingCount,
            completedJobs,
            metadata: {
              seededBy: 'seed:providers',
              seedVersion: 1,
              seedIndex: seq,
            },
          },
          $setOnInsert: {
            userId,
            legalType: 'individual',
            companyName: null,
            vatId: null,
          },
        },
        { upsert: true },
      )
      .exec();

    if ((upsertRes as any).upsertedCount > 0) {
      profilesCreated += 1;
    } else {
      profilesUpdated += 1;
    }
  }

  console.log(`✓ users created: ${usersCreated}`);
  console.log(`↺ users updated: ${usersUpdated}`);
  console.log(`✓ provider profiles created: ${profilesCreated}`);
  console.log(`↺ provider profiles updated: ${profilesUpdated}`);
  console.log(`🔑 Provider credentials pattern: seed-provider-<n>@test.com / ${PROVIDER_PASSWORD}`);

  await app.close();
  console.log('✅ Providers seed completed');
}

bootstrap().catch((err) => {
  console.error('❌ Providers seed failed', err);
  process.exit(1);
});
