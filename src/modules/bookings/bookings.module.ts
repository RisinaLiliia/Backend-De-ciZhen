// src/modules/bookings/bookings.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ProviderBlackout, ProviderBlackoutSchema } from '../availability/schemas/provider-blackout.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: ProviderBlackout.name, schema: ProviderBlackoutSchema },
    
    ]),
  ],
  providers: [BookingsService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
