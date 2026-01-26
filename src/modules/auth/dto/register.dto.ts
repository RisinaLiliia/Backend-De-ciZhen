// src/modules/auth/dto/register.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsIn,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "Liliia", description: "Full name" })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: "liliia@example.com", description: "Email" })
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({ example: "Password1", description: "Password" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({
    example: "Berlin",
    required: false,
    description: "City (optional, can be set later)",
  })
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiProperty({
    example: "de",
    required: false,
    description: "Language code (optional)",
  })
  @IsOptional()
  @MaxLength(10)
  language?: string;

  @ApiProperty({
    example: "client",
    required: false,
    description: "Role: client or provider (admin only via backoffice)",
  })
  @IsOptional()
  @IsIn(["client", "provider"])
  role?: "client" | "provider";

  @ApiProperty({ example: true, description: "Accept privacy policy" })
  @IsBoolean()
  acceptPrivacyPolicy: boolean;
}
