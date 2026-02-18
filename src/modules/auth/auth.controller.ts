// src/modules/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createPublicKey, createVerify } from "crypto";
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
import { OauthCompleteRegisterDto } from "./dto/oauth-complete-register.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { LogoutResponseDto } from "./dto/logout-response.dto";
import { ApiErrors, ApiAuthErrors, ApiPublicErrors } from "../../common/swagger/api-errors.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  private static readonly REFRESH_COOKIE_PATH = "/";
  private appleJwksCache:
    | {
        expiresAt: number;
        keys: Array<{ kid: string; kty: string; use?: string; alg?: string } & JsonWebKey>;
      }
    | null = null;

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
      path: AuthController.REFRESH_COOKIE_PATH,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private getFrontendBaseUrl(): string | null {
    return this.config.get<string>("app.frontendUrl") ?? null;
  }

  private buildFrontendRedirect(nextPath: string, errorCode?: string): string {
    const safeNext = nextPath.startsWith("/") ? nextPath : "/orders?tab=my-requests";
    const base = this.getFrontendBaseUrl();

    if (!errorCode) {
      return base ? new URL(safeNext, base).toString() : safeNext;
    }

    const url = new URL(
      safeNext.startsWith("/auth/") ? safeNext : `/auth/login?next=${encodeURIComponent(safeNext)}`,
      base ?? "http://localhost",
    );
    url.searchParams.set("error", errorCode);
    return base ? url.toString() : `${url.pathname}${url.search}`;
  }

  private buildOauthConsentRedirect(nextPath: string, signupToken: string): string {
    const base = this.getFrontendBaseUrl();
    const url = new URL("/auth/register", base ?? "http://localhost");
    url.searchParams.set("next", nextPath);
    url.searchParams.set("error", "oauth_consent_required");
    url.searchParams.set("signupToken", signupToken);
    return base ? url.toString() : `${url.pathname}${url.search}`;
  }

  private buildGoogleAuthUrl(nextPath: string): string {
    const clientId = this.config.get<string>("app.googleOauthClientId");
    const redirectUri = this.config.get<string>("app.googleOauthRedirectUri");
    if (!clientId || !redirectUri) {
      throw new ServiceUnavailableException({
        message: "Google OAuth is not configured",
        errorCode: "AUTH_GOOGLE_OAUTH_NOT_CONFIGURED",
      });
    }

    const state = this.authService.createOauthState("google", nextPath);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  private buildAppleAuthUrl(nextPath: string): string {
    const clientId = this.config.get<string>("app.appleOauthClientId");
    const redirectUri = this.config.get<string>("app.appleOauthRedirectUri");
    if (!clientId || !redirectUri) {
      throw new ServiceUnavailableException({
        message: "Apple OAuth is not configured",
        errorCode: "AUTH_APPLE_OAUTH_NOT_CONFIGURED",
      });
    }

    const state = this.authService.createOauthState("apple", nextPath);
    const url = new URL("https://appleid.apple.com/auth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", "name email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  private async exchangeGoogleCode(code: string): Promise<{ email: string; name?: string }> {
    const clientId = this.config.get<string>("app.googleOauthClientId");
    const clientSecret = this.config.get<string>("app.googleOauthClientSecret");
    const redirectUri = this.config.get<string>("app.googleOauthRedirectUri");
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException({
        message: "Google OAuth is not configured",
        errorCode: "AUTH_GOOGLE_OAUTH_NOT_CONFIGURED",
      });
    }

    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException({
        message: "Google OAuth token exchange failed",
        errorCode: "AUTH_GOOGLE_TOKEN_EXCHANGE_FAILED",
      });
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new UnauthorizedException({
        message: "Google access token is missing",
        errorCode: "AUTH_GOOGLE_ACCESS_TOKEN_MISSING",
      });
    }

    const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userRes.ok) {
      throw new UnauthorizedException({
        message: "Google profile fetch failed",
        errorCode: "AUTH_GOOGLE_PROFILE_FETCH_FAILED",
      });
    }
    const profile = (await userRes.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!profile.email || !profile.email_verified) {
      throw new UnauthorizedException({
        message: "Google account email is missing or not verified",
        errorCode: "AUTH_GOOGLE_EMAIL_NOT_VERIFIED",
      });
    }
    return { email: profile.email, name: profile.name };
  }

  private async exchangeAppleCode(code: string): Promise<{ email: string; name?: string }> {
    const clientId = this.config.get<string>("app.appleOauthClientId");
    const clientSecret = this.config.get<string>("app.appleOauthClientSecret");
    const redirectUri = this.config.get<string>("app.appleOauthRedirectUri");
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException({
        message: "Apple OAuth is not configured",
        errorCode: "AUTH_APPLE_OAUTH_NOT_CONFIGURED",
      });
    }

    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException({
        message: "Apple OAuth token exchange failed",
        errorCode: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
      });
    }

    const tokenJson = (await tokenRes.json()) as { id_token?: string };
    if (!tokenJson.id_token) {
      throw new UnauthorizedException({
        message: "Apple id_token is missing",
        errorCode: "AUTH_APPLE_ID_TOKEN_MISSING",
      });
    }
    const payload = await this.verifyAppleIdToken(tokenJson.id_token, clientId);
    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";
    if (!payload.email || !emailVerified) {
      throw new UnauthorizedException({
        message: "Apple account email is missing or not verified",
        errorCode: "AUTH_APPLE_EMAIL_NOT_VERIFIED",
      });
    }
    return { email: payload.email };
  }

  private async getAppleJwks(): Promise<Array<{ kid: string; kty: string; use?: string; alg?: string } & JsonWebKey>> {
    const now = Date.now();
    if (this.appleJwksCache && this.appleJwksCache.expiresAt > now) {
      return this.appleJwksCache.keys;
    }

    const res = await fetch("https://appleid.apple.com/auth/keys");
    if (!res.ok) {
      throw new UnauthorizedException({
        message: "Apple JWKS fetch failed",
        errorCode: "AUTH_APPLE_JWKS_FETCH_FAILED",
      });
    }
    const data = (await res.json()) as {
      keys?: Array<{ kid: string; kty: string; use?: string; alg?: string } & JsonWebKey>;
    };
    const keys = Array.isArray(data.keys) ? data.keys : [];
    this.appleJwksCache = {
      keys,
      expiresAt: now + 15 * 60 * 1000,
    };
    return keys;
  }

  private async verifyAppleIdToken(
    idToken: string,
    expectedAudience: string,
  ): Promise<{ email?: string; email_verified?: boolean | string }> {
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException({
        message: "Apple id_token is invalid",
        errorCode: "AUTH_APPLE_ID_TOKEN_INVALID",
      });
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    let header: { kid?: string; alg?: string };
    let payload: {
      iss?: string;
      aud?: string | string[];
      exp?: number;
      email?: string;
      email_verified?: boolean | string;
    };
    try {
      header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
      payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException({
        message: "Apple id_token is invalid",
        errorCode: "AUTH_APPLE_ID_TOKEN_INVALID",
      });
    }

    if (header.alg !== "RS256" || !header.kid) {
      throw new UnauthorizedException({
        message: "Apple id_token header is invalid",
        errorCode: "AUTH_APPLE_ID_TOKEN_INVALID",
      });
    }

    const keys = await this.getAppleJwks();
    const jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
    if (!jwk) {
      throw new UnauthorizedException({
        message: "Apple signing key not found",
        errorCode: "AUTH_APPLE_SIGNING_KEY_NOT_FOUND",
      });
    }

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const publicKey = createPublicKey({ key: jwk as any, format: "jwk" });
    const signature = Buffer.from(signatureB64, "base64url");
    const validSignature = verifier.verify(publicKey, signature);
    if (!validSignature) {
      throw new UnauthorizedException({
        message: "Apple id_token signature is invalid",
        errorCode: "AUTH_APPLE_ID_TOKEN_SIGNATURE_INVALID",
      });
    }

    if (payload.iss !== "https://appleid.apple.com") {
      throw new UnauthorizedException({
        message: "Apple token issuer is invalid",
        errorCode: "AUTH_APPLE_ISSUER_INVALID",
      });
    }

    const audOk = Array.isArray(payload.aud)
      ? payload.aud.includes(expectedAudience)
      : payload.aud === expectedAudience;
    if (!audOk) {
      throw new UnauthorizedException({
        message: "Apple token audience is invalid",
        errorCode: "AUTH_APPLE_AUDIENCE_INVALID",
      });
    }

    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException({
        message: "Apple token is expired",
        errorCode: "AUTH_APPLE_TOKEN_EXPIRED",
      });
    }

    return { email: payload.email, email_verified: payload.email_verified };
  }

  @Get("oauth/google/start")
  @ApiOperation({ summary: "Start Google OAuth login/register flow" })
  async googleOauthStart(
    @Query("next") nextPath: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const safeNext = nextPath?.startsWith("/") ? nextPath : "/orders?tab=my-requests";
    res.redirect(this.buildGoogleAuthUrl(safeNext));
  }

  @Get("oauth/google/callback")
  @ApiOperation({ summary: "Google OAuth callback" })
  async googleOauthCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    let nextPath = "/orders?tab=my-requests";
    try {
      if (!code || !state) {
        throw new UnauthorizedException({
          message: "Google OAuth callback params are missing",
          errorCode: "AUTH_GOOGLE_CALLBACK_PARAMS_MISSING",
        });
      }
      nextPath = this.authService.consumeOauthState(state, "google");
      const profile = await this.exchangeGoogleCode(code);
      const result = await this.authService.resolveSocialAuth({
        provider: "google",
        email: profile.email,
        name: profile.name,
      });
      if (result.kind === "consent_required") {
        res.redirect(this.buildOauthConsentRedirect(nextPath, result.signupToken));
        return;
      }
      this.setRefreshCookie(res, result.tokens.refreshToken);
      res.redirect(this.buildFrontendRedirect(`${nextPath}${nextPath.includes("?") ? "&" : "?"}oauth=ok`));
      return;
    } catch (error) {
      const status = error instanceof ServiceUnavailableException ? "oauth_unavailable" : "oauth_failed";
      res.redirect(this.buildFrontendRedirect(nextPath, status));
    }
  }

  @Get("oauth/apple/start")
  @ApiOperation({ summary: "Start Apple OAuth login/register flow" })
  async appleOauthStart(
    @Query("next") nextPath: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const safeNext = nextPath?.startsWith("/") ? nextPath : "/orders?tab=my-requests";
    res.redirect(this.buildAppleAuthUrl(safeNext));
  }

  @Get("oauth/apple/callback")
  @ApiOperation({ summary: "Apple OAuth callback" })
  async appleOauthCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    let nextPath = "/orders?tab=my-requests";
    try {
      if (!code || !state) {
        throw new UnauthorizedException({
          message: "Apple OAuth callback params are missing",
          errorCode: "AUTH_APPLE_CALLBACK_PARAMS_MISSING",
        });
      }
      nextPath = this.authService.consumeOauthState(state, "apple");
      const profile = await this.exchangeAppleCode(code);
      const result = await this.authService.resolveSocialAuth({
        provider: "apple",
        email: profile.email,
        name: profile.name,
      });
      if (result.kind === "consent_required") {
        res.redirect(this.buildOauthConsentRedirect(nextPath, result.signupToken));
        return;
      }
      this.setRefreshCookie(res, result.tokens.refreshToken);
      res.redirect(this.buildFrontendRedirect(`${nextPath}${nextPath.includes("?") ? "&" : "?"}oauth=ok`));
      return;
    } catch (error) {
      const status = error instanceof ServiceUnavailableException ? "oauth_unavailable" : "oauth_failed";
      res.redirect(this.buildFrontendRedirect(nextPath, status));
    }
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

  @Post("oauth/complete-register")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete OAuth registration after explicit consent" })
  @ApiOkResponse({
    description: "OAuth registration completed. Refresh token is set in httpOnly cookie.",
    type: AuthResponseDto,
  })
  @ApiPublicErrors()
  async completeOauthRegister(
    @Body() dto: OauthCompleteRegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, accessToken, refreshToken, expiresIn } =
      await this.authService.completeOauthSignup(dto);

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

    res.clearCookie("refreshToken", {
      path: AuthController.REFRESH_COOKIE_PATH,
    });
    return { ok: true };
  }
}
