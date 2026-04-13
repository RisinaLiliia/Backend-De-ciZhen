# De’ciZhen Backend API

Backend API for **De’ciZhen**, a modular marketplace and workspace platform for service requests, provider interactions, contracts, analytics, and decision support.

Built with **NestJS**, **MongoDB**, and **Redis**, the backend provides domain-driven business logic, authentication, workspace aggregation endpoints, analytics ingestion, and production-oriented infrastructure patterns.

---

## Overview

De’ciZhen Backend is the core API layer behind the De’ciZhen marketplace/workspace experience.

It is responsible for:

- authentication and session management
- request / offer / contract lifecycle
- role-based access control
- workspace aggregation and analytics contracts
- real-time chat and presence
- legal consent tracking
- profile, catalog, geo, and upload flows

The project follows a **modular NestJS architecture** with clear domain boundaries and backend-owned contracts for frontend rendering.

---

## Tech Stack

- **NestJS**
- **TypeScript**
- **MongoDB** with **Mongoose**
- **Redis**
- **Swagger**
- **class-validator / class-transformer**
- **JWT authentication**
- **Cloudinary** for uploads
- **OAuth** (Google / Apple)

---

## Architecture

The backend is organized as a modular domain-driven API.

Each module typically encapsulates:

- controller
- service
- schema
- DTO validation layer
- business rules

Cross-cutting concerns such as authentication, guards, session handling, consent tracking, validation, and logging are separated from domain logic.

### Design principles

- **Backend-owned contracts** for frontend rendering
- **Modular domain boundaries**
- **DTO-based validation**
- **Aggregated BFF-style endpoints** for workspace views
- **Production-style infrastructure** with health checks, structured logs, and secure auth/session flows

### Storage responsibilities

- **MongoDB** stores core application data
- **Redis** manages refresh/session flows, short-lived tokens, cache, and deduplication logic

---

## Core Modules

### Identity & User
- `auth` — email/password auth, OAuth Google/Apple, refresh sessions, password reset
- `users` — account, profile, avatar, password flows

### Marketplace
- `requests`
- `offers`
- `contracts`
- `favorites`
- `reviews`

### Communication
- `chats`
- `presence`

### Discovery & Catalog
- `catalog`
- `providers`
- `geo`

### Workspace / Aggregation
- `workspace` — BFF-style aggregated endpoints for public and authenticated workspace flows

### Platform / Infrastructure
- `legal`
- `uploads`
- `analytics`
- `health`

---

## Workspace API

The workspace layer provides backend-owned aggregated contracts that the frontend should render directly rather than reconstructing client-side.

---

### `GET /workspace/public`

Returns aggregated public workspace data, including:

- request page data
- platform counters
- city demand map points
- activity chart
- city activity ranking

#### Query params

- `activityRange=24h|7d|30d|90d`
- `cityActivityLimit=1..5000`

#### Notes

- `cityActivity.items[]` is range-aware and respects the selected `activityRange`
- city ranking payload supports full ranking datasets for UI use

---

### `GET /workspace/statistics`

Optional Bearer authentication.  
Returns the unified **Decision Dashboard** contract for both guests and authenticated users.

#### Global decision context

Supports one shared context across all dependent sections:

- `range=24h|7d|30d|90d`
- `cityId=<city-id>`
- `categoryKey=<category-key>`
- `regionId=<region-id>` — currently informational until region-level aggregation is available
- `viewerMode=provider|customer`
- `citiesPage=<n>`
- `citiesLimit=1..50`

#### Response modes

- **guest** → `mode=platform`
- **authenticated** → `mode=personalized`

#### Key top-level sections

- `decisionContext`
- `filterOptions`
- `sectionMeta`
- `exportMeta`
- `activity`
- `decisionInsight`
- `decisionLayer`
- `activityComparison`
- `personalizedPricing`
- `categoryFit`
- `cityComparison`
- `risks`
- `opportunities`
- `nextSteps`
- `demand`
- `opportunityRadar`
- `priceIntelligence`
- `profileFunnel`
- `funnelComparison`
- `insights`

#### Important contract rules

- frontend should treat this endpoint as the **single source of truth**
- backend owns KPI semantics, comparisons, confidence states, and action prioritization
- frontend should **render contracts directly** and should not reinterpret raw numbers into product logic where a canonical section is available

---

### `POST /workspace/public/requests-batch`

Batch-resolves public request details by ids.

Used as an **N+1 elimination** endpoint for public request lists.

---

### `GET /workspace/private`

Bearer auth required.

Returns personalized private workspace dashboard data, including:

- counters
- KPIs
- activity series
- backend-owned `preferredRole`
- `ratingSummary`

#### Query params

- `period=24h|7d|30d|90d`

#### Notes

Frontend must render `preferredRole` directly and must not infer dominant role client-side.

---

### `GET /workspace/requests`

Bearer auth required.

Returns the authenticated user’s request workflow board for:

`/workspace?section=requests&scope=my`

#### Supported query params

- `scope=my`
- `role=all|customer|provider`
- `state=all|attention|execution|completed`
- `period=24h|7d|30d|90d`
- `sort=activity|newest|deadline|budget|price_desc|oldest|date_asc`
- `page=<n>`
- `limit=1..100`
- optional echo filters:
  - `city`
  - `category`
  - `service`

#### Response sections

- `header`
- `filters`
- `summary`
- `list.items[]`
- `decisionPanel`
- `overview`
- `sidePanel`

#### Notes

This endpoint is the canonical source of truth for private request workflow semantics.  
Frontend should render the contract directly instead of rebuilding workflow logic client-side.

---

## Analytics

### `POST /analytics/search-event`

Optional Bearer auth.

Records deduplicated search intent events from filter/search interactions.

#### Used for

- workspace statistics
- city demand metrics
- market demand/supply signals

#### Internal mechanics

- Redis dedupe key based on `queryHash + actor + timeBucket`
- Mongo aggregate collection: `analytics_search_aggregates`

---

## Reviews API

### `GET /reviews/overview`

Single public endpoint for provider/client reviews UI.

Returns:

- paged items
- aggregated summary
- total count
- average rating
- rating distribution

#### Notes

Legacy public reads:

- `GET /reviews`
- `GET /reviews/summary`

have been removed in favor of `GET /reviews/overview`.

Authenticated `GET /reviews/my` remains for private workspace flows.

---

### `GET /reviews/platform/overview`

Backend-owned contract for workspace review filtering.

#### Query params

- `range=24h|7d|30d|90d`
- `sort=created_desc|rating_desc`
- `limit=1..100`
- `offset=0..n`

Filtering happens **before** pagination and summary aggregation, so all returned metadata matches the selected filter context.

---

## Auth & Consent Flow

### Registration

Registration requires explicit privacy consent:

- `acceptPrivacyPolicy=true`
- `acceptedPrivacyPolicyAt` is stored
- `acceptedPrivacyPolicyVersion` is stored from env (`PRIVACY_POLICY_VERSION`)

### OAuth

Supported providers:

- Google
- Apple

Behavior:

- existing user with accepted privacy policy → login
- new social user without consent → consent-required flow
- completion endpoint: `POST /auth/oauth/complete-register`

### Password Reset

- `POST /auth/forgot-password`
- `POST /auth/reset-password`

#### Notes

- forgot-password always returns `ok: true`
- reset tokens are short-lived
- reset tokens are validated via Redis-backed flow
- all active refresh sessions are invalidated after successful reset
- reset link delivery can be integrated through webhook-based email delivery
- in `PASSWORD_RESET_EMAIL_MODE=log`, reset URLs are redacted from logs

---

## Legal Endpoints

- `GET /legal/privacy`
- `GET /legal/cookies`

Source files:

- `legal/privacy-policy.md`
- `legal/cookie-notice.md`

---

## Health Endpoints

- `GET /health` — compatibility/basic check
- `GET /health/live` — liveness probe
- `GET /health/ready` — readiness probe with Mongo + Redis status

---

## Request Logging

Every HTTP request is logged as structured JSON.

### Logged fields

- `event`
- `requestId`
- `method`
- `path` (without query string)
- `statusCode`
- `durationMs`
- `contentLength`
- `userAgent`

### Severity mapping

- `error` — 5xx responses
- `warn` — 4xx responses or slow requests
- `log` — successful requests

---

## Provider Profile Contract

`ProviderProfileDto` includes server-derived `isProfileComplete`.

Returned by:

- `GET /providers/me/profile`
- `PATCH /providers/me/profile`
- nested offer responses such as `POST /offers` and `PATCH /offers/:id`

### Notes

`isProfileComplete` is computed on the backend from profile completeness and should be treated as the source of truth for offer-readiness UX.

---

## Catalog Data Workflow

The catalog pipeline supports German city and postal datasets.

### Available scripts

- GeoNames city import
- GeoNames postal import
- state label migration

### Recommended order for a fresh Germany catalog

```bash
npm run import:cities:geonames -- ./data/geonames/DE.txt
npm run import:cities:postal:geonames -- ./data/geonames-postal/DE.txt
npm run migrate:cities:state-labels
````

### Notes

* city import seeds the base city catalog and aliases
* postal import enriches city documents with `postalCodes[]`
* state migration fixes legacy German state labels from older imports

---

## Quick Start

### Prerequisites

* **Node.js 20.20+**
* **MongoDB**
* **Redis**

### Install dependencies

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
```

### Minimum required environment variables

```env
MONGO_URI=
JWT_SECRET=
REDIS_HOST=
REDIS_PORT=
FRONTEND_URL=
```

### Important optional environment variables

```env
PRIVACY_POLICY_VERSION=2026-02-18

PASSWORD_RESET_TTL_MINUTES=30
PASSWORD_RESET_PATH=/auth/reset-password
PASSWORD_RESET_RETURN_LINK=false
PASSWORD_RESET_EMAIL_MODE=disabled
PASSWORD_RESET_EMAIL_WEBHOOK_URL=
PASSWORD_RESET_EMAIL_WEBHOOK_BEARER=
PASSWORD_RESET_EMAIL_FROM=
PASSWORD_RESET_EMAIL_FROM_NAME=
PASSWORD_RESET_EMAIL_SUBJECT=
PASSWORD_RESET_BREVO_API_URL=
PASSWORD_RESET_BREVO_API_KEY=

GOOGLE_OAUTH_*
APPLE_OAUTH_*
CLOUDINARY_*

REDIS_DISABLED=true
TRUST_PROXY=0

SEARCH_ANALYTICS_BUCKET_SECONDS=900
SEARCH_ANALYTICS_DEDUPE_TTL_SECONDS=1020
ANALYTICS_HASH_SALT=

PLATFORM_TAKE_RATE_PERCENT=10
```

### Run in development

```bash
npm run start:dev
```

---

## API Documentation

### Swagger UI

Available locally/remotely at:

```bash
/docs
```

### Generate static OpenAPI spec

```bash
npm run swagger
```

---

## Testing

The project includes:

* unit tests
* e2e tests for auth and critical business flows
* smoke e2e checks

### Commands

```bash
npm test
npm run test:e2e
npm run test:e2e:smoke
```

---

## Scripts

```bash
npm run start
npm run start:dev
npm run build

npm test
npm run test:e2e
npm run test:e2e:smoke

npm run swagger
npm run security:audit

npm run seed:cities
npm run import:cities:geonames -- /path/to/DE.txt
npm run import:cities:postal:geonames -- /path/to/DE.txt
npm run migrate:cities:state-labels

npm run seed:services
npm run seed:demo
```

---

## Security Notes

* never commit `.env`
* use a strong `JWT_SECRET`
* keep OAuth credentials private
* refresh flow uses `httpOnly` cookies
* rotate compromised secrets immediately

For local/dev setups, `REDIS_DISABLED=true` enables an in-memory fallback for session/cache flows.

---

## License

See [LICENSE](./LICENSE).

---

## Summary

De’ciZhen Backend API is a modular NestJS backend that powers marketplace workflows, workspace analytics, session-based authentication, chat/presence, legal consent handling, and backend-owned decision contracts for the De’ciZhen platform.
