//src/modules/responses/responses.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResponsesController } from './responses.controller';
import { ResponsesService } from './responses.service';
import { Response, ResponseSchema } from './schemas/response.schema';
import { ProviderProfile, ProviderProfileSchema } from '../providers/schemas/provider-profile.schema';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Response.name, schema: ResponseSchema },
      { name: ProviderProfile.name, schema: ProviderProfileSchema },
      { name: Request.name, schema: RequestSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
  ],
  controllers: [ResponsesController],
  providers: [ResponsesService],
  exports: [ResponsesService],
})
export class ResponsesModule {}
