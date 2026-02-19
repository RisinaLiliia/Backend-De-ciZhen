// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";
import { comparePassword, hashPassword } from "../../utils/password";
import { RegisterDto } from "./dto/register.dto";
import { RedisService } from "../../infra/redis.service";
import { JwtPayload, TokenResponse, SafeUser, AppRole } from "./auth.types";
import type { UserDocument } from "../users/schemas/user.schema";
import { ProvidersService } from "../providers/providers.service";
import { PasswordResetDeliveryService } from "./password-reset-delivery.service";

type SocialProvider = "google" | "apple";
type SocialAuthResult =
  | { kind: "authenticated"; tokens: TokenResponse }
  | { kind: "consent_required"; signupToken: string };

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private usersService: UsersService,
    private redisService: RedisService,
    private providersService: ProvidersService,
    private config: ConfigService,
    private passwordResetDelivery: PasswordResetDeliveryService,
  ) {}

  private getCurrentPolicyVersion(): string {
    return this.config.get<string>("app.privacyPolicyVersion") ?? "2026-02-18";
  }

  private getPasswordResetTtlSeconds(): number {
    const minutes = Number(this.config.get<number>("app.passwordResetTtlMinutes") ?? 30);
    return Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes * 60) : 1800;
  }

  private shouldReturnPasswordResetLink(): boolean {
    return Boolean(this.config.get<boolean>("app.passwordResetReturnLink") ?? false);
  }

  private getPasswordResetPath(): string {
    const raw = String(this.config.get<string>("app.passwordResetPath") ?? "/auth/reset-password");
    return raw.startsWith("/") ? raw : "/auth/reset-password";
  }

  private sanitizeRelativePath(input?: string): string | undefined {
    if (!input) return undefined;
    const value = String(input).trim();
    if (!value.startsWith("/")) return undefined;
    if (/[\r\n]/.test(value)) return undefined;
    return value;
  }

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
      acceptedPrivacyPolicyVersion: this.getCurrentPolicyVersion(),
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

  private createOauthSignupToken(params: {
    provider: SocialProvider;
    email: string;
    name?: string;
    avatarUrl?: string;
  }): string {
    return this.jwt.sign(
      {
        type: "oauth_signup",
        provider: params.provider,
        email: params.email,
        name: params.name,
        avatarUrl: params.avatarUrl,
      },
      { expiresIn: "15m" },
    );
  }

  private consumeOauthSignupToken(token: string): {
    provider: SocialProvider;
    email: string;
    name?: string;
    avatarUrl?: string;
  } {
    try {
      const payload = this.jwt.verify(token) as {
        type?: string;
        provider?: SocialProvider;
        email?: string;
        name?: string;
        avatarUrl?: string;
      };
      if (
        payload?.type !== "oauth_signup" ||
        !payload.email ||
        (payload.provider !== "google" && payload.provider !== "apple")
      ) {
        throw new ForbiddenException({
          message: "Invalid oauth signup token",
          errorCode: "AUTH_OAUTH_SIGNUP_TOKEN_INVALID",
        });
      }
      return {
        provider: payload.provider,
        email: String(payload.email).trim().toLowerCase(),
        name: payload.name,
        avatarUrl: payload.avatarUrl,
      };
    } catch {
      throw new ForbiddenException({
        message: "Invalid oauth signup token",
        errorCode: "AUTH_OAUTH_SIGNUP_TOKEN_INVALID",
      });
    }
  }

  async resolveSocialAuth(params: {
    provider: SocialProvider;
    email: string;
    name?: string;
    avatarUrl?: string;
  }): Promise<SocialAuthResult> {
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

    if (user?.acceptedPrivacyPolicy) {
      return { kind: "authenticated", tokens: await this.generateTokens(user as UserDocument) };
    }

    return {
      kind: "consent_required",
      signupToken: this.createOauthSignupToken({
        provider: params.provider,
        email,
        name: params.name,
        avatarUrl: params.avatarUrl,
      }),
    };
  }

  async completeOauthSignup(params: {
    signupToken: string;
    acceptPrivacyPolicy: boolean;
  }): Promise<TokenResponse> {
    if (!params.acceptPrivacyPolicy) {
      throw new BadRequestException({
        message: "Privacy policy must be accepted",
        errorCode: "AUTH_PRIVACY_NOT_ACCEPTED",
      });
    }

    const payload = this.consumeOauthSignupToken(params.signupToken);
    const policyVersion = this.getCurrentPolicyVersion();

    let user = await this.usersService.findByEmail(payload.email);
    if (user && (user as any).isBlocked) {
      throw new UnauthorizedException({
        message: "User blocked",
        errorCode: "AUTH_USER_BLOCKED",
      });
    }

    if (!user) {
      user = await this.usersService.create({
        name: payload.name?.trim() || payload.email.split("@")[0] || "User",
        email: payload.email,
        password: randomUUID(),
        role: "client",
        acceptedPrivacyPolicy: true,
        acceptedPrivacyPolicyAt: new Date(),
        acceptedPrivacyPolicyVersion: policyVersion,
      });
    } else if (!user.acceptedPrivacyPolicy) {
      user = await this.usersService.acceptPrivacyPolicy(user._id.toString(), policyVersion);
    }

    return this.generateTokens(user as UserDocument);
  }

  async forgotPassword(email: string, nextPath?: string): Promise<{ ok: true; resetUrl?: string }> {
    const normalized = String(email ?? "").trim().toLowerCase();
    if (!normalized) return { ok: true };

    const user = await this.usersService.findByEmail(normalized);
    if (!user || (user as any).isBlocked) {
      return { ok: true };
    }

    const resetId = randomUUID();
    const resetToken = this.jwt.sign(
      { type: "password_reset", sub: user._id.toString(), resetId },
      { expiresIn: `${this.getPasswordResetTtlSeconds()}s` },
    );

    const resetHash = await hashPassword(resetToken);
    await this.redisService.set(
      `pwdreset:${user._id.toString()}:${resetId}`,
      resetHash,
      this.getPasswordResetTtlSeconds(),
    );

    const frontendUrl = this.config.get<string>("app.frontendUrl");
    const url = new URL(this.getPasswordResetPath(), frontendUrl ?? "http://localhost");
    url.searchParams.set("token", resetToken);
    const safeNext = this.sanitizeRelativePath(nextPath);
    if (safeNext) {
      url.searchParams.set("next", safeNext);
    }
    const resetUrl = frontendUrl ? url.toString() : `${url.pathname}${url.search}`;

    try {
      await this.passwordResetDelivery.sendResetLink(normalized, resetUrl);
    } catch {
    }

    if (this.shouldReturnPasswordResetLink()) {
      return { ok: true, resetUrl };
    }

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: { type?: string; sub?: string; resetId?: string };
    try {
      payload = this.jwt.verify(token) as { type?: string; sub?: string; resetId?: string };
    } catch {
      throw new UnauthorizedException({
        message: "Invalid reset token",
        errorCode: "AUTH_RESET_TOKEN_INVALID",
      });
    }

    if (payload.type !== "password_reset" || !payload.sub || !payload.resetId) {
      throw new UnauthorizedException({
        message: "Invalid reset token",
        errorCode: "AUTH_RESET_TOKEN_INVALID",
      });
    }

    const key = `pwdreset:${payload.sub}:${payload.resetId}`;
    const storedHash = await this.redisService.get(key);
    if (!storedHash) {
      throw new UnauthorizedException({
        message: "Reset token expired",
        errorCode: "AUTH_RESET_TOKEN_EXPIRED",
      });
    }

    const valid = await comparePassword(token, storedHash);
    if (!valid) {
      throw new UnauthorizedException({
        message: "Invalid reset token",
        errorCode: "AUTH_RESET_TOKEN_INVALID",
      });
    }

    let user: UserDocument;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException({
        message: "Invalid reset token",
        errorCode: "AUTH_RESET_TOKEN_INVALID",
      });
    }
    if ((user as any).isBlocked) {
      throw new UnauthorizedException({
        message: "User blocked",
        errorCode: "AUTH_USER_BLOCKED",
      });
    }

    await this.usersService.setPasswordByUserId(payload.sub, newPassword);
    await this.redisService.del(key);
    await this.redisService.deleteByPattern(`refresh:${payload.sub}:*`);
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
