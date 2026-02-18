import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsString, MinLength } from "class-validator";

export class OauthCompleteRegisterDto {
  @ApiProperty({
    description: "Short-lived token returned by OAuth callback when consent is required",
  })
  @IsString()
  @MinLength(10)
  signupToken: string;

  @ApiProperty({ example: true, description: "Accept privacy policy" })
  @IsBoolean()
  acceptPrivacyPolicy: boolean;
}

