// src/modules/auth/auth.controller.spec.ts
import { Test } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ConfigService } from "@nestjs/config";

describe("AuthController (unit)", () => {
  let controller: AuthController;

  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn((key: string): string | undefined => {
      if (key === "app.nodeEnv") return "development";
      return undefined;
    }),
  };

  const makeRes = () => {
    const res: any = {};
    res.cookie = jest.fn();
    res.clearCookie = jest.fn();
    return res;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  describe("register", () => {
    it("calls AuthService.register and sets refresh cookie", async () => {
      const res = makeRes();

      authServiceMock.register.mockResolvedValue({
        user: { id: "u1", email: "a@b.com", name: "A", role: "client" },
        accessToken: "ACCESS",
        refreshToken: "REFRESH",
        expiresIn: 900,
      });

      const dto: any = {
        name: "A",
        email: "a@b.com",
        password: "Password1",
        acceptPrivacyPolicy: true,
        role: "client",
      };

      const result = await controller.register(dto, res);

      expect(authServiceMock.register).toHaveBeenCalledWith(dto);

      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "REFRESH",
        expect.objectContaining({
          httpOnly: true,
          path: "/auth",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );

      expect(result).toEqual({
        user: { id: "u1", email: "a@b.com", name: "A", role: "client" },
        accessToken: "ACCESS",
        expiresIn: 900,
      });
    });
  });

  describe("login", () => {
    it("calls AuthService.login and sets refresh cookie", async () => {
      const res = makeRes();

      authServiceMock.login.mockResolvedValue({
        user: { id: "u1", email: "a@b.com", name: "A", role: "client" },
        accessToken: "ACCESS",
        refreshToken: "REFRESH",
        expiresIn: 900,
      });

      const dto: any = { email: "a@b.com", password: "Password1" };

      const result = await controller.login(dto, res);

      expect(authServiceMock.login).toHaveBeenCalledWith("a@b.com", "Password1");

      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "REFRESH",
        expect.objectContaining({
          httpOnly: true,
          path: "/auth",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );

      expect(result).toEqual({
        user: { id: "u1", email: "a@b.com", name: "A", role: "client" },
        accessToken: "ACCESS",
        expiresIn: 900,
      });
    });
  });

  describe("refresh", () => {
    it("reads refreshToken from cookies, calls AuthService.refresh and sets new refresh cookie", async () => {
      const res = makeRes();
      const req: any = { cookies: { refreshToken: "OLD_REFRESH" } };

      authServiceMock.refresh.mockResolvedValue({
        accessToken: "NEW_ACCESS",
        refreshToken: "NEW_REFRESH",
        expiresIn: 900,
      });

      const result = await controller.refresh(req, res);

      expect(authServiceMock.refresh).toHaveBeenCalledWith("OLD_REFRESH");

      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "NEW_REFRESH",
        expect.objectContaining({
          httpOnly: true,
          path: "/auth",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );

      expect(result).toEqual({ accessToken: "NEW_ACCESS", expiresIn: 900 });
    });

    it("passes undefined to AuthService.refresh if no cookie", async () => {
      const res = makeRes();
      const req: any = { cookies: {} };

      authServiceMock.refresh.mockResolvedValue({
        accessToken: "NEW_ACCESS",
        refreshToken: "NEW_REFRESH",
        expiresIn: 900,
      });

      await controller.refresh(req, res);

      expect(authServiceMock.refresh).toHaveBeenCalledWith(undefined);
    });
  });

  describe("logout", () => {
    it("reads refreshToken from cookies, calls AuthService.logout and clears cookie", async () => {
      const res = makeRes();
      const req: any = { cookies: { refreshToken: "REFRESH" } };

      authServiceMock.logout.mockResolvedValue(undefined);

      const result = await controller.logout(req, res);

      expect(authServiceMock.logout).toHaveBeenCalledWith("REFRESH");
      expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
        path: "/auth",
      });
      expect(result).toEqual({ ok: true });
    });

    it("calls AuthService.logout with undefined if no cookie", async () => {
      const res = makeRes();
      const req: any = { cookies: {} };

      authServiceMock.logout.mockResolvedValue(undefined);

      await controller.logout(req, res);

      expect(authServiceMock.logout).toHaveBeenCalledWith(undefined);
      expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
        path: "/auth",
      });
    });
  });

  describe("cookie flags", () => {
    it("sets secure=false and sameSite=lax in development", async () => {
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === "app.nodeEnv") return "development";
        return undefined;
      });

      const res = makeRes();
      authServiceMock.login.mockResolvedValue({
        user: { id: "u1", email: "a@b.com", name: "A", role: "client" },
        accessToken: "ACCESS",
        refreshToken: "REFRESH",
        expiresIn: 900,
      });

      await controller.login({ email: "a@b.com", password: "Password1" } as any, res);

      const cookieOptions = (res.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.secure).toBe(false);
      expect(cookieOptions.sameSite).toBe("lax");
    });

    it("sets secure=true and sameSite=none in production", async () => {
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === "app.nodeEnv") return "production";
        return undefined;
      });

      const res = makeRes();
      authServiceMock.login.mockResolvedValue({
        user: { id: "u1", email: "a@b.com", name: "A", role: "client" },
        accessToken: "ACCESS",
        refreshToken: "REFRESH",
        expiresIn: 900,
      });

      await controller.login({ email: "a@b.com", password: "Password1" } as any, res);

      const cookieOptions = (res.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.secure).toBe(true);
      expect(cookieOptions.sameSite).toBe("none");
    });
  });
});
