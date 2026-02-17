import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ example: "CurrentPass123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ example: "NewSecurePass456!" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

