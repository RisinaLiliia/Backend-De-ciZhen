// src/database/seeds/seed-statistics-funnel.ts
import 'dotenv/config';

import dns from 'node:dns';
import mongoose from 'mongoose';

import { hashPassword } from '../../utils/password';

const SEED_PASSWORD = 'Password1';
const SEED_TAG = '[seed:stats-funnel]';
const SEED_CLIENT_EMAIL = 'seed-funnel-client@test.com';
const SEED_PROVIDER_EMAILS = [
  'seed-funnel-provider-1@test.com',
  'seed-funnel-provider-2@test.com',
  'seed-funnel-provider-3@test.com',
  'seed-funnel-provider-4@test.com',
  'seed-funnel-provider-5@test.com',
] as const;

const COUNTS = {
  // Live-market demo baseline:
  // 108 requests over 30 days, 82 provider responses, 64 positive responses, 50 contracts,
  // 58 open/in negotiation, 6 in progress, 38 completed, 6 cancelled.
  requests: 108,
  acceptedOffers: 64,
  closedContracts: 50,
  completedContracts: 38,
  cancelledContracts: 6,
} as const;

const OFFER_DISTRIBUTION = {
  noOfferRequests: 30,
  singleOfferRequests: 74,
  twoOfferRequests: 4,
  threeOfferRequests: 0,
  fourOfferRequests: 0,
} as const;

const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const PREFERRED_CITY_KEYS = ['berlin', 'hamburg', 'munich', 'karlsruhe', 'baden-baden'] as const;

const DEMAND_CATEGORY_TARGETS = [
  { categoryKey: 'cleaning_housekeeping', categoryName: 'Cleaning & Housekeeping', serviceKey: 'home_cleaning', weightPercent: 30 },
  { categoryKey: 'handyman_repairs', categoryName: 'Handyman & Repairs', serviceKey: 'handyman_help', weightPercent: 18 },
  { categoryKey: 'plumbing_heating', categoryName: 'Plumbing & Heating', serviceKey: 'plumbing_help', weightPercent: 12 },
  { categoryKey: 'gardening_outdoor', categoryName: 'Gardening & Outdoor', serviceKey: 'gardening_help', weightPercent: 7 },
  { categoryKey: 'electrical', categoryName: 'Electrical', serviceKey: 'electrical_help', weightPercent: 10 },
  { categoryKey: 'moving', categoryName: 'Moving', serviceKey: 'moving_help', weightPercent: 9 },
  { categoryKey: 'home_cleaning', categoryName: 'Home Cleaning', serviceKey: 'home_cleaning', weightPercent: 8 },
  { categoryKey: 'appliance_repair', categoryName: 'Appliance Repair', serviceKey: 'appliance_repair_service', weightPercent: 6 },
] as const;

type RequestImageRef = {
  imageUrl: string | null;
  photos: string[];
};

function requireMongoUri(): string {
  const value = String(process.env.MONGO_URI ?? '').trim();
  if (!value) throw new Error('MONGO_URI is required');
  return value;
}

function resolveDbName(): string {
  const value = String(process.env.MONGO_DB_NAME ?? '').trim();
  return value || 'decizhen';
}

function buildCategoryPlan(totalRequests: number) {
  const exactTargets = DEMAND_CATEGORY_TARGETS.map((item, index) => {
    const exact = (totalRequests * item.weightPercent) / 100;
    const floor = Math.floor(exact);
    return {
      index,
      floor,
      fraction: exact - floor,
    };
  });

  const assigned = exactTargets.reduce((sum, item) => sum + item.floor, 0);
  const remainder = Math.max(0, totalRequests - assigned);

  const rankedFractions = [...exactTargets]
    .sort((a, b) => (b.fraction - a.fraction) || (a.index - b.index));

  const counts = exactTargets.map((item) => item.floor);
  for (let cursor = 0; cursor < remainder; cursor += 1) {
    const target = rankedFractions[cursor % rankedFractions.length];
    counts[target.index] += 1;
  }

  const plan = counts.flatMap((count, index) => (
    Array.from({ length: count }).map(() => DEMAND_CATEGORY_TARGETS[index])
  ));

  if (plan.length < totalRequests) {
    const fallback = DEMAND_CATEGORY_TARGETS[0];
    return [
      ...plan,
      ...Array.from({ length: totalRequests - plan.length }).map(() => fallback),
    ];
  }

  return plan.slice(0, totalRequests);
}

async function ensureUser(users: any, email: string, role: 'client' | 'provider') {
  const existing = await users.findOne({ email });
  if (existing?._id) return existing;

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const now = new Date();

  const insertResult = await users.insertOne({
    name: email.split('@')[0],
    email,
    role,
    passwordHash,
    acceptedPrivacyPolicy: true,
    acceptedPrivacyPolicyAt: now,
    acceptedPrivacyPolicyVersion: String(process.env.PRIVACY_POLICY_VERSION ?? '2026-02-18'),
    avatar: { url: '/avatars/default.png', isDefault: true },
    isBlocked: false,
    blockedAt: null,
    lastSeenAt: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  return { _id: insertResult.insertedId, email, role };
}

type SeedCityRef = {
  cityId: string;
  cityName: string;
  location?: { type: 'Point'; coordinates: [number, number] };
};

function toSeedCityRef(city: any): SeedCityRef {
  const i18n = city.i18n as { de?: string; en?: string } | undefined;
  const cityName = String(i18n?.de ?? i18n?.en ?? city.name ?? city.key ?? 'Berlin').trim();
  const lng = typeof city.lng === 'number' ? city.lng : null;
  const lat = typeof city.lat === 'number' ? city.lat : null;

  return {
    cityId: String(city._id),
    cityName,
    ...(lng !== null && lat !== null
      ? { location: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] } }
      : {}),
  };
}

async function resolveCities(cities: any): Promise<SeedCityRef[]> {
  const preferredCities = await cities
    .find({ key: { $in: [...PREFERRED_CITY_KEYS] }, isActive: true })
    .sort({ sortOrder: 1, key: 1 })
    .toArray();

  const fallbackCities = preferredCities.length > 0
    ? []
    : await cities.find({ isActive: true }).sort({ sortOrder: 1, key: 1 }).limit(5).toArray();

  const resolved = (preferredCities.length > 0 ? preferredCities : fallbackCities).map(toSeedCityRef);
  if (resolved.length === 0) {
    throw new Error('No active city found. Run `npm run seed:cities` first.');
  }

  return resolved;
}

function seededUnit(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildWeightedDayIndexes(total: number) {
  const weights = Array.from({ length: PERIOD_DAYS }).map((_, dayIndex) => {
    const weekdayBoost = [1, 2, 3].includes(dayIndex % 7) ? 1.7 : 0.7;
    const spikeBoost = seededUnit(dayIndex, 37) > 0.84 ? 5.5 : 0;
    const quietPenalty = seededUnit(dayIndex, 41) < 0.14 ? 0.15 : 1;
    return (0.4 + seededUnit(dayIndex, 43) * 2.8 + weekdayBoost + spikeBoost) * quietPenalty;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const exactCounts = weights.map((weight, dayIndex) => {
    const exact = (weight / totalWeight) * total;
    const floor = Math.floor(exact);
    return {
      dayIndex,
      floor,
      fraction: exact - floor,
    };
  });
  const assigned = exactCounts.reduce((sum, item) => sum + item.floor, 0);
  const rankedFractions = [...exactCounts].sort((a, b) => b.fraction - a.fraction || a.dayIndex - b.dayIndex);
  const counts = exactCounts.map((item) => item.floor);

  for (let cursor = 0; cursor < total - assigned; cursor += 1) {
    const target = rankedFractions[cursor % rankedFractions.length];
    counts[target.dayIndex] += 1;
  }

  return counts.flatMap((count, dayIndex) => Array.from({ length: count }).map(() => dayIndex));
}

function buildDistributedCreatedAt(index: number, dayIndexes: number[], periodStartMs: number) {
  const dayIndex = dayIndexes[index] ?? Math.min(PERIOD_DAYS - 1, index % PERIOD_DAYS);
  const hour = 7 + Math.floor(seededUnit(index, 1) * 12);
  const minute = Math.floor(seededUnit(index, 2) * 60);
  return new Date(periodStartMs + dayIndex * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS);
}

function addOffset(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

function clampToPast(date: Date, nowMs: number) {
  return date.getTime() >= nowMs ? new Date(nowMs - 5 * MINUTE_MS) : date;
}

function buildEvenlySpacedIndexes(total: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const exact = ((index + 0.5) * total) / count;
    return Math.min(total - 1, Math.max(0, Math.floor(exact)));
  });
}

function buildDistributedSubset(indexes: number[], count: number, salt: number) {
  return [...indexes]
    .sort((a, b) => seededUnit(a, salt) - seededUnit(b, salt) || a - b)
    .slice(0, count);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1] ?? 0;
  const right = sorted[middle] ?? 0;
  return Math.round((left + right) / 2);
}

function buildOfferMultiplicityPlan(requestIndexesWithOffers: number[]) {
  const multiplicities = [
    ...Array.from({ length: OFFER_DISTRIBUTION.singleOfferRequests }).map(() => 1),
    ...Array.from({ length: OFFER_DISTRIBUTION.twoOfferRequests }).map(() => 2),
    ...Array.from({ length: OFFER_DISTRIBUTION.threeOfferRequests }).map(() => 3),
    ...Array.from({ length: OFFER_DISTRIBUTION.fourOfferRequests }).map(() => 4),
  ];

  return new Map(
    requestIndexesWithOffers.map((requestIndex, index) => [
      requestIndex,
      multiplicities[index] ?? 1,
    ]),
  );
}

function normalizeRequestImage(doc: any): RequestImageRef | null {
  const photos = Array.isArray(doc?.photos)
    ? doc.photos.map((value: unknown) => String(value).trim()).filter(Boolean)
    : [];
  const imageUrl = String(doc?.imageUrl ?? photos[0] ?? '').trim() || null;

  if (!imageUrl && photos.length === 0) return null;
  return {
    imageUrl,
    photos: photos.length > 0 ? photos : imageUrl ? [imageUrl] : [],
  };
}

async function loadReusableRequestImages(requests: any): Promise<RequestImageRef[]> {
  const docs = await requests
    .find({
      title: { $not: new RegExp(`^\\${SEED_TAG}`) },
      $or: [
        { imageUrl: { $type: 'string', $ne: '' } },
        { photos: { $exists: true, $ne: [] } },
      ],
    })
    .project({ imageUrl: 1, photos: 1 })
    .limit(32)
    .toArray();

  return docs
    .map(normalizeRequestImage)
    .filter((image: RequestImageRef | null): image is RequestImageRef => image !== null);
}

async function bootstrap() {
  // Atlas connectivity on some local networks is more stable with IPv4-first resolution.
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
  const offers = db.collection('offers');
  const contracts = db.collection('contracts');

  console.log('🌱 Seeding statistics funnel dataset...');

  const client = await ensureUser(users, SEED_CLIENT_EMAIL, 'client');
  const providers = await Promise.all(
    SEED_PROVIDER_EMAILS.map((email) => ensureUser(users, email, 'provider')),
  );

  const clientId = String(client._id);
  const providerIds = providers.map((provider) => String(provider._id));

  const seedCities = await resolveCities(cities);
  const nowMs = Date.now();
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const periodStartMs = today.getTime() - (PERIOD_DAYS - 1) * DAY_MS;
  const categoryPlan = buildCategoryPlan(COUNTS.requests);
  const requestDayIndexes = buildWeightedDayIndexes(COUNTS.requests);
  const reusableRequestImages = await loadReusableRequestImages(requests);
  const noOfferRequestIndexes = new Set(
    buildEvenlySpacedIndexes(COUNTS.requests, OFFER_DISTRIBUTION.noOfferRequests),
  );
  const requestIndexesWithOffers = Array.from({ length: COUNTS.requests }, (_, index) => index)
    .filter((index) => !noOfferRequestIndexes.has(index))
    .sort((a, b) => seededUnit(a, 11) - seededUnit(b, 11) || a - b);
  const offerMultiplicityByRequestIndex = buildOfferMultiplicityPlan(requestIndexesWithOffers);
  const offerPlan = requestIndexesWithOffers.flatMap((requestIndex) => {
    const offerCount = offerMultiplicityByRequestIndex.get(requestIndex) ?? 1;
    return Array.from({ length: offerCount }, (_, responseOrdinal) => ({
      requestIndex,
      responseOrdinal,
    }));
  });
  const contractRequestIndexes = buildDistributedSubset(
    requestIndexesWithOffers,
    COUNTS.closedContracts,
    17,
  );
  const contractRequestIndexLookup = new Set(contractRequestIndexes);
  const acceptedOnlyRequestIndexes = buildDistributedSubset(
    requestIndexesWithOffers.filter((requestIndex) => !contractRequestIndexLookup.has(requestIndex)),
    Math.max(0, COUNTS.acceptedOffers - COUNTS.closedContracts),
    23,
  );
  const acceptedOfferRequestIndexes = [
    ...contractRequestIndexes,
    ...acceptedOnlyRequestIndexes,
  ];
  const completedRequestIndexes = new Set(contractRequestIndexes.slice(0, COUNTS.completedContracts));
  const cancelledRequestIndexes = new Set(
    contractRequestIndexes.slice(
      COUNTS.completedContracts,
      COUNTS.completedContracts + COUNTS.cancelledContracts,
    ),
  );
  const contractRequestIndexSet = new Set(contractRequestIndexes);
  const acceptedOfferOrdinalByRequestIndex = new Map(
    acceptedOfferRequestIndexes.map((requestIndex) => {
      const offerCount = offerMultiplicityByRequestIndex.get(requestIndex) ?? 1;
      return [requestIndex, Math.floor(seededUnit(requestIndex, 19) * offerCount)];
    }),
  );
  const acceptedOfferIndexByRequestIndex = new Map<number, number>();

  const existingSeedRequests = await requests
    .find({
      clientId,
      title: { $regex: `^\\${SEED_TAG}` },
    })
    .project({ _id: 1 })
    .toArray();

  const existingRequestIds = existingSeedRequests.map((item) => String(item._id));
  if (existingRequestIds.length > 0) {
    await contracts.deleteMany({ requestId: { $in: existingRequestIds } });
    await offers.deleteMany({ requestId: { $in: existingRequestIds } });
    await requests.deleteMany({ _id: { $in: existingSeedRequests.map((item) => item._id) } });
  }

  const requestDocs = Array.from({ length: COUNTS.requests }).map((_, index) => {
    const category = categoryPlan[index] ?? DEMAND_CATEGORY_TARGETS[0];
    const city = seedCities[index % seedCities.length] ?? seedCities[0];
    const image = reusableRequestImages[index % reusableRequestImages.length] ?? null;
    const createdAt = buildDistributedCreatedAt(index, requestDayIndexes, periodStartMs);
    const preferredDate = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const status = completedRequestIndexes.has(index)
      ? 'closed'
      : contractRequestIndexSet.has(index)
        ? 'matched'
        : 'published';
    return {
      title: `${SEED_TAG} Request ${String(index + 1).padStart(2, '0')}`,
      clientId,
      serviceKey: category.serviceKey,
      cityId: city.cityId,
      cityName: city.cityName,
      location: city.location,
      propertyType: index % 2 === 0 ? 'apartment' : 'house',
      area: 40 + (index % 5) * 10,
      price: 90 + (index % 8) * 35,
      previousPrice: index % 3 === 0 ? 100 + (index % 8) * 30 : null,
      priceTrend: index % 3 === 0 ? 'up' : index % 5 === 0 ? 'down' : null,
      preferredDate,
      comment: 'Seed request for statistics funnel demo.',
      description: 'Distributed seed request for live-market statistics simulation.',
      photos: image?.photos ?? [],
      imageUrl: image?.imageUrl ?? null,
      categoryKey: category.categoryKey,
      categoryName: category.categoryName,
      subcategoryName: null,
      status,
      publishedAt: createdAt,
      matchedProviderUserId: null,
      matchedAt: null,
      assignedContractId: null,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const insertedRequests = await requests.insertMany(requestDocs, { ordered: true });
  const requestObjectIds = Object.values(insertedRequests.insertedIds);
  const requestIds = requestObjectIds.map((id: any) => String(id));

  const offerDocs = offerPlan.map(({ requestIndex, responseOrdinal }, offerIndex) => {
    const requestId = requestIds[requestIndex];
    const providerUserId = providerIds[(requestIndex + responseOrdinal) % providerIds.length];
    const requestCreatedAt = requestDocs[requestIndex]?.createdAt ?? new Date(nowMs - DAY_MS);
    const lateResponseDelayMinutes = seededUnit(offerIndex, 13) > 0.88
      ? 35 + Math.floor(seededUnit(offerIndex, 14) * 85)
      : 0;
    const responseDelayMinutes = 6
      + responseOrdinal * 9
      + Math.floor(seededUnit(offerIndex, 3) * 18)
      + lateResponseDelayMinutes;
    const createdAt = clampToPast(addOffset(requestCreatedAt, responseDelayMinutes), nowMs);
    const acceptedResponseOrdinal = acceptedOfferOrdinalByRequestIndex.get(requestIndex);
    const isAccepted = acceptedResponseOrdinal === responseOrdinal;
    if (isAccepted) {
      acceptedOfferIndexByRequestIndex.set(requestIndex, offerIndex);
    }

    return {
      requestId,
      providerUserId,
      clientUserId: clientId,
      status: isAccepted ? 'accepted' : 'sent',
      message: 'Seed provider response for live-market statistics simulation.',
      pricing: {
        amount: 110 + (offerIndex % 9) * 45,
        type: offerIndex % 4 === 0 ? 'estimate' : 'fixed',
        details: 'Seed pricing for statistics demo.',
      },
      availability: {
        date: addOffset(createdAt, 24 * 60).toISOString(),
        note: 'Seed availability window.',
      },
      metadata: { seedTag: 'stats-funnel', responseDelayMinutes, responseOrdinal },
      createdAt,
      updatedAt: createdAt,
    };
  });

  const insertedOffers = await offers.insertMany(offerDocs, { ordered: true });
  const offerIds = Object.values(insertedOffers.insertedIds).map((id: any) => String(id));
  const contractRequestIds = contractRequestIndexes
    .map((requestIndex) => requestIds[requestIndex])
    .filter((requestId): requestId is string => Boolean(requestId));

  const contractDocs = contractRequestIndexes.map((requestIndex, index) => {
    const offerIndex = acceptedOfferIndexByRequestIndex.get(requestIndex) ?? index;
    const requestId = requestIds[requestIndex];
    const offerId = offerIds[offerIndex];
    const providerUserId = providerIds[offerIndex % providerIds.length];
    const offerCreatedAt = offerDocs[offerIndex]?.createdAt ?? new Date(nowMs - DAY_MS);
    const createdAt = clampToPast(addOffset(offerCreatedAt, 45 + Math.floor(seededUnit(index, 4) * 720)), nowMs);
    const confirmedAt = clampToPast(addOffset(createdAt, 30 + Math.floor(seededUnit(index, 5) * 180)), nowMs);
    const isCompleted = index < COUNTS.completedContracts;
    const isCancelled = index >= COUNTS.completedContracts
      && index < COUNTS.completedContracts + COUNTS.cancelledContracts;
    const isInProgress = !isCompleted && !isCancelled && index % 2 === 0;
    const completedAt = isCompleted
      ? clampToPast(addOffset(confirmedAt, 720 + Math.floor(seededUnit(index, 6) * 20_160)), nowMs)
      : null;
    const cancelledAt = isCancelled
      ? clampToPast(addOffset(confirmedAt, 180 + Math.floor(seededUnit(index, 21) * 2_880)), nowMs)
      : null;
    const priceAmount = isCompleted ? 120 + index * 15 : null;

    return {
      requestId,
      offerId,
      clientId,
      providerUserId,
      status: isCompleted ? 'completed' : isCancelled ? 'cancelled' : isInProgress ? 'in_progress' : 'confirmed',
      priceAmount,
      priceType: priceAmount ? 'fixed' : null,
      priceDetails: priceAmount ? 'Seed fixed price' : null,
      confirmedAt,
      completedAt,
      cancelledAt,
      cancelReason: isCancelled ? 'Seed cancellation: client and provider did not agree on timing.' : null,
      createdAt,
      updatedAt: completedAt ?? cancelledAt ?? confirmedAt,
    };
  });

  await contracts.insertMany(contractDocs, { ordered: true });
  const insertedContractsByRequest = (await contracts
    .find({ requestId: { $in: contractRequestIds } })
    .project({ _id: 1, requestId: 1, providerUserId: 1, confirmedAt: 1, completedAt: 1, createdAt: 1 })
    .toArray()).reduce<Record<string, any>>((acc, item) => {
      acc[String(item.requestId)] = item;
      return acc;
    }, {});

  await Promise.all(
    contractRequestIndexes.map((requestIndex) => {
      const requestId = requestIds[requestIndex];
      const contract = insertedContractsByRequest[requestId];
      const requestObjectId = requestObjectIds[requestIndex];
      if (!contract?._id) return Promise.resolve();
      const requestIsCancelled = cancelledRequestIndexes.has(requestIndex);
      const requestUpdate = requestIsCancelled
        ? {
          matchedProviderUserId: null,
          matchedAt: null,
          assignedContractId: null,
          status: 'published',
          updatedAt: contract.cancelledAt ?? contract.confirmedAt ?? contract.createdAt ?? new Date(),
        }
        : {
          matchedProviderUserId: String(contract.providerUserId),
          matchedAt: contract.confirmedAt ?? contract.createdAt ?? new Date(),
          assignedContractId: String(contract._id),
          updatedAt: contract.completedAt ?? contract.confirmedAt ?? contract.createdAt ?? new Date(),
        };

      return requests.updateOne(
        { _id: requestObjectId },
        {
          $set: requestUpdate,
        },
      );
    }),
  );

  const completedProfit = contractDocs.reduce((sum, item) => (
    item.status === 'completed' && typeof item.priceAmount === 'number'
      ? sum + item.priceAmount
      : sum
  ), 0);
  const activeRequests = requestDocs.filter((item) => item.status !== 'closed').length;
  const acceptedOffers = offerDocs.filter((item) => item.status === 'accepted').length;
  const cancelledContracts = contractDocs.filter((item) => item.status === 'cancelled').length;
  const cancellationRatePercent = (
    cancelledContracts / Math.max(1, COUNTS.completedContracts + cancelledContracts)
  ) * 100;
  const medianResponseMinutes = median(
    offerDocs.map((item) => Number(item.metadata.responseDelayMinutes)).filter(Number.isFinite),
  );
  const requestsToCompletedConversion = COUNTS.requests > 0
    ? (COUNTS.completedContracts / COUNTS.requests) * 100
    : 0;

  console.log(`✓ Requests inserted: ${COUNTS.requests}`);
  console.log('📚 Category mix (requests):');
  for (const category of DEMAND_CATEGORY_TARGETS) {
    const count = categoryPlan.filter((item) => item.categoryKey === category.categoryKey).length;
    const share = COUNTS.requests > 0 ? (count / COUNTS.requests) * 100 : 0;
    console.log(`  - ${category.categoryName}: ${count} (${share.toFixed(1)}%)`);
  }
  console.log(`✓ Offers inserted: ${offerDocs.length} (accepted: ${acceptedOffers})`);
  console.log(`✓ Median response time: ${medianResponseMinutes ?? 0} minutes`);
  console.log(`✓ Requests without offers: ${OFFER_DISTRIBUTION.noOfferRequests}`);
  console.log(`✓ Active market requests: ${activeRequests}`);
  console.log(`✓ Reused request image pool: ${reusableRequestImages.length}`);
  console.log(
    `✓ Contracts inserted: ${COUNTS.closedContracts} (completed: ${COUNTS.completedContracts}, cancelled: ${cancelledContracts})`,
  );
  console.log(`✓ Cancellation rate: ${cancellationRatePercent.toFixed(1)}%`);
  console.log(`📈 Requests → Completed conversion: ${requestsToCompletedConversion.toFixed(2)}%`);
  console.log(`€ Profit from completed contracts: ${completedProfit.toFixed(2)}`);
  console.log('✅ Statistics funnel seed completed');
  console.log(`🔑 Client: ${SEED_CLIENT_EMAIL} / ${SEED_PASSWORD}`);
  console.log(`🔑 Providers: ${SEED_PROVIDER_EMAILS.join(', ')} / ${SEED_PASSWORD}`);

  await mongoose.disconnect();
}

bootstrap().catch(async (error) => {
  console.error('❌ Statistics funnel seed failed', error);
  await mongoose.disconnect();
  process.exit(1);
});
