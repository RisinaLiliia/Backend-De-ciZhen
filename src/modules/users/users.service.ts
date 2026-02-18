// src/modules/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument, AppRole } from "./schemas/user.schema";
import { comparePassword, hashPassword } from "../../utils/password";
import { ClientProfilesService } from "./client-profiles.service";

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: AppRole;
  acceptedPrivacyPolicy: boolean;
  acceptedPrivacyPolicyAt?: Date | null;
  city?: string;
  language?: string;
};

type UpdateMeInput = Partial<
  Pick<User, "name" | "city" | "language" | "phone" | "bio">
> & {
  avatarUrl?: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly clientProfiles: ClientProfilesService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async findById(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async findPublicByIds(userIds: string[]): Promise<UserDocument[]> {
    const ids = Array.isArray(userIds)
      ? Array.from(
          new Set(
            userIds
              .map((x) => String(x))
              .filter((x) => Types.ObjectId.isValid(x)),
          ),
        )
      : [];
    if (ids.length === 0) return [];
    return this.userModel
      .find({ _id: { $in: ids } })
      .select("name avatar city lastSeenAt")
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: this.normalizeEmail(email) }).exec();
  }

  async findAuthUserByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: this.normalizeEmail(email) })
      .select("+passwordHash")
      .exec();
  }

  async create(input: CreateUserInput): Promise<UserDocument> {
    const email = this.normalizeEmail(input.email);
    const exists = await this.userModel.findOne({ email }).exec();
    if (exists) {
      throw new ConflictException({
        message: "Email already in use",
        errorCode: "AUTH_EMAIL_EXISTS",
      });
    }

    const passwordHash = await hashPassword(input.password);

    const user = new this.userModel({
      name: input.name,
      email,
      passwordHash,
      role: input.role,
      acceptedPrivacyPolicy: input.acceptedPrivacyPolicy,
      acceptedPrivacyPolicyAt: input.acceptedPrivacyPolicy ? (input.acceptedPrivacyPolicyAt ?? new Date()) : null,
      city: input.city,
      language: input.language,
      avatar: { url: "/avatars/default.png", isDefault: true },
      isBlocked: false,
      blockedAt: null,
      metadata: {},
    });

    const created = await user.save();
    if (created.role === "client") {
      await this.clientProfiles.getOrCreateByUserId(created._id.toString());
    }
    return created;
  }

  async updateMe(
    userId: string,
    updates: UpdateMeInput,
  ): Promise<UserDocument> {
    const payload: Partial<User> = {};

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.language !== undefined) payload.language = updates.language;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.bio !== undefined) payload.bio = updates.bio;

    if (updates.avatarUrl !== undefined) {
      payload.avatar = { url: updates.avatarUrl, isDefault: false };
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, payload, { new: true })
      .exec();

    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select("+passwordHash")
      .exec();
    if (!user) throw new NotFoundException("User not found");

    const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException("Current password is invalid");
    }

    const isSameAsCurrent = await comparePassword(newPassword, user.passwordHash);
    if (isSameAsCurrent) {
      throw new BadRequestException("New password must be different from current password");
    }

    const nextHash = await hashPassword(newPassword);
    await this.userModel
      .findByIdAndUpdate(userId, { $set: { passwordHash: nextHash } }, { new: false })
      .exec();
  }

  async touchLastSeen(userId: string): Promise<void> {
    const id = String(userId ?? "").trim();
    if (!id) return;
    await this.userModel
      .findByIdAndUpdate(id, { $set: { lastSeenAt: new Date() } })
      .exec();
  }

  async blockUser(userId: string): Promise<void> {
    const res = await this.userModel
      .findByIdAndUpdate(userId, { isBlocked: true, blockedAt: new Date() })
      .exec();
    if (!res) throw new NotFoundException("User not found");
  }

  async unblockUser(userId: string): Promise<void> {
    const res = await this.userModel
      .findByIdAndUpdate(userId, { isBlocked: false, blockedAt: null })
      .exec();
    if (!res) throw new NotFoundException("User not found");
  }
}
