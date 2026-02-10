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
import {
  ApiCreatedResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { LogoutResponseDto } from "./dto/logout-response.dto";
import { ApiErrors, ApiAuthErrors, ApiPublicErrors } from "../../common/swagger/api-errors.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    const nodeEnv = this.config.get<string>("app.nodeEnv") ?? "development";
    const isProd = nodeEnv === "production";

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
  @ApiCreatedResponse({
    description: "User registered. Refresh token is set in httpOnly cookie.",
    type: AuthResponseDto,
  })
  @ApiPublicErrors()  
  @ApiErrors({ unauthorized: false, forbidden: false, notFound: false })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, accessToken, refreshToken, expiresIn } =
      await this.authService.register(dto);

    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken, expiresIn };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login" })
  @ApiOkResponse({
    description: "Login successful. Refresh token is set in httpOnly cookie.",
    type: AuthResponseDto,
  })
  @ApiAuthErrors()
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, accessToken, refreshToken, expiresIn } =
      await this.authService.login(dto.email, dto.password);

    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken, expiresIn };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token (uses refreshToken cookie)" })
  @ApiCookieAuth("refreshToken")
  @ApiOkResponse({
    description:
      "Access token refreshed. New refresh token is rotated and set in cookie.",
    type: RefreshResponseDto,
  })
  @ApiAuthErrors()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken = (req as any).cookies?.refreshToken as
      | string
      | undefined;

    const { accessToken, refreshToken: newRefresh, expiresIn } =
      await this.authService.refresh(refreshToken);

    this.setRefreshCookie(res, newRefresh);
    return { accessToken, expiresIn };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout (invalidate refresh session)" })
  @ApiCookieAuth("refreshToken")
  @ApiOkResponse({
    description: "Refresh session invalidated. Cookie cleared.",
    type: LogoutResponseDto,
  })
  @ApiErrors({
    badRequest: false,
    unauthorized: false,
    forbidden: false,
    notFound: false,
    conflict: false,
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    const refreshToken = (req as any).cookies?.refreshToken as
      | string
      | undefined;

    await this.authService.logout(refreshToken);

    res.clearCookie("refreshToken", { path: "/auth" });
    return { ok: true };
  }
}
