// src/modules/users/users.controller.ts
import { BadRequestException, Body, Controller, Get, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UpdateMeDto } from "./dto/update-me.dto";
import type { AppRole } from "./schemas/user.schema";
import { MeResponseDto } from "./dto/me-response.dto";
import { ApiMeErrors } from "../../common/swagger/api-errors.decorator";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadsService } from "../uploads/uploads.service";
import { IMAGE_MULTER_OPTIONS } from "../uploads/multer.options";

type CurrentUserPayload = {
  userId: string;
  role: AppRole;
  sessionId?: string;
};

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploads: UploadsService,
  ) {}

  private toMeResponse(u: any): MeResponseDto {
    return {
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      city: u.city,
      language: u.language,
      phone: u.phone,
      avatar: u.avatar,

      acceptedPrivacyPolicy: u.acceptedPrivacyPolicy,
      acceptedPrivacyPolicyAt: u.acceptedPrivacyPolicyAt,

      isBlocked: u.isBlocked,
      blockedAt: u.blockedAt,

      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Get current user profile (me)" })
  @ApiOkResponse({ description: "Current user profile", type: MeResponseDto })
  @ApiMeErrors()
  async me(@CurrentUser() user: CurrentUserPayload): Promise<MeResponseDto> {
    const u = await this.usersService.findById(user.userId);
    return this.toMeResponse(u);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/avatar")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Upload avatar for current user" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description: "Avatar image upload",
    schema: {
      type: "object",
      properties: {
        avatar: { type: "string", format: "binary" },
      },
      required: ["avatar"],
    },
  })
  @ApiOkResponse({ description: "Updated current user profile", type: MeResponseDto })
  @ApiMeErrors()
  @UseInterceptors(FileInterceptor("avatar", IMAGE_MULTER_OPTIONS))
  async uploadAvatar(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MeResponseDto> {
    if (!file) throw new BadRequestException("avatar file is required");

    const uploaded = await this.uploads.uploadImage(file, {
      folder: `avatars/${user.userId}`,
      publicIdPrefix: "avatar",
      tags: ["avatar"],
    });

    const updated = await this.usersService.updateMe(user.userId, {
      avatarUrl: uploaded.url,
    });
    return this.toMeResponse(updated);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Update current user profile (me)" })
  @ApiOkResponse({
    description: "Updated current user profile",
    type: MeResponseDto,
  })
  @ApiMeErrors()
  async updateMe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateMeDto,
  ): Promise<MeResponseDto> {
    const updated = await this.usersService.updateMe(user.userId, dto);
    return this.toMeResponse(updated);
  }
}
