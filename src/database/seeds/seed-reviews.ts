import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import { hashPassword } from '../../utils/password';
import { User, UserDocument } from '../../modules/users/schemas/user.schema';
import {
  ProviderProfile,
  ProviderProfileDocument,
} from '../../modules/providers/schemas/provider-profile.schema';
import { Booking, BookingDocument } from '../../modules/bookings/schemas/booking.schema';
import { Review, ReviewDocument } from '../../modules/reviews/schemas/review.schema';
import {
  ClientProfile,
  ClientProfileDocument,
} from '../../modules/users/schemas/client-profile.schema';

const CLIENT_PASSWORD = 'Password1';
const DEFAULT_CLIENT_POOL = 24;
const DEFAULT_MAX_REVIEWS_PER_PROVIDER = 30;

const AUTHOR_NAMES = [
  'Leonie M.',
  'David K.',
  'Sofia B.',
  'Markus T.',
  'Anna R.',
  'Paul S.',
  'Mara W.',
  'Nina H.',
];

const REVIEW_TEXT_POOL = [
  'Puenktlich, freundlich und sauber gearbeitet. Kommunikation war schnell und klar.',
  'Sehr professionell und transparent. Termin wurde exakt eingehalten.',
  'Top Qualitaet, faire Preise und saubere Ausfuehrung. Gern wieder.',
  'Schnelle Rueckmeldung, gute Abstimmung und ordentliche Arbeit.',
  'Kompetent, zuverlaessig und freundlich. Ergebnis wie abgesprochen.',
  'Sehr gute Erreichbarkeit und verstaendliche Updates waehrend der Arbeit.',
  'Preis-Leistung passt, sauber hinterlassen und auf Details geachtet.',
  'Rueckfragen wurden schnell beantwortet, Umsetzung war effizient.',
];

const CLIENT_REVIEW_TEXT_POOL = [
  'Termin war klar abgestimmt, Kunde freundlich und gut vorbereitet.',
  'Kommunikation war direkt und professionell, Ablauf reibungslos.',
  'Alle Details waren vor Ort vorhanden, dadurch schnelle Umsetzung.',
  'Sehr angenehme Zusammenarbeit, klare Absprachen.',
  'Puenktliche Rueckmeldung und faire Erwartungen.',
];

function readPositiveInt(value: string | undefined, fallback: number) {
  const raw = Number(value ?? fallback);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.max(1, Math.floor(raw));
}

function makeProviderRating(avg: number, position: number) {
  if (avg >= 4.8) {
    const p = position % 10;
    if (p < 8) return 5;
    if (p < 9) return 4;
    return 3;
  }
  if (avg >= 4.5) {
    const p = position % 8;
    if (p < 5) return 5;
    if (p < 7) return 4;
    return 3;
  }
  const p = position % 7;
  if (p < 3) return 5;
  if (p < 5) return 4;
  if (p < 6) return 3;
  return 2;
}

function makeClientRating(position: number) {
  const p = position % 9;
  if (p < 6) return 5;
  if (p < 8) return 4;
  return 3;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function ensureBookingRescheduleIndexes(bookingModel: Model<BookingDocument>) {
  const col = bookingModel.collection;
  const indexes = await col.indexes();

  const byName = (name: string) => indexes.find((idx: any) => idx.name === name);

  const hasStringPartial = (idx: any, field: 'rescheduledFromId' | 'rescheduledToId') =>
    Boolean(
      idx?.partialFilterExpression
      && idx.partialFilterExpression[field]
      && idx.partialFilterExpression[field].$type === 'string',
    );

  const fromIdx = byName('uniq_rescheduled_from');
  if (!hasStringPartial(fromIdx, 'rescheduledFromId')) {
    if (fromIdx?.name) {
      await col.dropIndex(fromIdx.name).catch(() => undefined);
    }
    await col.createIndex(
      { rescheduledFromId: 1 },
      {
        name: 'uniq_rescheduled_from',
        unique: true,
        background: true,
        partialFilterExpression: { rescheduledFromId: { $type: 'string' } },
      },
    );
    console.log('↺ fixed index uniq_rescheduled_from (partial string)');
  }

  const toIdx = byName('idx_rescheduled_to');
  if (!hasStringPartial(toIdx, 'rescheduledToId')) {
    if (toIdx?.name) {
      await col.dropIndex(toIdx.name).catch(() => undefined);
    }
    await col.createIndex(
      { rescheduledToId: 1 },
      {
        name: 'idx_rescheduled_to',
        background: true,
        partialFilterExpression: { rescheduledToId: { $type: 'string' } },
      },
    );
    console.log('↺ fixed index idx_rescheduled_to (partial string)');
  }
}

async function bootstrap() {
  process.env.REDIS_DISABLED = process.env.REDIS_DISABLED ?? 'true';

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const providerModel = app.get<Model<ProviderProfileDocument>>(getModelToken(ProviderProfile.name));
  const bookingModel = app.get<Model<BookingDocument>>(getModelToken(Booking.name));
  const reviewModel = app.get<Model<ReviewDocument>>(getModelToken(Review.name));
  const clientProfileModel = app.get<Model<ClientProfileDocument>>(getModelToken(ClientProfile.name));

  await ensureBookingRescheduleIndexes(bookingModel);

  const clientPoolSize = readPositiveInt(process.env.SEED_REVIEW_CLIENT_POOL, DEFAULT_CLIENT_POOL);
  const maxReviewsPerProvider = readPositiveInt(
    process.env.SEED_REVIEWS_MAX_PER_PROVIDER,
    DEFAULT_MAX_REVIEWS_PER_PROVIDER,
  );
  const includeClientTargetReviews = process.env.SEED_REVIEWS_INCLUDE_CLIENT_TARGET !== 'false';

  console.log(
    `🌱 Seeding reviews (clients=${clientPoolSize}, maxPerProvider=${maxReviewsPerProvider}, includeClientTarget=${includeClientTargetReviews})...`,
  );

  const providers = await providerModel
    .find({ status: 'active', isBlocked: false })
    .sort({ ratingAvg: -1, ratingCount: -1, updatedAt: -1 })
    .exec();

  if (providers.length === 0) {
    throw new Error('No active providers found. Run `npm run seed:providers` first.');
  }

  const passwordHash = await hashPassword(CLIENT_PASSWORD);
  const clients: Array<{ userId: string; name: string; email: string }> = [];

  let clientsCreated = 0;
  let clientsUpdated = 0;

  for (let i = 0; i < clientPoolSize; i += 1) {
    const seq = i + 1;
    const name = AUTHOR_NAMES[i % AUTHOR_NAMES.length];
    const email = `seed-review-client-${seq}@test.com`;

    const existing = await userModel.findOne({ email }).exec();
    if (!existing) {
      const created = await userModel.create({
        email,
        name,
        role: 'client',
        passwordHash,
        isBlocked: false,
        blockedAt: null,
        acceptedPrivacyPolicy: true,
        acceptedPrivacyPolicyAt: new Date(),
      } as any);

      const userId = String((created as any)._id ?? (created as any).id);
      clients.push({ userId, name, email });
      clientsCreated += 1;
    } else {
      const userId = String((existing as any)._id ?? (existing as any).id);
      const update: Record<string, unknown> = {};
      if (existing.role !== 'client') update.role = 'client';
      if (existing.isBlocked) {
        update.isBlocked = false;
        update.blockedAt = null;
      }
      if (!existing.acceptedPrivacyPolicy) {
        update.acceptedPrivacyPolicy = true;
        update.acceptedPrivacyPolicyAt = new Date();
      }
      if (Object.keys(update).length > 0) {
        await userModel.updateOne({ _id: userId }, { $set: update }).exec();
        clientsUpdated += 1;
      }
      clients.push({ userId, name: existing.name ?? name, email });
    }

    await clientProfileModel
      .updateOne(
        { userId: clients[clients.length - 1].userId },
        {
          $setOnInsert: {
            userId: clients[clients.length - 1].userId,
            ratingAvg: 0,
            ratingCount: 0,
            stats: {},
            isBlocked: false,
            blockedAt: null,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  let bookingsCreated = 0;
  let bookingsUpdated = 0;
  let providerReviewsCreated = 0;
  let providerReviewsUpdated = 0;
  let clientReviewsCreated = 0;
  let clientReviewsUpdated = 0;

  for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
    const provider = providers[providerIndex];
    const providerUserId = String((provider as any).userId ?? '').trim();
    if (!providerUserId) continue;

    const baseCount = Number((provider as any).ratingCount ?? 0);
    const totalForProvider = Math.min(maxReviewsPerProvider, Math.max(12, baseCount || 12));
    const avg = Number((provider as any).ratingAvg ?? 4.5);

    for (let i = 0; i < totalForProvider; i += 1) {
      const client = clients[(providerIndex + i) % clients.length];
      const requestId = `seed-review-request-${providerUserId}-${i + 1}`;
      const offerId = `seed-review-offer-${providerUserId}-${i + 1}`;

      let booking = await bookingModel.findOne({ requestId }).exec();
      if (!booking) {
        const dayOffset = providerIndex * 3 + i + 1;
        const endAt = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
        const startAt = new Date(endAt.getTime() - 2 * 60 * 60 * 1000);

        booking = await bookingModel.create({
          requestId,
          offerId,
          contractId: null,
          providerUserId,
          clientId: client.userId,
          startAt,
          endAt,
          durationMin: 120,
          status: 'completed',
          metadata: {
            seededBy: 'seed:reviews',
            providerIndex,
            reviewIndex: i,
          },
        } as any);
        bookingsCreated += 1;
      } else {
        const nextUpdate: Record<string, unknown> = {};
        if (String((booking as any).providerUserId ?? '') !== providerUserId) {
          nextUpdate.providerUserId = providerUserId;
        }
        if (String((booking as any).clientId ?? '') !== client.userId) {
          nextUpdate.clientId = client.userId;
        }
        if (String((booking as any).status ?? '') !== 'completed') {
          nextUpdate.status = 'completed';
        }
        if (Object.keys(nextUpdate).length > 0) {
          await bookingModel.updateOne({ _id: (booking as any)._id }, { $set: nextUpdate }).exec();
          bookingsUpdated += 1;
        }
      }

      const bookingId = String((booking as any)._id ?? (booking as any).id);

      const providerRating = makeProviderRating(avg, i + providerIndex + 1);
      const providerText = REVIEW_TEXT_POOL[(providerIndex + i) % REVIEW_TEXT_POOL.length];

      const existingProviderReview = await reviewModel
        .findOne({ bookingId, targetRole: 'provider' })
        .exec();

      if (!existingProviderReview) {
        await reviewModel.create({
          authorUserId: client.userId,
          targetUserId: providerUserId,
          targetRole: 'provider',
          bookingId,
          requestId,
          rating: providerRating,
          text: providerText,
        } as any);
        providerReviewsCreated += 1;
      } else {
        await reviewModel
          .updateOne(
            { _id: (existingProviderReview as any)._id },
            {
              $set: {
                authorUserId: client.userId,
                targetUserId: providerUserId,
                requestId,
                rating: providerRating,
                text: providerText,
              },
            },
          )
          .exec();
        providerReviewsUpdated += 1;
      }

      if (!includeClientTargetReviews || (providerIndex + i) % 3 !== 0) {
        continue;
      }

      const clientRating = makeClientRating(i + providerIndex + 1);
      const clientText = CLIENT_REVIEW_TEXT_POOL[(providerIndex + i) % CLIENT_REVIEW_TEXT_POOL.length];

      const existingClientReview = await reviewModel
        .findOne({ bookingId, targetRole: 'client' })
        .exec();

      if (!existingClientReview) {
        await reviewModel.create({
          authorUserId: providerUserId,
          targetUserId: client.userId,
          targetRole: 'client',
          bookingId,
          requestId,
          rating: clientRating,
          text: clientText,
        } as any);
        clientReviewsCreated += 1;
      } else {
        await reviewModel
          .updateOne(
            { _id: (existingClientReview as any)._id },
            {
              $set: {
                authorUserId: providerUserId,
                targetUserId: client.userId,
                requestId,
                rating: clientRating,
                text: clientText,
              },
            },
          )
          .exec();
        clientReviewsUpdated += 1;
      }
    }
  }

  const providerRatings = await reviewModel
    .aggregate([
      { $match: { targetRole: 'provider' } },
      {
        $group: {
          _id: '$targetUserId',
          ratingCount: { $sum: 1 },
          ratingAvg: { $avg: '$rating' },
        },
      },
    ])
    .exec();

  for (const row of providerRatings as Array<{ _id: string; ratingCount: number; ratingAvg: number }>) {
    await providerModel
      .updateOne(
        { userId: String(row._id) },
        {
          $set: {
            ratingCount: Math.max(0, Math.floor(Number(row.ratingCount ?? 0))),
            ratingAvg: round2(Number(row.ratingAvg ?? 0)),
          },
        },
      )
      .exec();
  }

  const clientRatings = await reviewModel
    .aggregate([
      { $match: { targetRole: 'client' } },
      {
        $group: {
          _id: '$targetUserId',
          ratingCount: { $sum: 1 },
          ratingAvg: { $avg: '$rating' },
        },
      },
    ])
    .exec();

  for (const row of clientRatings as Array<{ _id: string; ratingCount: number; ratingAvg: number }>) {
    await clientProfileModel
      .updateOne(
        { userId: String(row._id) },
        {
          $set: {
            ratingCount: Math.max(0, Math.floor(Number(row.ratingCount ?? 0))),
            ratingAvg: round2(Number(row.ratingAvg ?? 0)),
            isBlocked: false,
            blockedAt: null,
          },
          $setOnInsert: {
            stats: {},
          },
        },
        { upsert: true },
      )
      .exec();
  }

  console.log(`✓ review clients created: ${clientsCreated}`);
  console.log(`↺ review clients updated: ${clientsUpdated}`);
  console.log(`✓ bookings created: ${bookingsCreated}`);
  console.log(`↺ bookings updated: ${bookingsUpdated}`);
  console.log(`✓ provider-target reviews created: ${providerReviewsCreated}`);
  console.log(`↺ provider-target reviews updated: ${providerReviewsUpdated}`);
  console.log(`✓ client-target reviews created: ${clientReviewsCreated}`);
  console.log(`↺ client-target reviews updated: ${clientReviewsUpdated}`);

  console.log(`🔑 Review client credentials pattern: seed-review-client-<n>@test.com / ${CLIENT_PASSWORD}`);

  await app.close();
  console.log('✅ Reviews seed completed');
}

bootstrap().catch((err) => {
  console.error('❌ Reviews seed failed', err);
  process.exit(1);
});
