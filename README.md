# De’ciZhen Backend API

NestJS backend for De’ciZhen marketplace/workspace.

## System Overview

De’ciZhen Backend is a modular NestJS API that powers marketplace
business logic, authentication, and workspace flows.

It handles:
- user authentication and session management
- request / offer / contract lifecycle
- role-based access control
- real-time chat and presence
- legal consent tracking

The API is designed with modular domain boundaries and production-style structure.

## Stack
- NestJS
- MongoDB (Mongoose ODM)
- Redis (session & refresh flow management)
- Swagger (`/docs`)

## Architecture Overview

The backend follows a modular domain-driven structure.

Each module encapsulates:
- controller
- service
- schema (Mongoose)
- DTO validation layer

Cross-cutting concerns (auth, guards, consent tracking, sessions)
are isolated from domain logic.
Validation is handled via DTOs and class-validator.

Redis is used for session and refresh flow management.
MongoDB handles primary data storage.

## Core Modules
Domain modules are organized by business responsibility:
- `auth` (email/password auth, OAuth Google/Apple, refresh sessions)
- `users` (me/profile/avatar/password)
- `requests`, `offers`, `contracts`, `favorites`, `reviews`
- `chats`, `presence`
- `catalog`, `providers`, `geo`
- `legal` (privacy/cookies text endpoints)
- `uploads` (avatar/image upload)

## Auth & Consent Flow

Registration:
- explicit privacy consent required (`acceptPrivacyPolicy=true`)
- consent timestamp stored (`acceptedPrivacyPolicyAt`)
- consent version stored from env (`acceptedPrivacyPolicyVersion`, `PRIVACY_POLICY_VERSION`)

OAuth (Google/Apple):
1. Existing user with accepted policy -> login
2. New/social user without consent -> consent-required flow
3. Completion via `POST /auth/oauth/complete-register`

Password reset:
- Request reset via `POST /auth/forgot-password` (always returns `ok: true`)
- Complete reset via `POST /auth/reset-password` with token + new password
- Reset tokens are short-lived and validated via Redis session keys
- All active refresh sessions are invalidated after successful reset
- Reset link can be delivered via webhook-based email provider integration

## Legal Endpoints
- `GET /legal/privacy`
- `GET /legal/cookies`

Sources:
- `legal/privacy-policy.md`
- `legal/cookie-notice.md`

## Quick Start
Prerequisites:
- Node.js 18+
- MongoDB
- Redis

Install:
```bash
npm install
```

Configure env:
```bash
cp .env.example .env
```

Minimum required:
- `MONGO_URI`
- `JWT_SECRET`
- `REDIS_HOST`
- `REDIS_PORT`
- `FRONTEND_URL`

Important optional:
- `PRIVACY_POLICY_VERSION` (default `2026-02-18`)
- `PASSWORD_RESET_TTL_MINUTES` (default `30`)
- `PASSWORD_RESET_PATH` (default `/auth/reset-password`)
- `PASSWORD_RESET_RETURN_LINK` (default `false`, enable only for local/dev)
- `PASSWORD_RESET_EMAIL_MODE` (`disabled|log|webhook`)
- `PASSWORD_RESET_EMAIL_WEBHOOK_URL` (required for `webhook` mode)
- `PASSWORD_RESET_EMAIL_WEBHOOK_BEARER` (optional)
- `PASSWORD_RESET_EMAIL_FROM` (optional sender id)
- `PASSWORD_RESET_EMAIL_FROM_NAME` (optional sender name)
- `PASSWORD_RESET_EMAIL_SUBJECT` (optional subject override)
- `PASSWORD_RESET_BREVO_API_URL` (default Brevo SMTP API endpoint)
- `PASSWORD_RESET_BREVO_API_KEY` (required for `brevo` mode)
- `GOOGLE_OAUTH_*`
- `APPLE_OAUTH_*`
- `CLOUDINARY_*`

Run:
```bash
npm run start:dev
```

## API Docs
- Local/remote Swagger: `/docs`
- Static spec generation:
```bash
npm run swagger
```

## Testing
- Unit tests (Jest)
- E2E tests for auth and critical business flows

## Scripts
- `npm run start`
- `npm run start:dev`
- `npm run build`
- `npm test`
- `npm run test:e2e`
- `npm run swagger`
- `npm run seed:cities`
- `npm run seed:services`
- `npm run seed:demo`

## Security Notes
- Do not commit `.env`.
- Use strong `JWT_SECRET`.
- Keep OAuth secrets private.
- Refresh flow uses `httpOnly` cookie (`refreshToken`).
- Rotate compromised credentials immediately.

## License
See `LICENSE`.
