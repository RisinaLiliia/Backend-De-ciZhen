// src/common/middleware/request-logging.middleware.ts
import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import type { RequestWithId } from "./request-id.middleware";

type RequestLogPayload = {
  event: "http_request";
  requestId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  contentLength: number | null;
  userAgent: string | null;
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HttpRequest");

  use(req: RequestWithId, res: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const endedAt = process.hrtime.bigint();
      const durationMs = Number((endedAt - startedAt) / BigInt(1_000_000));
      const statusCode = Number(res.statusCode || 0);
      const requestId = req.requestId ?? null;
      const path = String(req.originalUrl || req.url || "").split("?")[0] || "/";
      const contentLengthHeader = res.getHeader("content-length");
      const contentLength =
        typeof contentLengthHeader === "string"
          ? Number.parseInt(contentLengthHeader, 10)
          : typeof contentLengthHeader === "number"
            ? contentLengthHeader
            : null;

      const payload: RequestLogPayload = {
        event: "http_request",
        requestId,
        method: String(req.method || "GET"),
        path,
        statusCode,
        durationMs,
        contentLength: Number.isFinite(contentLength as number) ? (contentLength as number) : null,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      };

      const line = JSON.stringify(payload);
      if (statusCode >= 500) {
        this.logger.error(line);
        return;
      }
      if (statusCode >= 400 || durationMs >= 1_500) {
        this.logger.warn(line);
        return;
      }
      this.logger.log(line);
    });

    next();
  }
}
