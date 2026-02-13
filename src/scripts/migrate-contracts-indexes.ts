// src/scripts/migrate-contracts-indexes.ts
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

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Missing MONGO_URI / database.uri');
  }

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
  const col = db.collection('contracts');

  const desired: IndexSpec[] = [
    { name: 'uniq_offer_contract', key: { offerId: 1 }, options: { unique: true, background: true } },
    { name: 'idx_request_contracts', key: { requestId: 1, createdAt: -1 }, options: { background: true } },
    { name: 'idx_client_contracts', key: { clientId: 1, createdAt: -1 }, options: { background: true } },
    { name: 'idx_provider_contracts', key: { providerUserId: 1, createdAt: -1 }, options: { background: true } },
    { name: 'idx_status_contracts', key: { status: 1, createdAt: -1 }, options: { background: true } },
  ];

  const desiredByName = new Map(desired.map((d) => [d.name, d]));
  const desiredByKey = new Map(desired.map((d) => [stableKeyString(d.key), d]));

  const existing = await col.indexes();
  console.log('Existing indexes:', existing.map((x: any) => x.name));

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
