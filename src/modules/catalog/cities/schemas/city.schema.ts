// src/modules/catalog/cities/schemas/city.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type CityDocument = City & Document;

@Schema({ timestamps: true })
export class City {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 80 })
  name: string;

  @Prop({ trim: true, maxlength: 2, default: "DE" })
  countryCode: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Number, default: null })
  sortOrder: number | null;
}

export const CitySchema = SchemaFactory.createForClass(City);

CitySchema.index({ countryCode: 1, name: 1 }, { unique: true });

CitySchema.index({ isActive: 1, countryCode: 1, sortOrder: 1, name: 1 });
