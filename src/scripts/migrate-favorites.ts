// src/scripts/migrate-favorites.ts
import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('Missing MONGO_URI / database.uri');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No mongoose.connection.db');

  const favoritesCol = db.collection('favorites');
  const providersCol = db.collection('provider_profiles');
  const clientsCol = db.collection('client_profiles');

  const providerDocs = await providersCol
    .find({ favoriteRequestIds: { $exists: true, $ne: [] } }, { projection: { userId: 1, favoriteRequestIds: 1 } })
    .toArray();

  const clientDocs = await clientsCol
    .find({ favoritesProviderIds: { $exists: true, $ne: [] } }, { projection: { userId: 1, favoritesProviderIds: 1 } })
    .toArray();

  const ops: any[] = [];

  for (const p of providerDocs) {
    const userId = String(p.userId ?? '').trim();
    const ids = Array.isArray(p.favoriteRequestIds) ? p.favoriteRequestIds : [];
    for (const targetId of ids) {
      ops.push({
        updateOne: {
          filter: { userId, type: 'request', targetId: String(targetId) },
          update: { $setOnInsert: { userId, type: 'request', targetId: String(targetId), createdAt: new Date(), updatedAt: new Date() } },
          upsert: true,
        },
      });
    }
  }

  for (const c of clientDocs) {
    const userId = String(c.userId ?? '').trim();
    const ids = Array.isArray(c.favoritesProviderIds) ? c.favoritesProviderIds : [];
    for (const targetId of ids) {
      ops.push({
        updateOne: {
          filter: { userId, type: 'provider', targetId: String(targetId) },
          update: { $setOnInsert: { userId, type: 'provider', targetId: String(targetId), createdAt: new Date(), updatedAt: new Date() } },
          upsert: true,
        },
      });
    }
  }

  if (ops.length > 0) {
    const res = await favoritesCol.bulkWrite(ops, { ordered: false });
    console.log('Favorites migrated:', res.upsertedCount);
  } else {
    console.log('No favorites to migrate.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
