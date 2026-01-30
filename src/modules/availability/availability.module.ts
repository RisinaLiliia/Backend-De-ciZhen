// src/modules/availability/availability.module.ts
import { Module,forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { ProviderAvailability, ProviderAvailabilitySchema } from './schemas/provider-availability.schema';
import { ProviderBlackout, ProviderBlackoutSchema } from './schemas/provider-blackout.schema';
import { ProviderProfile, ProviderProfileSchema } from '../providers/schemas/provider-profile.schema';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { BookingsModule } from '../bookings/bookings.module'; 
@Module({
  imports: [
     forwardRef(() => BookingsModule), 
    MongooseModule.forFeature([
      { name: ProviderAvailability.name, schema: ProviderAvailabilitySchema },
      { name: ProviderBlackout.name, schema: ProviderBlackoutSchema },
      { name: ProviderProfile.name, schema: ProviderProfileSchema },
      { name: Request.name, schema: RequestSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
