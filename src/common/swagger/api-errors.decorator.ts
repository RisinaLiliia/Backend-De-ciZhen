// src/common/swagger/api-errors.decorator.ts
import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
} from "@nestjs/swagger";
import { HttpErrorDto } from "../dto/http-error.dto";

type ErrorOpts = {
  badRequest?: boolean;
  unauthorized?: boolean;
  forbidden?: boolean;
  notFound?: boolean;
  conflict?: boolean;
  tooManyRequests?: boolean;
  internal?: boolean;
};

const defaults: Required<ErrorOpts> = {
  badRequest: true,
  unauthorized: true,
  forbidden: true,
  notFound: true,
  conflict: true,
  tooManyRequests: true,
  internal: true,
};

export function ApiErrors(opts?: ErrorOpts) {
  const o = { ...defaults, ...(opts ?? {}) };

  const decorators = [
    ApiExtraModels(HttpErrorDto),

    o.badRequest &&
      ApiBadRequestResponse({
        description: "Bad Request / Validation error",
        type: HttpErrorDto,
      }),

    o.unauthorized &&
      ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: HttpErrorDto,
      }),

    o.forbidden &&
      ApiForbiddenResponse({
        description: "Forbidden",
        type: HttpErrorDto,
      }),

    o.notFound &&
      ApiNotFoundResponse({
        description: "Not Found",
        type: HttpErrorDto,
      }),

    o.conflict &&
      ApiConflictResponse({
        description: "Conflict",
        type: HttpErrorDto,
      }),

    o.tooManyRequests &&
      ApiTooManyRequestsResponse({
        description: "Too Many Requests",
        type: HttpErrorDto,
      }),

    o.internal &&
      ApiInternalServerErrorResponse({
        description: "Internal Server Error",
        type: HttpErrorDto,
      }),
  ].filter(Boolean);

  return applyDecorators(...(decorators as any[]));
}

export function ApiAuthErrors() {
  return ApiErrors({ notFound: false, conflict: false });
}

export function ApiMeErrors() {
  return ApiErrors({ conflict: false });
}

export function ApiPublicErrors() {
  return ApiErrors({ unauthorized: false, forbidden: false, notFound: false });
}
