import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

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
  @Matches(/[A-ZА-ЯЁ]/, { message: "newPassword must contain at least one uppercase letter" })
  @Matches(/[a-zа-яё]/, { message: "newPassword must contain at least one lowercase letter" })
  @Matches(/\d/, { message: "newPassword must contain at least one digit" })
  @Matches(/[^A-Za-zА-Яа-яЁё0-9]/, { message: "newPassword must contain at least one symbol" })
  newPassword: string;
}
