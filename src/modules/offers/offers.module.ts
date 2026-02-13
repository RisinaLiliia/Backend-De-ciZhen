// src/modules/offers/offers.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { ProviderProfile, ProviderProfileSchema } from '../providers/schemas/provider-profile.schema';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: ProviderProfile.name, schema: ProviderProfileSchema },
      { name: Request.name, schema: RequestSchema },
      { name: Contract.name, schema: ContractSchema },
    ]),
  ],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
