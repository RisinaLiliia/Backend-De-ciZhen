// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { JwtPayload } from "../auth.types";
import { UsersService } from "../../users/users.service";
import { PresenceService } from "../../presence/presence.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly presence: PresenceService,
  ) {
    const secret = config.get<string>("app.jwtSecret");
    if (!secret) throw new Error("JWT secret is not configured");

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.sub;
    if (userId) {
      await Promise.all([
        this.users.touchLastSeen(userId),
        this.presence.markOnline(userId),
      ]);
    }
    return {
      userId,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  }
}
