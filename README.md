# De’ciZhen Backend API

NestJS backend for De’ciZhen marketplace/workspace.

## Stack
- NestJS 10
- MongoDB + Mongoose
- Redis (sessions / refresh flow / caching)
- Swagger (`/docs`)

## Core Modules
- `auth` (email/password auth, OAuth Google/Apple, refresh sessions)
- `users` (me/profile/avatar/password)
- `requests`, `offers`, `contracts`, `favorites`, `reviews`
- `chats`, `presence`
- `catalog`, `providers`, `geo`
- `legal` (privacy/cookies text endpoints)
- `uploads` (avatar/image upload)

## Auth & Consent (current behavior)
- Register requires explicit `acceptPrivacyPolicy=true`.
- `acceptedPrivacyPolicyAt` is stored.
- `acceptedPrivacyPolicyVersion` is stored (`PRIVACY_POLICY_VERSION` from env).
- OAuth (Google/Apple):
1. Existing user with accepted policy -> login.
2. New/social user without consent -> consent-required flow.
3. Completion via `POST /auth/oauth/complete-register`.

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
- Rotate compromised credentials immediately.

## License
See `LICENSE`.
