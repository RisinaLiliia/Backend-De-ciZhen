// src/scripts/migrate-availability-indexes.ts
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

async function ensureIndexes(
  col: mongoose.mongo.Collection,
  desired: IndexSpec[],
  dropUnused: boolean,
) {
  const desiredByName = new Map(desired.map((d) => [d.name, d]));
  const desiredByKey = new Map(desired.map((d) => [stableKeyString(d.key), d]));

  const existing = await col.indexes();
  console.log('Existing indexes:', existing.map((x: any) => x.name));

  for (const idx of existing) {
    if (idx.name === '_id_') continue;

    const want = desiredByKey.get(stableKeyString(idx.key));
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
    const now = await col.indexes();
    for (const idx of now) {
      const name = idx.name;
      if (!name || name === '_id_') continue;
      if (desiredByName.has(name)) continue;
      console.log(`- drop ${name}`);
      await col.dropIndex(name);
    }
  }

  const final = await col.indexes();
  console.log('Done. Final indexes:', final.map((x: any) => x.name));
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('Missing MONGO_URI');

  const dropUnused = process.env.DROP_UNUSED_INDEXES === '1';
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const isProd = nodeEnv === 'production';

  if (dropUnused && isProd && process.env.ALLOW_DROP_PROD !== '1') {
    throw new Error('Refusing to DROP indexes in production. Set ALLOW_DROP_PROD=1 if you are 100% sure.');
  }

  await mongoose.connect(uri);
  console.log(`Connected: ${uri.replace(/\/\/.*@/, '//***:***@')}`);

  const db = mongoose.connection.db;
  if (!db) throw new Error('No mongoose.connection.db');

  const blackouts = db.collection('provider_blackouts');
  console.log('\n== provider_blackouts ==');
  await ensureIndexes(
    blackouts,
    [
      { name: 'idx_blackouts_provider_start_end', key: { providerUserId: 1, startAt: 1, endAt: 1 }, options: { background: true } },
      { name: 'idx_blackouts_active_start', key: { providerUserId: 1, isActive: 1, startAt: 1 }, options: { background: true } },
      { name: 'idx_blackouts_active_overlap', key: { providerUserId: 1, isActive: 1, startAt: 1, endAt: 1 }, options: { background: true } },
    ],
    dropUnused,
  );

  const availability = db.collection('provider_availability');
  console.log('\n== provider_availability ==');
  await ensureIndexes(
    availability,
    [
      { name: 'uniq_provider_availability', key: { providerUserId: 1 }, options: { unique: true, background: true } },
      { name: 'idx_availability_active_updated', key: { isActive: 1, updatedAt: -1 }, options: { background: true } },
    ],
    dropUnused,
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
