// src/modules/auth/guards/optional-jwt-auth.guard.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err) {
      throw err;
    }

    if (!user) {
      const msg = info?.message ?? '';
      if (msg && msg !== 'No auth token' && msg !== 'No authorization token was found') {
        throw new UnauthorizedException();
      }
      return null;
    }

    return user;
  }
}
