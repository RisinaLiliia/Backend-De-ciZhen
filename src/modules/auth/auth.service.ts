// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { UsersService } from "../users/users.service";
import { comparePassword, hashPassword } from "../../utils/password";
import { RegisterDto } from "./dto/register.dto";
import { RedisService } from "../../infra/redis.service";
import { JwtPayload, TokenResponse, SafeUser, AppRole } from "./auth.types";
import type { UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private usersService: UsersService,
    private redisService: RedisService,
  ) {}

  async register(data: RegisterDto): Promise<TokenResponse> {
    if (!data.acceptPrivacyPolicy) {
      throw new BadRequestException("Privacy policy must be accepted");
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

    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const user = await this.usersService.findAuthUserByEmail(email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    if ((user as any).isBlocked) {
      throw new UnauthorizedException("User blocked");
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return this.generateTokens(user);
  }

  async refresh(
    refreshToken?: string,
  ): Promise<
    Pick<TokenResponse, "accessToken" | "refreshToken" | "expiresIn">
  > {
    if (!refreshToken) throw new UnauthorizedException("Missing refresh token");

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify(refreshToken) as JwtPayload;
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // ✅ make refresh resilient: map "user not found" to Unauthorized
    let user: UserDocument;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException("User not found");
    }

    if ((user as any).isBlocked) {
      throw new UnauthorizedException("User blocked");
    }

    const key = `refresh:${payload.sub}:${payload.sessionId}`;
    const redisHash = await this.redisService.get(key);
    if (!redisHash) throw new UnauthorizedException("Session expired");

    const ok = await comparePassword(refreshToken, redisHash);
    if (!ok) throw new UnauthorizedException("Invalid refresh token");

    // rotation: delete old session, create new
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
      // ignore
    }
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
