import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import {
  SearchAnalyticsAggregate,
  SearchAnalyticsAggregateSchema,
} from './schemas/search-analytics-aggregate.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Request.name, schema: RequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: SearchAnalyticsAggregate.name, schema: SearchAnalyticsAggregateSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
