import { Test } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { UploadsService } from "../uploads/uploads.service";

describe("UsersController (unit)", () => {
  let controller: UsersController;

  const usersServiceMock = {
    findById: jest.fn(),
    updateMe: jest.fn(),
  };

  const uploadsMock = {
    uploadImage: jest.fn(),
  };

  const makeUserDoc = (overrides: Partial<any> = {}) =>
    ({
      _id: { toString: () => overrides.id ?? "userId1" },
      name: overrides.name ?? "Liliia",
      email: overrides.email ?? "liliia@test.com",
      role: overrides.role ?? "client",
      city: overrides.city ?? "Berlin",
      language: overrides.language ?? "de",
      phone: overrides.phone ?? "+49123456789",
      avatar: overrides.avatar ?? {
        url: "/avatars/default.png",
        isDefault: true,
      },
      acceptedPrivacyPolicy: overrides.acceptedPrivacyPolicy ?? true,
      acceptedPrivacyPolicyAt:
        overrides.acceptedPrivacyPolicyAt ?? new Date("2025-01-01"),
      isBlocked: overrides.isBlocked ?? false,
      blockedAt: overrides.blockedAt ?? null,
      createdAt: overrides.createdAt ?? new Date("2025-01-01"),
      updatedAt: overrides.updatedAt ?? new Date("2025-01-02"),
    }) as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersServiceMock },
        { provide: UploadsService, useValue: uploadsMock },
      ],
    }).compile();

    controller = moduleRef.get(UsersController);
  });

  describe("me", () => {
    it("calls UsersService.findById and returns mapped user", async () => {
      usersServiceMock.findById.mockResolvedValue(makeUserDoc());

      const result = await controller.me({
        userId: "userId1",
        role: "client",
      } as any);

      expect(usersServiceMock.findById).toHaveBeenCalledWith("userId1");
      expect(result).toEqual(
        expect.objectContaining({
          id: "userId1",
          name: "Liliia",
          email: "liliia@test.com",
          role: "client",
          city: "Berlin",
          language: "de",
          phone: "+49123456789",
          avatar: { url: "/avatars/default.png", isDefault: true },
          acceptedPrivacyPolicy: true,
          isBlocked: false,
        }),
      );
    });

    it("maps id using _id.toString()", async () => {
      usersServiceMock.findById.mockResolvedValue(
        makeUserDoc({ id: "abc123" }),
      );

      const result = await controller.me({
        userId: "abc123",
        role: "client",
      } as any);

      expect(result.id).toBe("abc123");
    });
  });

  describe("updateMe", () => {
    it("calls UsersService.updateMe with dto and returns mapped user", async () => {
      usersServiceMock.updateMe.mockResolvedValue(
        makeUserDoc({
          name: "New Name",
          city: "Hamburg",
          language: "de",
          avatar: { url: "https://cdn.example.com/u/1.png", isDefault: false },
        }),
      );

      const dto: any = {
        name: "New Name",
        city: "Hamburg",
        language: "de",
        avatarUrl: "https://cdn.example.com/u/1.png",
      };

      const result = await controller.updateMe(
        { userId: "userId1", role: "client" } as any,
        dto,
      );

      expect(usersServiceMock.updateMe).toHaveBeenCalledWith("userId1", dto);

      expect(result).toEqual(
        expect.objectContaining({
          id: "userId1",
          name: "New Name",
          city: "Hamburg",
          language: "de",
          avatar: { url: "https://cdn.example.com/u/1.png", isDefault: false },
        }),
      );
    });
  });

  describe("uploadAvatar", () => {
    it("uploads avatar and updates user profile", async () => {
      uploadsMock.uploadImage.mockResolvedValue({
        url: "https://cdn.example.com/u/1.png",
      });
      usersServiceMock.updateMe.mockResolvedValue(
        makeUserDoc({
          avatar: { url: "https://cdn.example.com/u/1.png", isDefault: false },
        }),
      );

      const res = await controller.uploadAvatar(
        { userId: "userId1", role: "client" } as any,
        { buffer: Buffer.from("x"), mimetype: "image/png" } as any,
      );

      expect(uploadsMock.uploadImage).toHaveBeenCalled();
      expect(usersServiceMock.updateMe).toHaveBeenCalledWith("userId1", {
        avatarUrl: "https://cdn.example.com/u/1.png",
      });
      expect(res.avatar?.url).toBe("https://cdn.example.com/u/1.png");
    });
  });
});
