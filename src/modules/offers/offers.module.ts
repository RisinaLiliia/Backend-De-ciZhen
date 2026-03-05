// src/modules/offers/offers.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { ProviderProfile, ProviderProfileSchema } from '../providers/schemas/provider-profile.schema';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ProvidersService } from '../providers/providers.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: ProviderProfile.name, schema: ProviderProfileSchema },
      { name: Request.name, schema: RequestSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [OffersController],
  providers: [OffersService, ProvidersService],
  exports: [OffersService],
})
export class OffersModule {}
