import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  @IsString()
  token: string;

  @ApiProperty({ example: "Password1!" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/[A-ZА-ЯЁ]/, {
    message: "password must contain at least one uppercase letter",
  })
  @Matches(/[a-zа-яё]/, {
    message: "password must contain at least one lowercase letter",
  })
  @Matches(/\d/, { message: "password must contain at least one digit" })
  @Matches(/[^A-Za-zА-Яа-яЁё0-9]/, {
    message: "password must contain at least one symbol",
  })
  password: string;
}

