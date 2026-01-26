// src/modules/users/dto/update-me.dto.ts
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsUrl,
} from "class-validator";

export class UpdateMeDto {
  @ApiPropertyOptional({ example: "Liliia" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: "Berlin" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: "de" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ example: "+49123456789" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+0-9\s()-]{6,30}$/, { message: "Invalid phone format" })
  phone?: string;

  @ApiPropertyOptional({ example: "https://cdn.example.com/u/1.png" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  avatarUrl?: string;
}
