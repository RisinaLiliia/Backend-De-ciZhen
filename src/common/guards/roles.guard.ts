// src/common/guards/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: { role?: string } }>();
    const user = request.user;

    const requiredRoles = this.getRoles(ctx);
    if (!requiredRoles.length) return true;

    if (!user || !user.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Access denied");
    }

    return true;
  }

  private getRoles(ctx: ExecutionContext): string[] {
    const roles = Reflect.getMetadata("roles", ctx.getHandler()) as
      | string[]
      | undefined;
    return roles ?? [];
  }
}
