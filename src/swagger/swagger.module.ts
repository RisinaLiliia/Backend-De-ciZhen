// src/swagger/swagger.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule, ThrottlerModuleOptions } from "@nestjs/throttler";
import appConfig from "../config/env";
import { envValidationSchema } from "../config/env.validation";
import { AppController } from "../app.controller";
import { AppService } from "../app.service";
import { CatalogModule } from "../modules/catalog/catalog.module";
import { UsersModule } from "../modules/users/users.module";
import { AuthModule } from "../modules/auth/auth.module";
import { ProvidersModule } from "../modules/providers/providers.module";
import { RequestsModule } from "../modules/requests/requests.module";
import { OffersModule } from "../modules/offers/offers.module";
import { ContractsModule } from "../modules/contracts/contracts.module";
import { AvailabilityModule } from "../modules/availability/availability.module";
import { BookingsModule } from "../modules/bookings/bookings.module";
import { GeoModule } from "../modules/geo/geo.module";
import { ReviewsModule } from "../modules/reviews/reviews.module";
import { LegalModule } from "../modules/legal/legal.module";
import { PresenceModule } from "../modules/presence/presence.module";
import { FavoritesModule } from "../modules/favorites/favorites.module";
import { ChatsModule } from "../modules/chats/chats.module";
import { MongooseStubModule } from "./mongoose-stub.module";
import { RedisStubModule } from "./redis-stub.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: envValidationSchema,
    }),
    MongooseStubModule,
    RedisStubModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const windowMs = Number(config.get("app.rateLimitWindowMs") ?? 60000);
        const limit = Number(config.get("app.rateLimitMax") ?? 100);

        const options: ThrottlerModuleOptions = {
          throttlers: [
            {
              ttl: Math.ceil(windowMs / 1000),
              limit,
            },
          ],
        };

        return options;
      },
    }),
    CatalogModule,
    UsersModule,
    AuthModule,
    ProvidersModule,
    RequestsModule,
    OffersModule,
    ContractsModule,
    AvailabilityModule,
    BookingsModule,
    GeoModule,
    ReviewsModule,
    LegalModule,
    PresenceModule,
    FavoritesModule,
    ChatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class SwaggerAppModule {}
