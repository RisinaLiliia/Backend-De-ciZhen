// src/modules/availability/availability.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { DateTime, IANAZone } from 'luxon';

import {
  ProviderAvailability,
  ProviderAvailabilityDocument,
  WeeklyDaySchedule,
  TimeRange,
} from './schemas/provider-availability.schema';
import { ProviderProfile, ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import { ProviderBlackout, ProviderBlackoutDocument } from './schemas/provider-blackout.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';

type Slot = { startAt: string; endAt: string };

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(ProviderAvailability.name)
    private readonly availabilityModel: Model<ProviderAvailabilityDocument>,
    @InjectModel(ProviderProfile.name)
    private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(ProviderBlackout.name)
    private readonly blackoutModel: Model<ProviderBlackoutDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  async getOrCreate(providerUserId: string): Promise<ProviderAvailabilityDocument> {
    const existing = await this.availabilityModel.findOne({ providerUserId }).exec();
    if (existing) return existing;

    return this.availabilityModel.create({
      providerUserId,
      timeZone: 'Europe/Berlin',
      slotDurationMin: 60,
      bufferMin: 0,
      isActive: true,
      weekly: [],
    });
  }

  async updateMy(
    providerUserId: string,
    updates: Partial<ProviderAvailability>,
  ): Promise<ProviderAvailabilityDocument> {
    const provider = await this.providerModel.findOne({ userId: providerUserId }).exec();
    if (!provider) throw new NotFoundException('Provider profile not found');

    const doc = await this.getOrCreate(providerUserId);

    if (updates.weekly) {
      this.validateWeekly(updates.weekly as any);
      doc.weekly = updates.weekly as any;
    }
    if (typeof updates.timeZone === 'string') {
      const tz = updates.timeZone.trim();
      this.ensureValidTimeZone(tz);
      doc.timeZone = tz;
    }
    if (typeof updates.slotDurationMin === 'number') doc.slotDurationMin = updates.slotDurationMin;
    if (typeof updates.bufferMin === 'number') doc.bufferMin = updates.bufferMin;
    if (typeof updates.isActive === 'boolean') doc.isActive = updates.isActive;

    return doc.save();
  }

  async listMyBlackouts(providerUserId: string): Promise<ProviderBlackoutDocument[]> {
    return this.blackoutModel
      .find({ providerUserId })
      .sort({ startAt: 1 })
      .exec();
  }

  async addMyBlackout(
    providerUserId: string,
    input: { startAt: Date; endAt: Date; reason?: string; isActive?: boolean },
  ): Promise<ProviderBlackoutDocument> {
    const startAt = input.startAt;
    const endAt = input.endAt;

    if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('startAt must be a valid date');
    }
    if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('endAt must be a valid date');
    }
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('endAt must be after startAt');
    }

    const maxMs = 60 * 24 * 60 * 60 * 1000;
    if (endAt.getTime() - startAt.getTime() > maxMs) {
      throw new BadRequestException('Blackout too long (max 60 days)');
    }

    return this.blackoutModel.create({
      providerUserId,
      startAt,
      endAt,
      reason: input.reason?.trim?.() ?? null,
      isActive: typeof input.isActive === 'boolean' ? input.isActive : true,
    });
  }

  async removeMyBlackout(providerUserId: string, blackoutId: string): Promise<void> {
    const id = String(blackoutId ?? '').trim();
    if (!id) throw new BadRequestException('blackoutId is required');

    const res = await this.blackoutModel.deleteOne({ _id: id, providerUserId }).exec();
    if (res.deletedCount === 0) throw new NotFoundException('Blackout not found');
  }

  async getSlots(
    providerUserId: string,
    from?: string,
    to?: string,
    tzOverride?: string,
  ): Promise<Slot[]> {
    const avail = await this.availabilityModel.findOne({ providerUserId }).exec();
    if (!avail || !avail.isActive) return [];

    const tz = (tzOverride ?? avail.timeZone ?? 'Europe/Berlin').trim();
    this.ensureValidTimeZone(tz);

    const startDay = this.parseLocalDay(from ?? this.todayISOInTZ(tz), tz);
    const endDay = this.parseLocalDay(to ?? this.addDaysISOInTZ(startDay, tz, 7), tz);

    const days = this.diffDaysLocal(startDay, endDay);
    if (days < 0) throw new BadRequestException('to must be >= from');
    if (days > 14) throw new BadRequestException('Date range is too large (max 14 days)');

    const rangeStartUtc = startDay.startOf('day').toUTC();
    const rangeEndUtc = endDay.endOf('day').toUTC();

    const blackouts = await this.blackoutModel
      .find({
        providerUserId,
        isActive: true,
        startAt: { $lte: rangeEndUtc.toJSDate() },
        endAt: { $gte: rangeStartUtc.toJSDate() },
      })
      .exec();

    const blackoutIntervals = blackouts.map((b) => ({
      startMs: b.startAt.getTime(),
      endMs: b.endAt.getTime(),
    }));

    const bookings = await this.bookingModel
      .find({
        providerUserId,
        status: { $in: ['confirmed', 'completed'] },
        startAt: { $lte: rangeEndUtc.toJSDate() },
        endAt: { $gte: rangeStartUtc.toJSDate() },
      })
      .select({ startAt: 1, endAt: 1 })
      .exec();

    const bookingIntervals = bookings.map((b) => ({
      startMs: new Date(b.startAt).getTime(),
      endMs: new Date(b.endAt).getTime(),
    }));

    const busy = [...blackoutIntervals, ...bookingIntervals];

    const slots: Slot[] = [];
    const slotDuration = avail.slotDurationMin ?? 60;
    const step = slotDuration + (avail.bufferMin ?? 0);

    for (let i = 0; i <= days; i++) {
      const day = startDay.plus({ days: i });

      const dayOfWeek = day.weekday % 7;

      const schedule = (avail.weekly ?? []).find((x) => x.dayOfWeek === dayOfWeek);
      if (!schedule || !schedule.ranges?.length) continue;

      for (const r of schedule.ranges) {
        const { startMin, endMin } = this.parseRange(r);
        for (let m = startMin; m + slotDuration <= endMin; m += step) {
          const slotStartLocal = day
            .startOf('day')
            .plus({ minutes: m });

          const slotEndLocal = slotStartLocal.plus({ minutes: slotDuration });

          const slotStartUtc = slotStartLocal.toUTC();
          const slotEndUtc = slotEndLocal.toUTC();

          if (slotEndUtc.toMillis() <= Date.now()) continue;

          const sMs = slotStartUtc.toMillis();
          const eMs = slotEndUtc.toMillis();
          if (this.intersectsAny(sMs, eMs, busy)) continue;

          slots.push({ startAt: slotStartUtc.toISO()!, endAt: slotEndUtc.toISO()! });
          if (slots.length >= 500) return slots;
        }
      }
    }

    return slots;
  }

  private intersectsAny(s: number,e: number, intervals: Array<{ startMs: number; endMs: number }>): boolean {
    for (const it of intervals) {
      if (s < it.endMs && e > it.startMs) return true;
    }
    return false;
  }

  private ensureValidTimeZone(tz: string) {
    if (!IANAZone.isValidZone(tz)) throw new BadRequestException('Invalid time zone');
  }

  private validateWeekly(weekly: WeeklyDaySchedule[]) {
    if (!Array.isArray(weekly)) throw new BadRequestException('weekly must be array');
    for (const d of weekly) {
      if (typeof d.dayOfWeek !== 'number' || d.dayOfWeek < 0 || d.dayOfWeek > 6) {
        throw new BadRequestException('weekly.dayOfWeek must be 0..6');
      }
      if (!Array.isArray(d.ranges)) throw new BadRequestException('weekly.ranges must be array');
      for (const r of d.ranges as TimeRange[]) this.parseRange(r);
    }
  }

  private parseRange(r: TimeRange): { startMin: number; endMin: number } {
    const startMin = this.hhmmToMinutes(r.start);
    const endMin = this.hhmmToMinutes(r.end);
    if (endMin <= startMin) throw new BadRequestException('Range end must be after start');
    return { startMin, endMin };
  }

  private hhmmToMinutes(s: string): number {
    if (!/^\d{2}:\d{2}$/.test(String(s))) throw new BadRequestException('Time must be HH:mm');
    const [hh, mm] = s.split(':').map((x) => Number(x));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new BadRequestException('Invalid time');
    return hh * 60 + mm;
  }

  private parseLocalDay(isoDay: string, tz: string): DateTime {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) throw new BadRequestException('Invalid day format');
    const dt = DateTime.fromISO(isoDay, { zone: tz }).startOf('day');
    if (!dt.isValid) throw new BadRequestException('Invalid day');
    return dt;
  }

  private todayISOInTZ(tz: string): string {
    return DateTime.now().setZone(tz).toFormat('yyyy-LL-dd');
  }

  private addDaysISOInTZ(fromDay: DateTime, tz: string, add: number): string {
    return fromDay.setZone(tz).plus({ days: add }).toFormat('yyyy-LL-dd');
  }

  private diffDaysLocal(a: DateTime, b: DateTime): number {
    return Math.floor(b.diff(a, 'days').days);
  }
}
