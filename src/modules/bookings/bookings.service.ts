// src/modules/bookings/bookings.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef 
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import { Booking, BookingCancelledBy, BookingDocument, BookingStatus } from './schemas/booking.schema';
import {
  BOOKING_CANCEL_MIN_HOURS_BEFORE_START,
  BOOKING_RESCHEDULE_MIN_HOURS_BEFORE_START,
  hoursToMs,
} from './bookings.rules';
import { ProviderBlackout, ProviderBlackoutDocument } from '../availability/schemas/provider-blackout.schema';
import { AvailabilityService } from '../availability/availability.service';

type Actor =
  | { userId: string; role: 'client' }
  | { userId: string; role: 'provider' }
  | { userId: string; role: 'admin' };

type ListFilters = { status?: BookingStatus; from?: Date; to?: Date };
type ListPagination = { limit?: number; offset?: number };
type BookingOwnership = { clientId: string; providerUserId: string };
type BookingHistoryItem = {
  _id: unknown;
  requestId: string;
  responseId: string;
  providerUserId: string;
  clientId: string;
  rescheduledFromId?: unknown | null;
  rescheduledToId?: unknown | null;
};

@Injectable()
export class BookingsService {
    constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(ProviderBlackout.name) private readonly blackoutModel: Model<ProviderBlackoutDocument>,
    @Inject(forwardRef(() => AvailabilityService))
    private readonly availability: AvailabilityService,
  ) {}

    private isMongoDupKey(e: any): boolean {
    return !!e && (e.code === 11000 || e.name === 'MongoServerError' && /E11000/.test(String(e.message ?? '')));
  }


private async assertStartAtIsSlot(providerUserId: string, startAt: Date, durationMin: number) {
    
    const day = new Date(startAt).toISOString().slice(0, 10); 
    const slots = await this.availability.getSlots(providerUserId, day, day, 'UTC');

    const wantStartIso = startAt.toISOString();
    const wantEndIso = new Date(startAt.getTime() + durationMin * 60 * 1000).toISOString();

    const ok = slots.some((s) => s.startAt === wantStartIso && s.endAt === wantEndIso);
    if (!ok) throw new ConflictException('Slot is not available (not in provider availability)');
  }

async createByClient(
    clientId: string,
    input: {
      requestId: string;
      responseId: string;
      providerUserId: string;
      startAt: string;
      durationMin?: number;
      note?: string;
    },
  ): Promise<BookingDocument> {
    const requestId = this.normalizeId(input.requestId);
    const responseId = this.normalizeId(input.responseId);
    const providerUserId = this.normalizeId(input.providerUserId);

    if (!requestId) throw new BadRequestException('requestId is required');
    if (!responseId) throw new BadRequestException('responseId is required');
    if (!providerUserId) throw new BadRequestException('providerUserId is required');

    const startAt = this.parseDateOrThrow(input.startAt, 'startAt');
    if (startAt.getTime() <= Date.now()) throw new BadRequestException('startAt must be in the future');

    const durationMin = typeof input.durationMin === 'number' ? input.durationMin : 60;
    if (!Number.isFinite(durationMin) || durationMin < 15 || durationMin > 24 * 60) {
      throw new BadRequestException('durationMin is invalid');
    }

    const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);

    await this.assertStartAtIsSlot(providerUserId, startAt, durationMin);

    await this.assertSlotFree(providerUserId, startAt, endAt, null);

    try {
      const created = await this.bookingModel.create({
        requestId,
        responseId,
        providerUserId,
        clientId,
        startAt,
        durationMin,
        endAt,
        status: 'confirmed',
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        rescheduledFromId: null,
        rescheduledToId: null,
        rescheduledAt: null,
        rescheduleReason: null,
        metadata: input.note?.trim?.() ? { note: input.note.trim() } : {},
      });

      return created;
    } catch (e: any) {
      if (this.isMongoDupKey(e)) {
        throw new ConflictException('Booking already exists or slot already taken');
      }
      throw e;
    }
  }

  private ensureObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException(`${field} must be a valid ObjectId`);
  }

  private normalizeId(v?: string): string {
    return String(v ?? '').trim();
  }

  private parseDateOrThrow(value: string, field: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} must be a valid ISO date`);
    return d;
  }

  private actorToCancelledBy(actor: Actor): BookingCancelledBy {
    if (actor.role === 'admin') return 'admin';
    if (actor.role === 'client') return 'client';
    return 'provider';
  }

  normalizeFilters(input?: {
    status?: BookingStatus;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): (ListFilters & ListPagination) | undefined {
    if (!input) return undefined;

    const filters: ListFilters & ListPagination = {};
    if (input.status) filters.status = input.status;
    if (input.from) filters.from = this.parseDateOrThrow(input.from, 'from');
    if (input.to) filters.to = this.parseDateOrThrow(input.to, 'to');

    if (filters.from && filters.to && filters.to.getTime() < filters.from.getTime()) {
      throw new BadRequestException('to must be >= from');
    }

    if (typeof input.limit === 'number') filters.limit = input.limit;
    if (typeof input.offset === 'number') filters.offset = input.offset;

    return filters;
  }

  async getByRequestId(requestId: string): Promise<BookingDocument | null> {
    return this.bookingModel
      .findOne({ requestId, status: { $in: ['confirmed', 'completed'] } })
      .exec();
  }

  async listMyClient(clientId: string, filters?: ListFilters & ListPagination): Promise<BookingDocument[]> {
    const q: Record<string, any> = { clientId };
    if (filters?.status) q.status = filters.status;

    if (filters?.from || filters?.to) {
      q.startAt = {};
      if (filters.from) q.startAt.$gte = filters.from;
      if (filters.to) q.startAt.$lt = filters.to;
    }

    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);

    return this.bookingModel.find(q).sort({ startAt: -1 }).skip(offset).limit(limit).exec();
  }

  async listMyProvider(providerUserId: string, filters?: ListFilters & ListPagination): Promise<BookingDocument[]> {
    const q: Record<string, any> = { providerUserId };
    if (filters?.status) q.status = filters.status;

    if (filters?.from || filters?.to) {
      q.startAt = {};
      if (filters.from) q.startAt.$gte = filters.from;
      if (filters.to) q.startAt.$lt = filters.to;
    }

    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);

    return this.bookingModel.find(q).sort({ startAt: -1 }).skip(offset).limit(limit).exec();
  }

  private assertOwnership(actor: Actor, b: BookingOwnership) {
    if (actor.role === 'admin') return;
    if (actor.role === 'client' && b.clientId !== actor.userId) throw new ForbiddenException('Access denied');
    if (actor.role === 'provider' && b.providerUserId !== actor.userId) throw new ForbiddenException('Access denied');
  }

  private assertCancelRules(b: BookingDocument) {
    if (b.status === 'cancelled') return;
    if (b.status === 'completed') throw new BadRequestException('Cannot cancel completed booking');

    const msToStart = b.startAt.getTime() - Date.now();
    if (msToStart <= 0) throw new BadRequestException('Cannot cancel started booking');

    if (msToStart < hoursToMs(BOOKING_CANCEL_MIN_HOURS_BEFORE_START)) {
      throw new BadRequestException(
        `Cannot cancel less than ${BOOKING_CANCEL_MIN_HOURS_BEFORE_START}h before start`,
      );
    }
  }

  private async cancelAtomic(id: string, cancelledBy: BookingCancelledBy, cancelReason: string | null): Promise<void> {
    const res = await this.bookingModel
      .updateOne(
        { _id: id, status: { $in: ['confirmed'] } },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy,
            cancelReason,
          },
        },
      )
      .exec();

    if (res.modifiedCount === 0) {
      const now = await this.bookingModel.findById(id).select({ status: 1 }).exec();
      if (!now) throw new NotFoundException('Booking not found');
      if (now.status === 'cancelled') return;
      throw new ConflictException('Booking state changed; try again');
    }
  }

  private async cancelInternal(actor: Actor, bookingId: string, reason?: string, atomic = false): Promise<void> {
    const id = this.normalizeId(bookingId);
    if (!id) throw new BadRequestException('bookingId is required');
    this.ensureObjectId(id, 'bookingId');

    const b = await this.bookingModel.findById(id).exec();
    if (!b) throw new NotFoundException('Booking not found');

    this.assertOwnership(actor, b);

    if (b.status === 'cancelled') return;
    this.assertCancelRules(b);

    const trimmed = reason?.trim?.() ? reason.trim() : null;
    const cancelledBy = this.actorToCancelledBy(actor);

    if (atomic) {
      await this.cancelAtomic(id, cancelledBy, trimmed);
      return;
    }

    b.status = 'cancelled';
    b.cancelledAt = new Date();
    b.cancelledBy = cancelledBy;
    b.cancelReason = trimmed;
    await b.save();
  }

  async cancel(actor: Actor, bookingId: string, reason?: string) {
    return this.cancelInternal(actor, bookingId, reason, false);
  }
  async cancelByClient(clientId: string, bookingId: string, reason?: string) {
    return this.cancelInternal({ userId: clientId, role: 'client' }, bookingId, reason, false);
  }
  async cancelByProvider(providerUserId: string, bookingId: string, reason?: string) {
    return this.cancelInternal({ userId: providerUserId, role: 'provider' }, bookingId, reason, true);
  }
  async cancelByAdmin(adminUserId: string, bookingId: string, reason?: string) {
    return this.cancelInternal({ userId: adminUserId, role: 'admin' }, bookingId, reason, true);
  }

  private assertRescheduleRules(old: BookingDocument) {
    if (old.status === 'completed') throw new BadRequestException('Cannot reschedule completed booking');
    if (old.status === 'cancelled') throw new BadRequestException('Cannot reschedule cancelled booking');
    if (old.status !== 'confirmed') throw new BadRequestException('Only confirmed booking can be rescheduled');

    const msToStart = old.startAt.getTime() - Date.now();
    if (msToStart < hoursToMs(BOOKING_RESCHEDULE_MIN_HOURS_BEFORE_START)) {
      throw new BadRequestException(
        `Cannot reschedule less than ${BOOKING_RESCHEDULE_MIN_HOURS_BEFORE_START}h before start`,
      );
    }
  }

  private async assertSlotFree(providerUserId: string, newStartAt: Date, newEndAt: Date, excludeId: any) {
    const overlapCnt = await this.bookingModel.countDocuments({
      providerUserId,
      status: { $in: ['confirmed', 'completed'] },
      _id: { $ne: excludeId },
      startAt: { $lt: newEndAt },
      endAt: { $gt: newStartAt },
    });

    if (overlapCnt > 0) throw new ConflictException('Slot is not available (overlaps another booking)');

    const blackoutCnt = await this.blackoutModel.countDocuments({
      providerUserId,
      isActive: true,
      startAt: { $lt: newEndAt },
      endAt: { $gt: newStartAt },
    });

    if (blackoutCnt > 0) throw new ConflictException('Slot is not available (blackout)');
  }

  async reschedule(
    actor: Actor,
    bookingId: string,
    input: { startAt: string; durationMin?: number; reason?: string },
  ): Promise<BookingDocument> {
    const id = this.normalizeId(bookingId);
    if (!id) throw new BadRequestException('bookingId is required');
    this.ensureObjectId(id, 'bookingId');

    const newStartAt = this.parseDateOrThrow(input.startAt, 'startAt');
    if (newStartAt.getTime() <= Date.now()) throw new BadRequestException('startAt must be in the future');

    const old = await this.bookingModel.findById(id).exec();
    if (!old) throw new NotFoundException('Booking not found');

    if (actor.role !== 'admin') {
      if (actor.role === 'client' && old.clientId !== actor.userId) throw new ForbiddenException('Access denied');
      if (actor.role === 'provider' && old.providerUserId !== actor.userId) throw new ForbiddenException('Access denied');
    }

    this.assertRescheduleRules(old);

    const durationMin = typeof input.durationMin === 'number' ? input.durationMin : Number(old.durationMin ?? 60);
    if (!Number.isFinite(durationMin) || durationMin < 15 || durationMin > 24 * 60) {
      throw new BadRequestException('durationMin is invalid');
    }

    const newEndAt = new Date(newStartAt.getTime() + durationMin * 60 * 1000);

    await this.assertSlotFree(old.providerUserId, newStartAt, newEndAt, old._id);

    const session = await this.bookingModel.db.startSession();

    try {
      let created: BookingDocument | null = null;

      await session.withTransaction(async () => {
        const oldInTx = await this.bookingModel.findById(old._id).session(session).exec();
        if (!oldInTx) throw new NotFoundException('Booking not found');

        if (oldInTx.status !== 'confirmed') {
          if (oldInTx.rescheduledToId) {
            const existingNew = await this.bookingModel.findById(oldInTx.rescheduledToId).session(session).exec();
            if (existingNew) {
              created = existingNew;
              return;
            }
          }
          throw new ConflictException('Booking is no longer confirmed');
        }

        const overlapCnt = await this.bookingModel
          .countDocuments({
            providerUserId: oldInTx.providerUserId,
            status: { $in: ['confirmed', 'completed'] },
            _id: { $ne: oldInTx._id },
            startAt: { $lt: newEndAt },
            endAt: { $gt: newStartAt },
          })
          .session(session);

        if (overlapCnt > 0) throw new ConflictException('Slot is not available (overlaps another booking)');

        const blackoutCnt = await this.blackoutModel
          .countDocuments({
            providerUserId: oldInTx.providerUserId,
            isActive: true,
            startAt: { $lt: newEndAt },
            endAt: { $gt: newStartAt },
          })
          .session(session);

        if (blackoutCnt > 0) throw new ConflictException('Slot is not available (blackout)');

        const reason = input.reason?.trim?.() ? input.reason.trim() : null;

        oldInTx.status = 'cancelled';
        oldInTx.cancelledAt = new Date();
        oldInTx.cancelledBy = this.actorToCancelledBy(actor);
        oldInTx.cancelReason = reason;

        oldInTx.rescheduledAt = new Date();
        oldInTx.rescheduleReason = reason;

        await oldInTx.save({ session });

        try {
          created = await this.bookingModel
            .create(
              [
                {
                  requestId: oldInTx.requestId,
                  responseId: oldInTx.responseId,
                  providerUserId: oldInTx.providerUserId,
                  clientId: oldInTx.clientId,
                  startAt: newStartAt,
                  durationMin,
                  endAt: newEndAt,
                  status: 'confirmed',
                  cancelledAt: null,
                  cancelledBy: null,
                  cancelReason: null,
                  rescheduledFromId: String(oldInTx._id),
                  rescheduledToId: null,
                  rescheduledAt: null,
                  rescheduleReason: null,
                  metadata: {},
                },
              ],
              { session },
            )
            .then((arr: any) => arr[0]);
        } catch (e: any) {
          if (e?.code === 11000) {
            const existing = await this.bookingModel
              .findOne({
                $or: [
                  { rescheduledFromId: String(oldInTx._id), status: { $in: ['confirmed', 'completed'] } },
                  {
                    requestId: oldInTx.requestId,
                    responseId: oldInTx.responseId,
                    startAt: newStartAt,
                    status: { $in: ['confirmed', 'completed'] },
                  },
                ],
              })
              .session(session)
              .exec();

            if (existing) created = existing;
          } else {
            throw e;
          }
        }

        if (!created) throw new ConflictException('Failed to create new booking');

        oldInTx.rescheduledToId = String(created._id);
        await oldInTx.save({ session });
      });

      if (!created) throw new ConflictException('Failed to reschedule booking');
      return created;
    } finally {
      await session.endSession();
    }
  }

  async complete(actor: Actor, bookingId: string): Promise<void> {
    const id = this.normalizeId(bookingId);
    if (!id) throw new BadRequestException('bookingId is required');
    this.ensureObjectId(id, 'bookingId');

    const b = await this.bookingModel.findById(id).exec();
    if (!b) throw new NotFoundException('Booking not found');

    if (actor.role !== 'admin' && actor.role !== 'provider') throw new ForbiddenException('Access denied');
    if (actor.role === 'provider' && b.providerUserId !== actor.userId) throw new ForbiddenException('Access denied');

    if (b.status === 'cancelled') throw new BadRequestException('Cannot complete cancelled booking');
    if (b.status === 'completed') return;
    if (b.endAt.getTime() > Date.now()) throw new BadRequestException('Cannot complete before end time');

    const res = await this.bookingModel
      .updateOne({ _id: b._id, status: { $in: ['confirmed'] } }, { $set: { status: 'completed' } })
      .exec();

    if (res.modifiedCount === 0) {
      const now = await this.bookingModel.findById(b._id).select({ status: 1 }).exec();
      if (!now) throw new NotFoundException('Booking not found');
      if (now.status === 'completed') return;
      throw new ConflictException('Booking state changed; try again');
    }
  }

    async getHistory(
    actor: Actor,
    bookingId: string,
  ): Promise<{
    rootId: string;
    requestedId: string;
    latestId: string;
    currentIndex: number;
    items: BookingDocument[];
  }> {
    const id = this.normalizeId(bookingId);
    if (!id) throw new BadRequestException('bookingId is required');
    this.ensureObjectId(id, 'bookingId');

    const requested = await this.bookingModel
      .findById(id)
      .select({
        _id: 1,
        requestId: 1,
        responseId: 1,
        providerUserId: 1,
        clientId: 1,
      })
      .lean()
      .exec();

    if (!requested) throw new NotFoundException('Booking not found');
    this.assertOwnership(actor, requested);

    const all = await this.bookingModel
      .find({
        requestId: requested.requestId,
        responseId: requested.responseId,
        providerUserId: requested.providerUserId,
        clientId: requested.clientId,
      })
      .select({
        _id: 1,
        requestId: 1,
        responseId: 1,
        providerUserId: 1,
        clientId: 1,
        startAt: 1,
        durationMin: 1,
        endAt: 1,
        status: 1,
        cancelledAt: 1,
        cancelledBy: 1,
        cancelReason: 1,
        rescheduledFromId: 1,
        rescheduledToId: 1,
        rescheduledAt: 1,
        rescheduleReason: 1,
      })
      .lean()
      .exec();

    const byId = new Map<string, any>();
    for (const b of all) byId.set(String(b._id), b);

    const requestedId = String(requested._id);
    const startNode = byId.get(requestedId);
    if (!startNode) throw new ConflictException('Booking history is inconsistent');

    const MAX_HOPS = 200;

    let root: any = startNode;
    const visitedBack = new Set<string>([String(root._id)]);

    for (let i = 0; i < MAX_HOPS; i++) {
      const prevId = root.rescheduledFromId ? String(root.rescheduledFromId) : '';
      if (!prevId) break;

      const prev = byId.get(prevId);
      if (!prev) break;

      const pid = String(prev._id);
      if (visitedBack.has(pid)) throw new ConflictException('Booking history cycle detected');
      visitedBack.add(pid);

      root = prev;
    }

    const rootId = String(root._id);

    const items: any[] = [];
    let cur: any = root;
    const visitedForward = new Set<string>([rootId]);

    for (let i = 0; i < MAX_HOPS; i++) {
      items.push(cur);

      const nextId = cur.rescheduledToId ? String(cur.rescheduledToId) : '';
      if (!nextId) break;

      const next = byId.get(nextId);
      if (!next) break;

      const nid = String(next._id);
      if (visitedForward.has(nid)) throw new ConflictException('Booking history cycle detected');
      visitedForward.add(nid);

      cur = next;
    }

    const latestId = String(items[items.length - 1]._id);
    const currentIndex = items.findIndex((x) => String(x._id) === requestedId);

    return { rootId, requestedId, latestId, currentIndex, items: items as any };
  }

}
