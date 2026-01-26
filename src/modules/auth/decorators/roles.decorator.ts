// src/modules/auth/decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";
import type { AppRole } from "../auth.types";

export const ROLES_KEY = "roles";
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
