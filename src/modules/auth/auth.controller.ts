// src/modules/auth/auth.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  private setRefreshCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Post("register")
  @ApiOperation({ summary: "Register new user (client/provider)" })
  @ApiResponse({ status: 201 })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken, expiresIn } =
      await this.authService.register(dto);

    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken, expiresIn };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login" })
  @ApiResponse({ status: 200 })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken, expiresIn } =
      await this.authService.login(dto.email, dto.password);

    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken, expiresIn };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token (uses refreshToken cookie)" })
  @ApiResponse({ status: 200 })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as any).cookies?.refreshToken as
      | string
      | undefined;

    const {
      accessToken,
      refreshToken: newRefresh,
      expiresIn,
    } = await this.authService.refresh(refreshToken);

    this.setRefreshCookie(res, newRefresh);
    return { accessToken, expiresIn };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout (invalidate refresh session)" })
  @ApiResponse({ status: 200 })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req as any).cookies?.refreshToken as
      | string
      | undefined;
    await this.authService.logout(refreshToken);

    res.clearCookie("refreshToken", { path: "/auth" });
    return { ok: true };
  }
}
