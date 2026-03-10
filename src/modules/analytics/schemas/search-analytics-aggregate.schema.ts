import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type SearchAnalyticsAggregateDocument = SearchAnalyticsAggregate & Document;

export type SearchAnalyticsTarget = 'request' | 'provider';

@Schema({
  timestamps: true,
  collection: 'analytics_search_aggregates',
})
export class SearchAnalyticsAggregate {
  @Prop({ type: Date, required: true, index: true })
  bucketStart: Date;

  @Prop({ type: String, enum: ['request', 'provider'], required: true, index: true })
  target: SearchAnalyticsTarget;

  @Prop({ type: String, trim: true, maxlength: 80, default: null, index: true })
  cityId: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  cityName: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null, index: true })
  citySlug: string | null;

  @Prop({ type: String, trim: true, maxlength: 80, default: null, index: true })
  categoryKey: string | null;

  @Prop({ type: String, trim: true, maxlength: 80, default: null, index: true })
  subcategoryKey: string | null;

  @Prop({ type: Number, min: 0, default: 0 })
  count: number;

  @Prop({ type: String, trim: true, maxlength: 80, default: 'other' })
  source: string;

  @Prop({ type: Date, required: true })
  lastEventAt: Date;
}

export const SearchAnalyticsAggregateSchema = SchemaFactory.createForClass(SearchAnalyticsAggregate);

SearchAnalyticsAggregateSchema.index(
  {
    bucketStart: 1,
    target: 1,
    cityId: 1,
    citySlug: 1,
    categoryKey: 1,
    subcategoryKey: 1,
  },
  {
    unique: true,
    name: 'uniq_bucket_target_city_category_subcategory',
  },
);

SearchAnalyticsAggregateSchema.index({ bucketStart: -1, citySlug: 1, target: 1 });
