// src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({ example: "Password1" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
