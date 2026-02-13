import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract, ContractSchema } from './schemas/contract.schema';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
      { name: Request.name, schema: RequestSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    forwardRef(() => BookingsModule),
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
