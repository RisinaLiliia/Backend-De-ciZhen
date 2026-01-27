// src/modules/catalog/services/schemas/service-category.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ServiceCategoryDocument = ServiceCategory & Document;

@Schema({ timestamps: true })
export class ServiceCategory {
  @Prop({ required: true, trim: true, lowercase: true, maxlength: 50 })
  key: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ServiceCategorySchema = SchemaFactory.createForClass(ServiceCategory);

ServiceCategorySchema.index({ key: 1 }, { unique: true });
ServiceCategorySchema.index({ isActive: 1, sortOrder: 1 });
