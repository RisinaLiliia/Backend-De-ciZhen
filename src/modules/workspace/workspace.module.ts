import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceStatisticsService } from './workspace-statistics.service';
import { WorkspaceRequestsService } from './workspace-requests.service';
import { WorkspaceMarketRequestsService } from './workspace-market-requests.service';
import { WorkspaceRequestSnapshotsService } from './workspace-request-snapshots.service';
import { WorkspaceRequestsListPolicy } from './workspace-requests-list-policy';
import { WorkspaceRequestsPresenter } from './workspace-requests.presenter';
import { WorkspacePublicOverviewService } from './workspace-public-overview.service';
import { WorkspacePublicRequestEnricherService } from './workspace-public-request-enricher.service';
import { WorkspacePublicCityActivityService } from './workspace-public-city-activity.service';
import { WorkspacePrivateOverviewService } from './workspace-private-overview.service';
import { InsightsService } from './insights.service';
import { WorkspaceStatisticsMarketSnapshotsService } from './workspace-statistics-market-snapshots.service';
import { WorkspaceStatisticsViewerSnapshotsService } from './workspace-statistics-viewer-snapshots.service';
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
import { CatalogServicesModule } from '../catalog/services/services.module';

@Module({
  imports: [
    RequestsModule,
    AnalyticsModule,
    UsersModule,
    PresenceModule,
    CitiesModule,
    CatalogServicesModule,
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
  providers: [WorkspaceService, WorkspaceRequestSnapshotsService, WorkspaceRequestsListPolicy, WorkspaceRequestsPresenter, WorkspaceRequestsService, WorkspaceMarketRequestsService, WorkspacePublicRequestEnricherService, WorkspacePublicCityActivityService, WorkspacePublicOverviewService, WorkspacePrivateOverviewService, WorkspaceStatisticsMarketSnapshotsService, WorkspaceStatisticsViewerSnapshotsService, WorkspaceStatisticsService, InsightsService],
})
export class WorkspaceModule {}
