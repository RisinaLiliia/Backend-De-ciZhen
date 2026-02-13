// src/modules/favorites/schemas/favorite.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type FavoriteDocument = Favorite & Document;
export type FavoriteType = 'provider' | 'request';

@Schema({ timestamps: true, collection: 'favorites' })
export class Favorite {
  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({ type: String, enum: ['provider', 'request'], required: true, index: true })
  type: FavoriteType;

  @Prop({ type: String, required: true, index: true })
  targetId: string;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

FavoriteSchema.index({ userId: 1, type: 1, targetId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, type: 1, createdAt: -1 });
