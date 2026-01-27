// src/common/filters/global-exception.filter.ts
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type HttpExceptionResponse =
  | string
  | {
      statusCode?: number;
      message?: string | string[];
      error?: string;
      [key: string]: unknown;
    };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = req.originalUrl || req.url;
    const method = req.method;

    // defaults
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const response = exception.getResponse() as HttpExceptionResponse;

      if (typeof response === 'string') {
        message = response;
        error = exception.name;
      } else if (response && typeof response === 'object') {
        // Nest usually provides { statusCode, message, error }
        message = response.message ?? exception.message ?? 'Error';
        error = (response.error as string) ?? exception.name;
      } else {
        message = exception.message || 'Error';
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message || 'Internal Server Error';
      error = exception.name || 'Error';
    }

    res.status(statusCode).json({
      statusCode,
      error,
      message,
      path,
      method,
      timestamp,
    });
  }
}
