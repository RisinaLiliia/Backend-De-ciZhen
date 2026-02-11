// src/modules/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AppRole = "client" | "provider" | "admin";
export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 50 })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 100,
  })
  email: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({
    type: String,
    enum: ["client", "provider", "admin"],
    default: "client",
  })
  role: AppRole;

  @Prop({ trim: true, maxlength: 100 })
  city?: string;

  @Prop({ trim: true, maxlength: 10 })
  language?: string;

  @Prop({ required: true, default: false })
  acceptedPrivacyPolicy: boolean;

  @Prop({ type: Date, default: null })
  acceptedPrivacyPolicyAt: Date | null;

  @Prop({
    type: {
      url: { type: String, default: "/avatars/default.png" },
      isDefault: { type: Boolean, default: true },
    },
    default: {
      url: "/avatars/default.png",
      isDefault: true,
    },
  })
  avatar: {
    url: string;
    isDefault: boolean;
  };

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ type: Date, default: null })
  blockedAt: Date | null;

  @Prop({ type: Date, default: null })
  lastSeenAt: Date | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1, city: 1 });
