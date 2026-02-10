// src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import appConfig from "./config/env";
import { envValidationSchema } from "./config/env.validation";
import { DatabaseModule } from "./config/database";
import { RedisModule } from "./config/redis";
import { ThrottlerModule, ThrottlerModuleOptions } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { ProvidersModule } from './modules/providers/providers.module';
import { RequestsModule } from './modules/requests/requests.module';
import { ResponsesModule } from './modules/responses/responses.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { GeoModule } from './modules/geo/geo.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { LegalModule } from './modules/legal/legal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: envValidationSchema,
    }),

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

    DatabaseModule,
    RedisModule,
    CatalogModule,
    UsersModule,
    AuthModule,
    ProvidersModule,
    RequestsModule,
    ResponsesModule,
    AvailabilityModule,
    BookingsModule,
    GeoModule,
    ReviewsModule,
    LegalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
