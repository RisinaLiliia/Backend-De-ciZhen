// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { UsersService } from "../users/users.service";
import { comparePassword, hashPassword } from "../../utils/password";
import { RegisterDto } from "./dto/register.dto";
import { RedisService } from "../../infra/redis.service";
import { JwtPayload, TokenResponse, SafeUser, AppRole } from "./auth.types";
import type { UserDocument } from "../users/schemas/user.schema";
import { ProvidersService } from "../providers/providers.service";

type SocialProvider = "google" | "apple";

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private usersService: UsersService,
    private redisService: RedisService,
    private providersService: ProvidersService,
  ) {}

  async register(data: RegisterDto): Promise<TokenResponse> {
    if (!data.acceptPrivacyPolicy) {
      throw new BadRequestException({
        message: "Privacy policy must be accepted",
        errorCode: "AUTH_PRIVACY_NOT_ACCEPTED",
      });
    }

    const role: AppRole = data.role ?? "client";

    const user = await this.usersService.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role,
      acceptedPrivacyPolicy: true,
      acceptedPrivacyPolicyAt: new Date(),
      ...(data.city ? { city: data.city } : {}),
      ...(data.language ? { language: data.language } : {}),
    });

    if (role === "provider") {
      try {
        await this.providersService.activateIfComplete(user._id.toString());
      } catch {
      }
    }

    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const user = await this.usersService.findAuthUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException({
        message: "Invalid credentials",
        errorCode: "AUTH_INVALID_CREDENTIALS",
      });
    }

    if ((user as any).isBlocked) {
      throw new UnauthorizedException({
        message: "User blocked",
        errorCode: "AUTH_USER_BLOCKED",
      });
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        message: "Invalid credentials",
        errorCode: "AUTH_INVALID_CREDENTIALS",
      });
    }

    if (user.role === "provider") {
      try {
        await this.providersService.activateIfComplete(user._id.toString());
      } catch {
      }
    }

    return this.generateTokens(user);
  }

  async refresh(
    refreshToken?: string,
  ): Promise<
    Pick<TokenResponse, "accessToken" | "refreshToken" | "expiresIn">
  > {
    if (!refreshToken) {
      throw new UnauthorizedException({
        message: "Missing refresh token",
        errorCode: "AUTH_REFRESH_TOKEN_MISSING",
      });
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify(refreshToken) as JwtPayload;
    } catch {
      throw new UnauthorizedException({
        message: "Invalid refresh token",
        errorCode: "AUTH_REFRESH_TOKEN_INVALID",
      });
    }

    let user: UserDocument;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException({
        message: "User not found",
        errorCode: "AUTH_USER_NOT_FOUND",
      });
    }

    if ((user as any).isBlocked) {
      throw new UnauthorizedException({
        message: "User blocked",
        errorCode: "AUTH_USER_BLOCKED",
      });
    }

    const key = `refresh:${payload.sub}:${payload.sessionId}`;
    const redisHash = await this.redisService.get(key);
    if (!redisHash) {
      throw new UnauthorizedException({
        message: "Session expired",
        errorCode: "AUTH_SESSION_EXPIRED",
      });
    }

    const ok = await comparePassword(refreshToken, redisHash);
    if (!ok) {
      throw new UnauthorizedException({
        message: "Invalid refresh token",
        errorCode: "AUTH_REFRESH_TOKEN_INVALID",
      });
    }

    await this.redisService.del(key);
    return this.generateTokens(user);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    try {
      const payload = this.jwt.verify(refreshToken) as JwtPayload;
      await this.redisService.del(
        `refresh:${payload.sub}:${payload.sessionId}`,
      );
    } catch {
    }
  }

  createOauthState(provider: SocialProvider, nextPath: string): string {
    return this.jwt.sign(
      {
        type: "oauth_state",
        provider,
        nextPath,
      },
      { expiresIn: "10m" },
    );
  }

  consumeOauthState(stateToken: string, provider: SocialProvider): string {
    try {
      const payload = this.jwt.verify(stateToken) as {
        type?: string;
        provider?: SocialProvider;
        nextPath?: string;
      };
      if (payload?.type !== "oauth_state" || payload?.provider !== provider) {
        throw new ForbiddenException({
          message: "Invalid oauth state",
          errorCode: "AUTH_OAUTH_STATE_INVALID",
        });
      }
      const nextPath = String(payload.nextPath ?? "/orders?tab=my-requests");
      return nextPath.startsWith("/") ? nextPath : "/orders?tab=my-requests";
    } catch {
      throw new ForbiddenException({
        message: "Invalid oauth state",
        errorCode: "AUTH_OAUTH_STATE_INVALID",
      });
    }
  }

  async loginOrRegisterSocial(params: {
    provider: SocialProvider;
    email: string;
    name?: string;
    avatarUrl?: string;
  }): Promise<TokenResponse> {
    const email = params.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException({
        message: "Social account email is required",
        errorCode: "AUTH_SOCIAL_EMAIL_MISSING",
      });
    }

    let user = await this.usersService.findByEmail(email);
    if (user && (user as any).isBlocked) {
      throw new UnauthorizedException({
        message: "User blocked",
        errorCode: "AUTH_USER_BLOCKED",
      });
    }

    if (!user) {
      user = await this.usersService.create({
        name: params.name?.trim() || email.split("@")[0] || "User",
        email,
        password: randomUUID(),
        role: "client",
        acceptedPrivacyPolicy: false,
        acceptedPrivacyPolicyAt: null,
      });
    }

    return this.generateTokens(user as UserDocument);
  }

  private async generateTokens(user: UserDocument): Promise<TokenResponse> {
    const userId = user._id.toString();
    const sessionId = randomUUID();

    const payload: JwtPayload = {
      sub: userId,
      role: user.role as AppRole,
      sessionId,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: "15m" });
    const refreshToken = this.jwt.sign(payload, { expiresIn: "7d" });

    const refreshHash = await hashPassword(refreshToken);
    await this.redisService.set(
      `refresh:${userId}:${sessionId}`,
      refreshHash,
      7 * 24 * 60 * 60,
    );

    const safeUser: SafeUser = {
      id: userId,
      name: user.name,
      email: user.email,
      role: user.role as AppRole,
      city: user.city,
      language: user.language,
      createdAt: (user as any).createdAt,
    };

    return { user: safeUser, accessToken, refreshToken, expiresIn: 900 };
  }
}
