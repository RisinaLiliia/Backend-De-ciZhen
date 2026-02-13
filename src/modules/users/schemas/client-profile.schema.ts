// src/modules/users/schemas/client-profile.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type ClientProfileDocument = ClientProfile & Document;

@Schema({ timestamps: true, collection: "client_profiles" })
export class ClientProfile {
  @Prop({ type: String, required: true, index: true, unique: true })
  userId: string;

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  ratingAvg: number;

  @Prop({ type: Number, default: 0, min: 0 })
  ratingCount: number;

  @Prop({ type: Object, default: {} })
  stats: Record<string, number>;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ type: Date, default: null })
  blockedAt: Date | null;
}

export const ClientProfileSchema = SchemaFactory.createForClass(ClientProfile);

ClientProfileSchema.index({ ratingAvg: -1, ratingCount: -1 });
