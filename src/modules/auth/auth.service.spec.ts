// src/modules/auth/auth.service.spec.ts
import { Test } from "@nestjs/testing";
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { RedisService } from "../../infra/redis.service";
import type { UserDocument } from "../users/schemas/user.schema";

jest.mock("../../utils/password", () => ({
  hashPassword: jest.fn(async () => "HASHED_REFRESH"),
  comparePassword: jest.fn(async () => true),
}));

import { comparePassword } from "../../utils/password";

describe("AuthService", () => {
  let authService: AuthService;

  const jwtServiceMock = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const usersServiceMock = {
    create: jest.fn(),
    findAuthUserByEmail: jest.fn(),
    findById: jest.fn(),
  };

  const redisServiceMock = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const makeUser = (overrides: Partial<any> = {}): UserDocument =>
    ({
      _id: { toString: () => overrides.id ?? "userId1" },
      name: "Liliia",
      email: "liliia@test.com",
      role: overrides.role ?? "client",
      city: overrides.city ?? "Berlin",
      language: overrides.language ?? "de",
      passwordHash: overrides.passwordHash ?? "HASHED_PASSWORD",
      acceptedPrivacyPolicy: true,
      acceptedPrivacyPolicyAt: new Date(),
      avatar: { url: "/avatars/default.png", isDefault: true },
      createdAt: new Date(),
      isBlocked: overrides.isBlocked ?? false,
    }) as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe("register", () => {
    it("throws if privacy policy not accepted", async () => {
      await expect(
        authService.register({
          name: "Liliia",
          email: "liliia@test.com",
          password: "Password1",
          acceptPrivacyPolicy: false,
          role: "client",
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates user and returns tokens", async () => {
      const user = makeUser({ role: "client" });
      usersServiceMock.create.mockResolvedValue(user);

      jwtServiceMock.sign
        .mockReturnValueOnce("ACCESS_TOKEN")
        .mockReturnValueOnce("REFRESH_TOKEN");

      const res = await authService.register({
        name: "Liliia",
        email: "liliia@test.com",
        password: "Password1",
        acceptPrivacyPolicy: true,
        role: "client",
        city: "Berlin",
        language: "de",
      } as any);

      expect(usersServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Liliia",
          email: "liliia@test.com",
          password: "Password1",
          role: "client",
          acceptedPrivacyPolicy: true,
        }),
      );

      expect(jwtServiceMock.sign).toHaveBeenCalledTimes(2);
      expect(redisServiceMock.set).toHaveBeenCalledTimes(1);

      expect(res).toEqual(
        expect.objectContaining({
          accessToken: "ACCESS_TOKEN",
          refreshToken: "REFRESH_TOKEN",
          expiresIn: 900,
          user: expect.objectContaining({
            id: "userId1",
            email: "liliia@test.com",
            role: "client",
          }),
        }),
      );
    });

    it("propagates duplicate email as ConflictException", async () => {
      usersServiceMock.create.mockRejectedValue(
        new ConflictException("Email already in use"),
      );

      await expect(
        authService.register({
          name: "Liliia",
          email: "liliia@test.com",
          password: "Password1",
          acceptPrivacyPolicy: true,
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("throws Unauthorized if user not found", async () => {
      usersServiceMock.findAuthUserByEmail.mockResolvedValue(null);

      await expect(
        authService.login("no@test.com", "Password1"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws Unauthorized if user is blocked", async () => {
      usersServiceMock.findAuthUserByEmail.mockResolvedValue(
        makeUser({ isBlocked: true }),
      );

      await expect(
        authService.login("liliia@test.com", "Password1"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws Unauthorized if password mismatch", async () => {
      (comparePassword as jest.Mock).mockResolvedValueOnce(false);
      usersServiceMock.findAuthUserByEmail.mockResolvedValue(makeUser());

      await expect(
        authService.login("liliia@test.com", "wrong"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("returns tokens if credentials ok", async () => {
      (comparePassword as jest.Mock).mockResolvedValueOnce(true);
      usersServiceMock.findAuthUserByEmail.mockResolvedValue(makeUser());

      jwtServiceMock.sign
        .mockReturnValueOnce("ACCESS_TOKEN")
        .mockReturnValueOnce("REFRESH_TOKEN");

      const res = await authService.login("liliia@test.com", "Password1");

      expect(usersServiceMock.findAuthUserByEmail).toHaveBeenCalledWith(
        "liliia@test.com",
      );
      expect(res.accessToken).toBe("ACCESS_TOKEN");
      expect(res.refreshToken).toBe("REFRESH_TOKEN");
      expect(redisServiceMock.set).toHaveBeenCalledTimes(1);
    });
  });

  describe("refresh", () => {
    it("throws Unauthorized if refreshToken missing", async () => {
      await expect(authService.refresh(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws Unauthorized if jwt verify fails", async () => {
      jwtServiceMock.verify.mockImplementation(() => {
        throw new Error("bad token");
      });

      await expect(authService.refresh("BAD")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws Unauthorized if user not found during refresh", async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: "userId1",
        role: "client",
        sessionId: "sess1",
      });
      usersServiceMock.findById.mockRejectedValue(
        new NotFoundException("User not found"),
      );

      await expect(authService.refresh("REFRESH_TOKEN")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws Unauthorized if user is blocked during refresh", async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: "userId1",
        role: "client",
        sessionId: "sess1",
      });
      usersServiceMock.findById.mockResolvedValue(
        makeUser({ isBlocked: true }),
      );

      await expect(authService.refresh("REFRESH_TOKEN")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws Unauthorized if session expired in redis", async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: "userId1",
        role: "client",
        sessionId: "sess1",
      });
      usersServiceMock.findById.mockResolvedValue(makeUser());
      redisServiceMock.get.mockResolvedValue(null);

      await expect(authService.refresh("REFRESH_TOKEN")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws Unauthorized if refresh token hash mismatch", async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: "userId1",
        role: "client",
        sessionId: "sess1",
      });
      usersServiceMock.findById.mockResolvedValue(makeUser());
      redisServiceMock.get.mockResolvedValue("HASH_FROM_REDIS");
      (comparePassword as jest.Mock).mockResolvedValueOnce(false);

      await expect(authService.refresh("REFRESH_TOKEN")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rotates session (del old) and returns new tokens", async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: "userId1",
        role: "client",
        sessionId: "sess1",
      });
      usersServiceMock.findById.mockResolvedValue(makeUser());
      redisServiceMock.get.mockResolvedValue("HASH_FROM_REDIS");
      (comparePassword as jest.Mock).mockResolvedValueOnce(true);

      jwtServiceMock.sign
        .mockReturnValueOnce("NEW_ACCESS")
        .mockReturnValueOnce("NEW_REFRESH");

      const res = await authService.refresh("OLD_REFRESH");

      expect(redisServiceMock.del).toHaveBeenCalledWith(
        "refresh:userId1:sess1",
      );
      expect(redisServiceMock.set).toHaveBeenCalledTimes(1);
      expect(res).toEqual(
        expect.objectContaining({
          accessToken: "NEW_ACCESS",
          refreshToken: "NEW_REFRESH",
          expiresIn: 900,
        }),
      );
    });
  });

  describe("logout", () => {
    it("does nothing if token missing", async () => {
      await authService.logout(undefined);
      expect(redisServiceMock.del).not.toHaveBeenCalled();
    });

    it("does nothing if token invalid", async () => {
      jwtServiceMock.verify.mockImplementation(() => {
        throw new Error("bad token");
      });

      await authService.logout("BAD");
      expect(redisServiceMock.del).not.toHaveBeenCalled();
    });

    it("deletes redis session if token valid", async () => {
      jwtServiceMock.verify.mockReturnValue({
        sub: "userId1",
        role: "client",
        sessionId: "sess1",
      });

      await authService.logout("REFRESH_TOKEN");
      expect(redisServiceMock.del).toHaveBeenCalledWith(
        "refresh:userId1:sess1",
      );
    });
  });
});
