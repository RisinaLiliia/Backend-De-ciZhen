import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ForgotPasswordResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiPropertyOptional({
    example: "https://frontend.example.com/auth/reset-password?token=...",
    description:
      "Reset link is returned only when PASSWORD_RESET_RETURN_LINK=true.",
  })
  resetUrl?: string;
}

