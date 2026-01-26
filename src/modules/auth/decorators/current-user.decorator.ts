// src/modules/auth/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: unknown }>();
    return req.user;
  },
);
