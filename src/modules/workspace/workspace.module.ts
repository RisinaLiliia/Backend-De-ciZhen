import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceStatisticsService } from './workspace-statistics.service';
import { WorkspaceRequestsService } from './workspace-requests.service';
import { InsightsService } from './insights.service';
import { RequestsModule } from '../requests/requests.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { ProviderProfile, ProviderProfileSchema } from '../providers/schemas/provider-profile.schema';
import { Favorite, FavoriteSchema } from '../favorites/schemas/favorite.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { ClientProfile, ClientProfileSchema } from '../users/schemas/client-profile.schema';
import { CitiesModule } from '../catalog/cities/cities.module';

@Module({
  imports: [
    RequestsModule,
    AnalyticsModule,
    UsersModule,
    PresenceModule,
    CitiesModule,
    MongooseModule.forFeature([
      { name: Request.name, schema: RequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: ProviderProfile.name, schema: ProviderProfileSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
    ]),
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceRequestsService, WorkspaceStatisticsService, InsightsService],
})
export class WorkspaceModule {}
