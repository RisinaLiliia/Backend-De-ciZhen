import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({
    required: false,
    example: "/orders?tab=my-requests",
    description: "Optional relative path to preserve post-reset navigation context.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/[^\s]*$/, {
    message: "nextPath must be a relative path starting with '/'",
  })
  nextPath?: string;
}
