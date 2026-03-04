// src/app.controller.ts
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { SkipThrottle } from "@nestjs/throttler";
import type { Connection } from "mongoose";
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPublicErrors } from "./common/swagger/api-errors.decorator";
import { RedisService } from "./infra/redis.service";
import { AppService } from "./app.service";

@ApiTags("system")
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redis: RedisService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: "Root endpoint" })
  @ApiSecurity({} as any)
  @ApiOkResponse({ schema: { type: "string", example: "Hello World!" } })
  @ApiPublicErrors()
  getHello(): string {
    return this.appService.getHello();
  }

  @SkipThrottle()
  @Get("health")
  @ApiOperation({ summary: "Health check" })
  @ApiSecurity({} as any)
  @ApiOkResponse({ schema: { type: "object", example: { ok: true } } })
  @ApiPublicErrors()
  health() {
    return { ok: true };
  }

  @SkipThrottle()
  @Get("health/live")
  @ApiOperation({ summary: "Liveness probe" })
  @ApiSecurity({} as any)
  @ApiOkResponse({ schema: { type: "object", example: { ok: true, status: "live" } } })
  @ApiPublicErrors()
  healthLive() {
    return {
      ok: true,
      status: "live",
      uptimeSec: Math.floor(process.uptime()),
    };
  }

  @SkipThrottle()
  @Get("health/ready")
  @ApiOperation({ summary: "Readiness probe (Mongo + Redis status)" })
  @ApiSecurity({} as any)
  @ApiOkResponse({
    schema: {
      type: "object",
      example: {
        ok: true,
        status: "degraded",
        mongo: { ready: true },
        redis: { mode: "memory", connected: false, degraded: true },
      },
    },
  })
  @ApiPublicErrors()
  async healthReady() {
    const mongoReady = this.mongo.readyState === 1;
    const redis = await this.redis.getHealthStatus();
    const status = mongoReady ? (redis.degraded ? "degraded" : "ok") : "down";

    if (!mongoReady) {
      throw new ServiceUnavailableException({
        ok: false,
        status,
        mongo: { ready: false },
        redis,
      });
    }

    return {
      ok: true,
      status,
      mongo: { ready: true },
      redis,
    };
  }
}
