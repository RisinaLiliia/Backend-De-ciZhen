// src/common/dto/http-error.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class HttpErrorDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({
    oneOf: [
      { type: "string", example: "Unauthorized" },
      {
        type: "array",
        items: { type: "string" },
        example: ["email must be an email"],
      },
    ],
  })
  message: string | string[];

  @ApiProperty({ example: "Unauthorized" })
  error: string;

  @ApiProperty({ example: "2026-01-27T10:20:30.123Z" })
  timestamp: string;

  @ApiProperty({ example: "/auth/login" })
  path: string;

  @ApiPropertyOptional({
    example: "a9f7c8f0-1b2c-4d5e-9f00-123456789abc",
    description: "Request correlation id (x-request-id)",
  })
  requestId?: string;

  @ApiPropertyOptional({
    required: false,
    example: "stack trace...",
    description: "Only in development",
  })
  stack?: string;
}
