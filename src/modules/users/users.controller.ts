// src/modules/users/users.controller.ts
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UpdateMeDto } from "./dto/update-me.dto";
import type { AppRole } from "./schemas/user.schema";

type CurrentUserPayload = {
  userId: string;
  role: AppRole;
  sessionId?: string;
};

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private toMeResponse(u: any) {
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
  async me(@CurrentUser() user: CurrentUserPayload) {
    const u = await this.usersService.findById(user.userId);
    return this.toMeResponse(u);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Update current user profile (me)" })
  async updateMe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateMeDto,
  ) {
    const updated = await this.usersService.updateMe(user.userId, dto);
    return this.toMeResponse(updated);
  }
}
