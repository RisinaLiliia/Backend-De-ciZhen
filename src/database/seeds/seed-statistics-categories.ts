// src/database/seeds/seed-statistics-categories.ts
import 'dotenv/config';

import dns from 'node:dns';
import mongoose from 'mongoose';

import { hashPassword } from '../../utils/password';

const SEED_PASSWORD = 'Password1';
const SEED_CLIENT_EMAIL = 'seed-stats-client@test.com';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const CATEGORY_FIXTURES = [
  { categoryKey: 'moving', categoryName: 'Moving', serviceKey: 'moving_help' },
  { categoryKey: 'deep_cleaning', categoryName: 'Deep Cleaning', serviceKey: 'deep_cleaning_service' },
  { categoryKey: 'plumbing', categoryName: 'Plumbing', serviceKey: 'plumbing_help' },
  { categoryKey: 'electrical', categoryName: 'Electrical', serviceKey: 'electrical_help' },
  { categoryKey: 'gardening', categoryName: 'Gardening', serviceKey: 'gardening_help' },
  { categoryKey: 'painting', categoryName: 'Painting', serviceKey: 'painting_help' },
  { categoryKey: 'assembly', categoryName: 'Furniture Assembly', serviceKey: 'furniture_assembly' },
  { categoryKey: 'window_cleaning', categoryName: 'Window Cleaning', serviceKey: 'window_cleaning_service' },
  { categoryKey: 'moving_long_distance', categoryName: 'Long Distance Moving', serviceKey: 'long_distance_moving' },
  { categoryKey: 'appliance_repair', categoryName: 'Appliance Repair', serviceKey: 'appliance_repair_service' },
  { categoryKey: 'tile_work', categoryName: 'Tile Work', serviceKey: 'tile_work_service' },
  { categoryKey: 'roof_maintenance', categoryName: 'Roof Maintenance', serviceKey: 'roof_maintenance_service' },
  { categoryKey: 'security_installation', categoryName: 'Security Installation', serviceKey: 'security_installation' },
  { categoryKey: 'floor_polishing', categoryName: 'Floor Polishing', serviceKey: 'floor_polishing_service' },
  { categoryKey: 'pool_cleaning', categoryName: 'Pool Cleaning', serviceKey: 'pool_cleaning_service' },
  { categoryKey: 'smart_home_setup', categoryName: 'Smart Home Setup', serviceKey: 'smart_home_setup' },
] as const;

function requireMongoUri(): string {
  const value = String(process.env.MONGO_URI ?? '').trim();
  if (!value) throw new Error('MONGO_URI is required');
  return value;
}

function resolveDbName(): string {
  const value = String(process.env.MONGO_DB_NAME ?? '').trim();
  return value || 'decizhen';
}

async function ensureSeedClient(users: any) {
  const existing = await users.findOne({ email: SEED_CLIENT_EMAIL });
  if (existing?._id) return existing._id;

  const insertResult = await users.insertOne({
    name: 'Seed Stats Client',
    email: SEED_CLIENT_EMAIL,
    role: 'client',
    passwordHash: await hashPassword(SEED_PASSWORD),
    acceptedPrivacyPolicy: true,
    acceptedPrivacyPolicyAt: new Date(),
    acceptedPrivacyPolicyVersion: String(process.env.PRIVACY_POLICY_VERSION ?? '2026-02-18'),
    avatar: { url: '/avatars/default.png', isDefault: true },
    isBlocked: false,
    blockedAt: null,
    lastSeenAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return insertResult.insertedId;
}

async function resolveCity(cities: any) {
  const city = await cities.findOne({
    $or: [{ key: 'berlin' }, { name: /^Berlin$/i }],
  }) ?? await cities.findOne({ isActive: true }, { sort: { sortOrder: 1, key: 1 } });

  if (!city?._id) {
    throw new Error('No active city found. Run `npm run seed:cities` first.');
  }

  const i18n = city.i18n as { de?: string; en?: string } | undefined;
  const cityName = String(i18n?.de ?? i18n?.en ?? city.name ?? city.key ?? 'Berlin').trim();

  return {
    cityId: String(city._id),
    cityName,
  };
}

async function bootstrap() {
  // Prefer IPv4 for better Atlas reachability on restrictive local networks.
  dns.setDefaultResultOrder('ipv4first');

  const mongoUri = requireMongoUri();
  const dbName = resolveDbName();

  await mongoose.connect(mongoUri, {
    dbName,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 15_000,
    socketTimeoutMS: 30_000,
    family: 4,
  });

  const db = mongoose.connection.db;
  if (!db) throw new Error('Mongo database handle is not available');

  const users = db.collection('users');
  const cities = db.collection('cities');
  const requests = db.collection('requests');

  console.log('🌱 Seeding statistics categories dataset...');

  const clientId = String(await ensureSeedClient(users));
  const city = await resolveCity(cities);

  let created = 0;
  let updated = 0;
  const now = Date.now();

  for (const [index, fixture] of CATEGORY_FIXTURES.entries()) {
    const title = `[seed:stats-categories] ${fixture.categoryName}`;
    const createdAt = new Date(now - index * 60 * 1000);
    const preferredDate = new Date(now + (index + 1) * 24 * 60 * 60 * 1000);

    const updateResult = await requests.updateOne(
      { title, clientId },
      {
        $set: {
          title,
          clientId,
          serviceKey: fixture.serviceKey,
          cityId: city.cityId,
          cityName: city.cityName,
          propertyType: index % 2 === 0 ? 'apartment' : 'house',
          area: 35 + index * 5,
          preferredDate,
          comment: 'Seed data for statistics pagination validation.',
          categoryKey: fixture.categoryKey,
          categoryName: fixture.categoryName,
          subcategoryName: null,
          status: 'published',
          matchedProviderUserId: null,
          matchedAt: null,
          assignedContractId: null,
          createdAt,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    if (updateResult.upsertedCount > 0) {
      created += 1;
    } else if (updateResult.modifiedCount > 0) {
      updated += 1;
    }
  }

  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);
  const categorySummary = await requests
    .aggregate<{ _id: string | null; count: number }>([
      {
        $match: {
          status: 'published',
          createdAt: { $gte: ninetyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$categoryName',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ])
    .toArray();

  console.log(`✓ Requests created: ${created}`);
  console.log(`↺ Requests updated: ${updated}`);
  console.log(`📊 Distinct categories (published, 90d): ${categorySummary.length}`);
  console.log(
    categorySummary
      .slice(0, 20)
      .map((item) => `${String(item._id ?? 'Other')}: ${item.count}`)
      .join('\n'),
  );
  console.log('✅ Statistics categories seed completed');
  console.log(`🔑 Seed client: ${SEED_CLIENT_EMAIL} / ${SEED_PASSWORD}`);

  await mongoose.disconnect();
}

bootstrap().catch(async (error) => {
  console.error('❌ Statistics categories seed failed', error);
  await mongoose.disconnect();
  process.exit(1);
});
