import { EventEmitter } from "events";
import type { NextFunction, Response } from "express";
import { RequestLoggingMiddleware } from "./request-logging.middleware";
import type { RequestWithId } from "./request-id.middleware";

function createResponse(statusCode: number, contentLength: string | null = null): Response {
  const emitter = new EventEmitter() as Response & EventEmitter;
  (emitter as any).statusCode = statusCode;
  (emitter as any).getHeader = jest.fn((name: string) => {
    if (name.toLowerCase() === "content-length") return contentLength;
    return null;
  });
  return emitter as Response;
}

describe("RequestLoggingMiddleware", () => {
  it("logs successful requests with sanitized path and request id", () => {
    const middleware = new RequestLoggingMiddleware();
    const logger = (middleware as any).logger;
    const logSpy = jest.spyOn(logger, "log").mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => undefined);

    const req = {
      method: "GET",
      originalUrl: "/workspace/statistics?range=30d",
      headers: { "user-agent": "vitest-agent" },
      requestId: "rid-1",
    } as unknown as RequestWithId;
    const res = createResponse(200, "64");

    const next = jest.fn() as NextFunction;
    middleware.use(req, res, next);
    (res as unknown as EventEmitter).emit("finish");

    expect(next).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const line = String(logSpy.mock.calls[0]?.[0] ?? "");
    const payload = JSON.parse(line) as Record<string, unknown>;
    expect(payload.event).toBe("http_request");
    expect(payload.requestId).toBe("rid-1");
    expect(payload.path).toBe("/workspace/statistics");
    expect(payload.statusCode).toBe(200);
  });

  it("logs 4xx as warn", () => {
    const middleware = new RequestLoggingMiddleware();
    const logger = (middleware as any).logger;
    const logSpy = jest.spyOn(logger, "log").mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => undefined);

    const req = {
      method: "POST",
      originalUrl: "/auth/login",
      headers: {},
      requestId: "rid-2",
    } as unknown as RequestWithId;
    const res = createResponse(401);

    middleware.use(req, res, jest.fn() as NextFunction);
    (res as unknown as EventEmitter).emit("finish");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs 5xx as error", () => {
    const middleware = new RequestLoggingMiddleware();
    const logger = (middleware as any).logger;
    const logSpy = jest.spyOn(logger, "log").mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => undefined);

    const req = {
      method: "GET",
      originalUrl: "/workspace/private",
      headers: {},
      requestId: "rid-3",
    } as unknown as RequestWithId;
    const res = createResponse(500);

    middleware.use(req, res, jest.fn() as NextFunction);
    (res as unknown as EventEmitter).emit("finish");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
