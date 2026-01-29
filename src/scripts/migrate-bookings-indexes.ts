// src/scripts/migrate-bookings-indexes.ts
import 'dotenv/config';
import mongoose from 'mongoose';

type IndexSpec = {
  name: string;
  key: Record<string, 1 | -1>;
  options?: Record<string, any>;
};

function stableKeyString(key: Record<string, any>): string {
  return Object.entries(key)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

function keysEqual(a: any, b: any): boolean {
  return stableKeyString(a) === stableKeyString(b);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Missing MONGO_URI / database.uri');
  }

  const dropUnused = process.env.DROP_UNUSED_INDEXES === '1';
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const isProd = nodeEnv === 'production';

  if (dropUnused && isProd && process.env.ALLOW_DROP_PROD !== '1') {
    throw new Error(
      'Refusing to DROP indexes in production. Set ALLOW_DROP_PROD=1 if you are 100% sure.',
    );
  }

  await mongoose.connect(uri);
  console.log(`Connected: ${uri.replace(/\/\/.*@/, '//***:***@')}`);

  const db = mongoose.connection.db;
  if (!db) throw new Error('No mongoose.connection.db');
  const col = db.collection('bookings');

  const desired: IndexSpec[] = [
    {
      name: 'uniq_active_booking_per_request',
      key: { requestId: 1 },
      options: {
        unique: true,
        background: true,
        partialFilterExpression: { status: { $in: ['confirmed', 'completed'] } },
      },
    },
    {
      name: 'uniq_active_booking_same_slot',
      key: { requestId: 1, responseId: 1, startAt: 1 },
      options: {
        unique: true,
        background: true,
        partialFilterExpression: { status: { $in: ['confirmed', 'completed'] } },
      },
    },

    { name: 'idx_client_my', key: { clientId: 1, status: 1, startAt: -1 }, options: { background: true } },
    { name: 'idx_provider_my', key: { providerUserId: 1, status: 1, startAt: -1 }, options: { background: true } },

    { name: 'idx_provider_overlap', key: { providerUserId: 1, status: 1, startAt: 1, endAt: 1 }, options: { background: true } },

    { name: 'idx_booking_chain', key: { requestId: 1, responseId: 1, providerUserId: 1, clientId: 1 }, options: { background: true } },

    { name: 'uniq_rescheduled_from', key: { rescheduledFromId: 1 }, options: { unique: true, sparse: true, background: true } },
    { name: 'idx_rescheduled_to', key: { rescheduledToId: 1 }, options: { sparse: true, background: true } },

    { name: 'idx_status_endAt', key: { status: 1, endAt: 1 }, options: { background: true } },
  ];

  const desiredByName = new Map(desired.map((d) => [d.name, d]));
  const desiredByKey = new Map(desired.map((d) => [stableKeyString(d.key), d]));

  const existing = await col.indexes();
  const existingNames = existing.map((x: any) => x.name);
  console.log('Existing indexes:', existingNames);


  for (const idx of existing) {
    if (idx.name === '_id_') continue;

    const keyStr = stableKeyString(idx.key);
    const want = desiredByKey.get(keyStr);
    if (!want) continue;

    if (idx.name && idx.name !== want.name) {
      console.log(`- drop ${idx.name} (same key as ${want.name})`);
      await col.dropIndex(idx.name);
    }
  }

  const afterDrop = await col.indexes();
  const afterNames = new Set(afterDrop.map((x: any) => x.name));

  for (const spec of desired) {
    if (afterNames.has(spec.name)) {
      console.log(`= keep ${spec.name}`);
      continue;
    }
    console.log(`+ create ${spec.name} ${JSON.stringify(spec.key)} ${JSON.stringify(spec.options ?? {})}`);
    await col.createIndex(spec.key, { name: spec.name, ...(spec.options ?? {}) });
  }

  if (dropUnused) {
    const finalExisting = await col.indexes();
    for (const idx of finalExisting) {
      const idxName = idx.name;
      if (!idxName) continue;
      if (idxName === '_id_') continue;
      if (desiredByName.has(idxName)) continue;

      console.log(`- drop ${idxName}`);
      await col.dropIndex(idxName);
    }
  }

  const final = await col.indexes();
  console.log('Done. Final indexes:', final.map((x: any) => x.name));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
