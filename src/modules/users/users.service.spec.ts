// src/modules/users/users.service.spec.ts
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { User } from "./schemas/user.schema";
import { ClientProfilesService } from "./client-profiles.service";

jest.mock("../../utils/password", () => ({
  hashPassword: jest.fn(async () => "HASHED_PASSWORD"),
  comparePassword: jest.fn(async () => true),
}));
import { comparePassword } from "../../utils/password";

describe("UsersService", () => {
  let service: UsersService;

  const modelMock = {
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const modelCtorMock: any = function (this: any, doc: any) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue({ _id: "u1", ...doc });
  };

  Object.assign(modelCtorMock, modelMock);

  const execWrap = (value: any) => ({
    exec: jest.fn().mockResolvedValue(value),
  });
  const clientProfilesMock = {
    getOrCreateByUserId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    modelCtorMock.findById = modelMock.findById;
    modelCtorMock.findOne = modelMock.findOne;
    modelCtorMock.findByIdAndUpdate = modelMock.findByIdAndUpdate;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: modelCtorMock },
        { provide: ClientProfilesService, useValue: clientProfilesMock },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it("findById throws NotFound if user missing", async () => {
    modelMock.findById.mockReturnValue(execWrap(null));
    await expect(service.findById("x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("create throws Conflict if email exists", async () => {
    modelMock.findOne.mockReturnValue(execWrap({ _id: "u1" }));
    await expect(
      service.create({
        name: "A",
        email: "a@b.com",
        password: "Password1",
        role: "client",
        acceptedPrivacyPolicy: true,
        acceptedPrivacyPolicyAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("create saves new user with normalized email", async () => {
    modelMock.findOne.mockReturnValue(execWrap(null));
    clientProfilesMock.getOrCreateByUserId.mockResolvedValue({ userId: "u1" });

    const res: any = await service.create({
      name: "A",
      email: "  A@B.COM ",
      password: "Password1",
      role: "client",
      acceptedPrivacyPolicy: true,
      acceptedPrivacyPolicyAt: new Date(),
      city: "Berlin",
      language: "de",
    });

    expect(res.email).toBe("a@b.com");
    expect(clientProfilesMock.getOrCreateByUserId).toHaveBeenCalled();
  });

  it("updateMe updates allowed fields and maps avatarUrl", async () => {
    modelMock.findByIdAndUpdate.mockReturnValue(
      execWrap({
        _id: { toString: () => "u1" },
        name: "New",
        email: "a@b.com",
        avatar: { url: "https://img", isDefault: false },
      }),
    );

    const updated: any = await service.updateMe("u1", {
      name: "New",
      avatarUrl: "https://img",
    });

    expect(modelMock.findByIdAndUpdate).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        name: "New",
        avatar: { url: "https://img", isDefault: false },
      }),
      { new: true },
    );

    expect(updated).toBeTruthy();
  });

  it("updateMe throws NotFound if user missing", async () => {
    modelMock.findByIdAndUpdate.mockReturnValue(execWrap(null));
    await expect(service.updateMe("u1", { name: "X" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("blockUser sets isBlocked true", async () => {
    modelMock.findByIdAndUpdate.mockReturnValue(execWrap({ _id: "u1" }));
    await expect(service.blockUser("u1")).resolves.toBeUndefined();
  });

  it("blockUser throws NotFound if user missing", async () => {
    modelMock.findByIdAndUpdate.mockReturnValue(execWrap(null));
    await expect(service.blockUser("u1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("changePassword updates hash when current password is valid", async () => {
    modelMock.findById.mockReturnValue({
      select: jest.fn().mockReturnValue(
        execWrap({ _id: "u1", passwordHash: "OLD_HASH" }),
      ),
    });
    modelMock.findByIdAndUpdate.mockReturnValue(execWrap({ _id: "u1" }));

    (comparePassword as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(
      service.changePassword("u1", "CurrentPass123!", "NewSecurePass456!"),
    ).resolves.toBeUndefined();

    expect(modelMock.findByIdAndUpdate).toHaveBeenCalledWith(
      "u1",
      { $set: { passwordHash: "HASHED_PASSWORD" } },
      { new: false },
    );
  });

  it("changePassword throws Unauthorized when current password is invalid", async () => {
    modelMock.findById.mockReturnValue({
      select: jest.fn().mockReturnValue(
        execWrap({ _id: "u1", passwordHash: "OLD_HASH" }),
      ),
    });
    (comparePassword as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      service.changePassword("u1", "WrongPass123!", "NewSecurePass456!"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("changePassword throws BadRequest when new password matches current", async () => {
    modelMock.findById.mockReturnValue({
      select: jest.fn().mockReturnValue(
        execWrap({ _id: "u1", passwordHash: "OLD_HASH" }),
      ),
    });
    (comparePassword as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      service.changePassword("u1", "CurrentPass123!", "CurrentPass123!"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
