// src/modules/catalog/services/schemas/service.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ServiceDocument = Service & Document;

@Schema({ timestamps: true })
export class Service {
  @Prop({ required: true, unique: true, trim: true, lowercase: true, maxlength: 80 })
  key: string; 

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 50 })
  categoryKey: string; 

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

ServiceSchema.index({ key: 1 }, { unique: true });
ServiceSchema.index({ categoryKey: 1, isActive: 1, sortOrder: 1 });
