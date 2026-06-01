import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceStatisticsService } from './workspace-statistics.service';
import { WorkspaceRequestsService } from './workspace-requests.service';
import { WorkspaceMarketRequestsService } from './workspace-market-requests.service';
import { WorkspaceProvidersService } from './workspace-providers.service';
import { WorkspaceReviewsService } from './workspace-reviews.service';
import { WorkspaceActionsService } from './workspace-actions.service';
import { WorkspaceChatService } from './workspace-chat.service';
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
import { WorkspaceProfileService } from './workspace-profile.service';
import { RequestsModule } from '../requests/requests.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { ProviderProfile, ProviderProfileSchema } from '../providers/schemas/provider-profile.schema';
import { ProviderAvailability, ProviderAvailabilitySchema } from '../availability/schemas/provider-availability.schema';
import { Favorite, FavoriteSchema } from '../favorites/schemas/favorite.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { ClientProfile, ClientProfileSchema } from '../users/schemas/client-profile.schema';
import { CitiesModule } from '../catalog/cities/cities.module';
import { CatalogServicesModule } from '../catalog/services/services.module';
import { ProvidersModule } from '../providers/providers.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ChatsModule } from '../chats/chats.module';
import { ChatThread, ChatThreadSchema } from '../chats/schemas/chat-thread.schema';

@Module({
  imports: [
    RequestsModule,
    AnalyticsModule,
    UsersModule,
    PresenceModule,
    CitiesModule,
    CatalogServicesModule,
    ProvidersModule,
    ReviewsModule,
    AuthModule,
    UploadsModule,
    ChatsModule,
    MongooseModule.forFeature([
      { name: ChatThread.name, schema: ChatThreadSchema },
      { name: Request.name, schema: RequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: ProviderProfile.name, schema: ProviderProfileSchema },
      { name: ProviderAvailability.name, schema: ProviderAvailabilitySchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
    ]),
  ],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceRequestSnapshotsService,
    WorkspaceRequestsListPolicy,
    WorkspaceRequestsPresenter,
    WorkspaceRequestsService,
    WorkspaceMarketRequestsService,
    WorkspaceProvidersService,
    WorkspaceReviewsService,
    WorkspaceActionsService,
    WorkspaceChatService,
    WorkspacePublicRequestEnricherService,
    WorkspacePublicCityActivityService,
    WorkspacePublicOverviewService,
    WorkspacePrivateOverviewService,
    WorkspaceStatisticsMarketSnapshotsService,
    WorkspaceStatisticsViewerSnapshotsService,
    WorkspaceStatisticsService,
    WorkspaceProfileService,
    InsightsService,
  ],
})
export class WorkspaceModule {}
