// src/modules/catalog/cities/schemas/city.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type CityDocument = City & Document;

type GeoPoint = {
  type: "Point";
  coordinates: [number, number];
};

@Schema({ timestamps: true })
export class City {
  @Prop({ required: true, trim: true, lowercase: true, maxlength: 80 })
  key: string;

  @Prop({ trim: true, maxlength: 32, default: "manual" })
  source: string;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  sourceId?: string | null;

  @Prop({ trim: true, minlength: 2, maxlength: 80 })
  name?: string;

  @Prop({ type: String, trim: true, minlength: 2, maxlength: 160, index: true })
  normalizedName?: string;

  @Prop({ type: [String], default: [] })
  aliases: string[];

  @Prop({ type: [String], default: [] })
  normalizedAliases: string[];

  @Prop({ type: Object, default: {} })
  i18n: Record<string, string>;

  @Prop({ trim: true, maxlength: 2, default: "DE" })
  countryCode: string;

  @Prop({ type: String, trim: true, maxlength: 8, default: null })
  stateCode?: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  stateName?: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  districtName?: string | null;

  @Prop({ type: [String], default: [] })
  postalCodes: string[];

  @Prop({ type: Number, default: null })
  population?: number | null;

  @Prop({ type: Number, default: null })
  lat?: number | null;

  @Prop({ type: Number, default: null })
  lng?: number | null;

  @Prop({
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: { type: [Number] },
    _id: false,
  })
  location?: GeoPoint | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;
}

export const CitySchema = SchemaFactory.createForClass(City);

CitySchema.index({ key: 1 }, { unique: true });
CitySchema.index(
  { source: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceId: { $exists: true, $type: "string" },
    },
  },
);
CitySchema.index({ normalizedName: 1, countryCode: 1 });
CitySchema.index({ location: "2dsphere" }, { sparse: true });
CitySchema.index({ isActive: 1, countryCode: 1, sortOrder: 1, "i18n.en": 1, name: 1 });
