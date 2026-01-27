// src/common/filters/global-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import type { RequestWithId } from "../middleware/request-id.middleware";

type HttpExceptionResponse =
  | string
  | {
      statusCode?: number;
      message?: string | string[];
      error?: string;
    };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly isDev = process.env.NODE_ENV !== "production") {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithId>();

    const timestamp = new Date().toISOString();
    const path = String(req.originalUrl || req.url || "");
    const requestId = req.requestId;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal Server Error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse() as HttpExceptionResponse;

      if (typeof response === "string") {
        message = response;
        error = exception.name;
      } else {
        message =
          response.message ??
          (typeof exception.message === "string" ? exception.message : "Error");
        error = response.error ?? exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      error = exception.name || error;
    }

    const body: Record<string, unknown> = {
      statusCode,
      message,
      error,
      timestamp,
      path,
      ...(requestId ? { requestId } : {}),
    };

    if (this.isDev && exception instanceof Error && exception.stack) {
      body.stack = exception.stack;
    }

    res.status(statusCode).json(body);
  }
}

