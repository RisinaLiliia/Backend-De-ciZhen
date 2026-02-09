// src/modules/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument, AppRole } from "./schemas/user.schema";
import { hashPassword } from "../../utils/password";
import { ClientProfilesService } from "./client-profiles.service";

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: AppRole;
  acceptedPrivacyPolicy: boolean;
  acceptedPrivacyPolicyAt: Date;
  city?: string;
  language?: string;
};

type UpdateMeInput = Partial<
  Pick<User, "name" | "city" | "language" | "phone">
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
      .select("name avatar city")
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
    if (exists) throw new ConflictException("Email already in use");

    const passwordHash = await hashPassword(input.password);

    const user = new this.userModel({
      name: input.name,
      email,
      passwordHash,
      role: input.role,
      acceptedPrivacyPolicy: input.acceptedPrivacyPolicy,
      acceptedPrivacyPolicyAt: input.acceptedPrivacyPolicyAt,
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

    if (updates.avatarUrl !== undefined) {
      payload.avatar = { url: updates.avatarUrl, isDefault: false };
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, payload, { new: true })
      .exec();

    if (!user) throw new NotFoundException("User not found");
    return user;
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
