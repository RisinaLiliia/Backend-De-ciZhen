// src/modules/auth/guards/optional-jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any, info: any) {
    void info;
    // Optional guard must never fail the request because of auth parsing/expiry.
    return user ?? null;
  }
}
