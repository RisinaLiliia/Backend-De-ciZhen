# De’ciZhen Backend API

Production‑grade REST API built with NestJS, MongoDB (Mongoose), Redis, and Swagger.

**Stack**
- `NestJS` (HTTP, DI, validation)
- `MongoDB + Mongoose` (persistence)
- `Redis` (sessions, caching, rate limiting)
- `Swagger` (OpenAPI docs)

**Key Modules**
- `auth` (register/login/refresh/logout)
- `users` (profile + avatar)
- `requests` (public + client flows)
- `responses` (provider responses + client decisions)
- `bookings` (create, cancel, reschedule, history)
- `availability` (slots + blackouts)
- `providers` (profile + public list)
- `catalog` (cities + service categories)
- `reviews` (client/provider reviews)
- `geo` (autocomplete)

## Getting Started

**Prerequisites**
- Node.js 18+
- MongoDB (local or Atlas)
- Redis

**Install**
```bash
npm install
```

**Environment**
Copy `.env.example` to `.env` and fill values:
```bash
cp .env.example .env
```

Required values (minimum for local dev):
- `MONGO_URI`
- `JWT_SECRET`
- `REDIS_HOST`
- `REDIS_PORT`

Optional:
- `CLOUDINARY_*` for avatar/photos upload
- `GOOGLE_AUTH_*` if Google auth is used

**Run**
```bash
npm run start
```

## API Docs

Swagger is available at:
- `https://backend-de-cizhen.onrender.com/docs`

You can also generate a static spec:
```bash
npm run swagger
```
This writes `swagger.json` in the project root.

## Legal

Privacy Policy:
- `https://backend-de-cizhen.onrender.com/legal/privacy`

Cookie Notice:
- `https://backend-de-cizhen.onrender.com/legal/cookies`

## Testing

**Unit tests**
```bash
npm test
```

**E2E tests**
```bash
npm run test:e2e
```

## Project Structure

```
src/
  app.module.ts
  common/
  infra/
  modules/
    auth/
    users/
    requests/
    responses/
    bookings/
    availability/
    providers/
    catalog/
    reviews/
    geo/
  swagger.ts

test/
  *.e2e-spec.ts
```

## Security Notes

- Do not commit `.env` with secrets.
- Use strong `JWT_SECRET` values.
- Rotate cloud credentials if ever exposed.
- Public endpoints use privacy‑safe DTOs to reduce data leakage.

## Common Scripts

- `npm run start` — start API
- `npm run start:dev` — watch mode
- `npm run build` — build
- `npm test` — unit tests
- `npm run test:e2e` — e2e tests
- `npm run swagger` — generate OpenAPI spec

## License

Copyright (c) 2026 Liliia Risina.
All rights reserved. See `LICENSE`.
