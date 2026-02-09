// src/modules/users/users.module.ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { User, UserSchema } from "./schemas/user.schema";
import { ClientProfile, ClientProfileSchema } from "./schemas/client-profile.schema";
import { ClientProfilesService } from "./client-profiles.service";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
    ]),
    UploadsModule,
  ],
  providers: [UsersService, ClientProfilesService],
  controllers: [UsersController],
  exports: [UsersService, ClientProfilesService],
})
export class UsersModule {}
