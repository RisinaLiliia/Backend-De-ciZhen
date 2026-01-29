// src/modules/availability/schemas/provider-availability.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ProviderAvailabilityDocument = ProviderAvailability & Document;

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TimeRange = {
  start: string; 
  end: string;   
};

export type WeeklyDaySchedule = {
  dayOfWeek: DayOfWeek;
  ranges: TimeRange[];
};

@Schema({ timestamps: true, collection: 'provider_availability' })
export class ProviderAvailability {
  @Prop({ type: String, required: true, unique: true })
  providerUserId: string;

  @Prop({ type: String, default: 'Europe/Berlin', trim: true, maxlength: 64 })
  timeZone: string;

  @Prop({ type: Number, default: 60, min: 15, max: 240 })
  slotDurationMin: number;

  @Prop({ type: Number, default: 0, min: 0, max: 120 })
  bufferMin: number;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({
    type: [
      {
        dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
        ranges: {
          type: [
            {
              start: { type: String, required: true },
              end: { type: String, required: true },
            },
          ],
          default: [],
        },
      },
    ],
    default: [],
  })
  weekly: WeeklyDaySchedule[];
}

export const ProviderAvailabilitySchema = SchemaFactory.createForClass(ProviderAvailability);

ProviderAvailabilitySchema.index({ isActive: 1, updatedAt: -1 });
