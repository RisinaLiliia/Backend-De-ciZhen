// src/modules/auth/auth.types.ts
export type AppRole = "client" | "provider" | "admin";

export type JwtPayload = {
  sub: string;
  role: AppRole;
  sessionId: string;
};

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  city?: string;
  language?: string;
  createdAt?: Date;
};

export type TokenResponse = {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
