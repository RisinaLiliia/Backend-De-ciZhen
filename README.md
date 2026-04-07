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
- `workspace` (BFF-style aggregated workspace view-model endpoints)
- `legal` (privacy/cookies text endpoints)
- `uploads` (avatar/image upload)

## Workspace BFF Endpoints
- `GET /workspace/public`
  Returns one aggregated payload for public workspace:
  request page, platform counters, city demand map points, and activity chart.
  Supports `activityRange=24h|7d|30d|90d` and `cityActivityLimit=1..5000` for full cities ranking payloads.
  - `cityActivity.items[]` is now range-aware (same selected `activityRange`) instead of all-time city totals.
- `GET /workspace/statistics` (optional Bearer auth)
  Unified backend-driven Decision Dashboard contract for both guests and authenticated users.
  Supports one global decision context:
  - `range=24h|7d|30d|90d`
  - `cityId=<city-id>` optional focus
  - `categoryKey=<category-key>` optional focus
  - `regionId=<region-id>` optional contract field; currently informational until region-level aggregation is available
  - `viewerMode=provider|customer` optional personalized perspective for authenticated Analyse
  - `citiesPage=<n>` optional server-owned page for `Staedte & Regionen`
  - `citiesLimit=1..50` optional page size for `Staedte & Regionen`
  - guest -> `mode=platform` with platform-level KPI/demand/funnel
  - authenticated -> `mode=personalized` with private KPI/funnel fields
  - all analytics blocks are now returned from one server-side source of truth for the selected context
  - new top-level contract sections:
    - `decisionContext`
      - selected `period`, `city`, `region`, `category`, `service`
      - `mode=global|focus`
      - `title`, `subtitle`, `stickyLabel`, `scopeLabel`
      - `health[]` for demand / competition / activity
      - `lowData` state for honest empty-state UX
    - `filterOptions`
      - backend-owned city/category/service options for the control bar
    - `sectionMeta`
      - context-aware titles/subtitles for dependent sections
    - `exportMeta`
      - backend-generated export filename metadata
  - `activity.metrics` provides backend-calculated decision metrics for selected range:
    - `offerRatePercent`
    - `responseMedianMinutes`
    - `unansweredRequests24h`
    - `cancellationRatePercent`
    - `completedJobs`
    - `gmvAmount`
    - `platformRevenueAmount` (`gmvAmount * PLATFORM_TAKE_RATE_PERCENT`)
    - `takeRatePercent`
    - semantic tones for UI state mapping:
      - `offerRateTone`
      - `responseMedianTone`
      - `unansweredTone`
      - `cancellationTone`
      - `completedTone`
      - `revenueTone`
  - `decisionInsight` is backend-generated from KPI metrics (`offerRatePercent`, `responseMedianMinutes`, `unansweredRequests24h`, conversion) and is dedicated to the `Decision Layer` KI summary (independent from city/category insight cards).
  - `decisionLayer` is the canonical personalized first section for authenticated Analyse:
    - `title`, `subtitle`
    - `metrics[]` with `marketValue`, `userValue`, `gapAbsolute`, `gapPercent`, `direction`, `status`, `signalCodes`, `primaryActionCode`, `summary`
    - backend keeps the KPI ids stable (`offer_rate`, `avg_response_time`, `unanswered_over_24h`, `completed_jobs`, `revenue`, `average_order_value`)
    - `viewerMode=provider|customer` changes KPI labels and user-side semantics on the backend; frontend should only render the contract
    - `primaryInsight` and `primaryAction` are the source of truth for the top recommendation surface
    - legacy `decisionInsight` is retained only as a compatibility field and is derived from `decisionLayer.primaryInsight` in personalized mode
    - if viewer-specific counts are not yet available and the backend must reuse legacy personalized aggregates, the section enters a cautious comparison mode:
      - KPI cards stay renderable, but `status`, `signalCodes`, and `primaryActionCode` are neutralized
      - `primaryInsight` becomes a low-confidence message instead of an aggressive recommendation
  - `activityComparison` is the canonical authenticated overlay contract for `Aktivität der Plattform`:
    - owns the personalized section header/meta for the chart (`title`, `subtitle`, `peakTimestamp`, `bestWindowTimestamp`, `updatedAt`)
    - `points[]` reuse the same timestamps as `activity.points`
    - every point exposes backend-owned `clientActivity` and `providerActivity`
    - `summary` explains whether user activity aligns with the market peak
    - frontend should render this section directly and must not reconstruct overlays or chart meta from `profileFunnel`, private overview totals, or generic market timestamps when this section is present
  - `personalizedPricing` is the canonical authenticated pricing section:
    - `marketAverage`, `recommendedMin`, `recommendedMax`, `userPrice`, `gapAbsolute`
    - `comparisonReliability` (`high|medium|low|unavailable`) is the backend-owned confidence signal for the current pricing comparison
    - semantic `position` (`below|within|above|unknown`)
    - semantic `effect` and backend-owned `actionCode`
    - frontend should not derive pricing interpretation from raw numbers
  - `categoryFit` is the canonical authenticated category-fit section:
    - market-facing fields come from `demand.categories`
    - user-facing fit/opportunity/action are computed on backend from user activity grouped in the same shared context
    - every item exposes backend-owned `reliability` and the section exposes `hasReliableItems`
    - frontend should only render `items[]`
  - `cityComparison` is the canonical authenticated city-fit section:
    - combines `marketRequests` with backend-computed `userActivity`, `userConversion`, `actionCode`, `recommendation`
    - every item exposes backend-owned `reliability` and the section exposes `hasReliableItems`
    - frontend should not calculate city fit or opportunity from raw counts
  - `risks`, `opportunities`, `nextSteps` are backend-built action sections derived from ranked insights:
    - each section exposes `title`, `subtitle`, `hasReliableItems`, `items[]`
    - every item includes `code`, `type`, `priority`, `description`, `confidence`, `reliability`, `actionCode`, `action`
    - frontend should render these sections directly and must not derive action priority from free-text insight bodies
  - `demand.categories[].sharePercent` is computed on backend from **all** published requests in selected range (`24h|7d|30d|90d`), not from frontend slices.
  - category response keeps top 50 categories sorted by demand; percent base remains full-range total.
  - `demand.cities[]` now includes city-level marketplace activity metrics:
    - `requestCount` (Anfragen)
    - `auftragSuchenCount` (deduplicated searches for jobs in city; fallback: offer proxy, nullable when no reliable signal)
    - `anbieterSuchenCount` (deduplicated searches for providers in city; fallback: distinct-clients proxy, nullable when no reliable signal)
    - `marketBalanceRatio` (backend-calculated demand/supply pressure ratio)
    - `signal` (`high|medium|low|none`, derived from market pressure)
    - city ranking is merged with `/workspace/public` city activity so short windows (`24h`) still keep complete market ordering.
  - `opportunityRadar[]` is backend-calculated (top 3 ranked opportunities):
    - rank context: `rank`, `cityId`, `city`, `categoryKey`, `category`
    - market data: `demand`, `providers`, `marketBalanceRatio`
    - scoring: `score`, `demandScore`, `competitionScore`, `growthScore`, `activityScore`
    - semantics for frontend rendering: `status`, `tone`, `summaryKey`, `metrics[]` (`key`, `value`, `semanticTone`, `semanticKey`)
  - `priceIntelligence` is backend-calculated from selected range activity:
    - context: `citySlug`, `city`, `categoryKey`, `category`
    - recommendations: `recommendedMin`, `recommendedMax`, `marketAverage`
    - strategy fields: `optimalMin`, `optimalMax`, `smartRecommendedPrice`, `smartSignalTone`, `recommendation`
    - reliability fields: `analyzedRequestsCount`, `confidenceLevel`
    - monetization signal: `profitPotentialScore`, `profitPotentialStatus`
  - `profileFunnel` is backend-calculated and range-aware (`24h|7d|30d|90d`) with business funnel stages:
    - `requestsTotal`
    - `offersTotal`
    - `confirmedResponsesTotal`
    - `closedContractsTotal`
    - `completedJobsTotal`
    - `profitAmount` (sum of completed contract `priceAmount` in range)
    - `stages[]` (render-ready payload for UI funnel):
      - `id` (`requests|offers|confirmations|contracts|completed|revenue`)
      - `label`
      - `value`
      - `displayValue`
      - `widthPercent`
      - `rateLabel`
      - `ratePercent`
      - `helperText`
    - `periodLabel`, `summaryText`, `totalConversionPercent`
    - step rates:
      - `offerResponseRatePercent` = `offersTotal / requestsTotal`
      - `confirmationRatePercent` = `confirmedResponsesTotal / offersTotal`
      - `contractClosureRatePercent` = `closedContractsTotal / confirmedResponsesTotal`
      - `completionRatePercent` = `completedJobsTotal / closedContractsTotal`
      - `conversionRate` = `completedJobsTotal / requestsTotal`
    - legacy aliases `stage1..stage4` are kept for backward compatibility.
  - `funnelComparison` is the canonical personalized `Profil Performance` section contract:
    - `title`, `subtitle`
    - `stages[]` with `marketCount`, `userCount`, `marketRateFromPrev`, `userRateFromPrev`, `gapRate`, `status`, `signalCodes`, `summary`
    - `largestDropOffStage`
    - `bottleneck`
    - `conversionSummary`
    - `primaryAction`
    - compatibility fields `summary`, `primaryBottleneck`, `nextAction`, `largestGapStage` are still included during migration
    - `viewerMode=provider` and `viewerMode=customer` select different stage semantics on the backend; frontend should not reinterpret provider funnel data as customer funnel data
    - viewer-mode fallback automatically forces `lowData` semantics so sparse transitional data does not create false bottlenecks or overconfident actions
  - Remaining transitional points in authenticated stats:
    - `profileFunnel` still exists as a compatibility surface beside canonical `funnelComparison`
    - `decisionInsight` still exists as a compatibility field beside canonical `decisionLayer.primaryInsight`
    - `personalizedPricing.userPrice` is currently derived from realized average order value, not from a dedicated user list-price model
    - `categoryFit` and `cityComparison` now expose reliability flags, but item-level confidence is still heuristic and not yet backed by a dedicated reliability model from upstream analytics
    - `risks/opportunities/nextSteps` are currently section views derived from the canonical `insights[]` engine rather than an independently versioned upstream action model
  - `insights[]` is now generated by a dedicated backend rule engine (`InsightsService`) and returned as ranked, evidence-based recommendations:
    - signal groups: `demand`, `opportunity`, `performance`, `growth`, `risk`, `promotion`
    - scoring formula: `businessImpact * 0.35 + userRelevance * 0.30 + confidence * 0.20 + freshness * 0.15`
    - includes enriched fields for UI cards:
      - `id`, `type`, `priority`, `audience`, `score`
      - `title`, `body`, `shortLabel`, `icon`, `confidence`
      - `metrics[]`, optional `action`, optional `validUntil`
    - backward-compatible fields are still included for existing frontend mappings:
      - `level`, `code`, `context`
    - response limits:
      - max 4 insights per response
      - max 1 promotion insight
      - max 1 risk insight
      - fallback insight is returned when there is not enough signal data
  - city statistics are returned for the full ranked set in selected range (no top-8 truncation in BFF).
  Supports `range=24h|7d|30d|90d`.
- `POST /workspace/public/requests-batch`
  Batch-resolves public request details by ids (N+1 elimination endpoint).
- `GET /workspace/private` (Bearer auth)
  Returns personalized counters/KPIs/series for private workspace dashboard.
  - includes backend-owned `preferredRole: customer|provider`
  - accepts optional `period=24h|7d|30d|90d` for context-aware preferred-role resolution
  - frontend must render this field directly and must not infer dominant role from private counters client-side
- `GET /workspace/requests` (Bearer auth)
  Returns the authenticated user's request workflow board for `workspace?section=requests&scope=my`.
  Backend owns workflow aggregation, list ordering, summary counters, progress state, and side-panel recommendations.
  Supports:
  - `scope=my` (current supported scope)
  - `role=all|customer|provider`
  - `state=all|attention|execution|completed`
  - `period=24h|7d|30d|90d`
  - `sort=activity|newest|deadline|budget|price_desc|oldest|date_asc`
  - `page=<n>` and `limit=1..100`
  - optional echo filters `city`, `category`, `service`
  Response contract:
  - `header`
    - backend-owned section title
  - `filters`
    - canonical query state echoed back to the client
  - `summary.items[]`
    - filter cards for `Alle`, `Aktiv`, `In Ausführung`, `Abgeschlossen`
  - `list.items[]`
    - render-ready workflow cards with:
      - `requestId`
      - `role`
      - `state`, `stateLabel`, `urgency`
      - `activity`
      - `progress.currentStep` and `progress.steps[]`
      - `quickActions[]`
  - `sidePanel`
    - backend-owned focus/recommendation/context/next-steps blocks
  Frontend should treat this endpoint as the source of truth for private requests workflow semantics and should render the contract directly instead of rebuilding states client-side.

## Analytics Ingestion Endpoint
- `POST /analytics/search-event` (optional Bearer auth)
  Records deduplicated search intent events from UI filters/search interactions.
  - Redis dedupe key: `queryHash + actor + timeBucket`
  - Mongo aggregate collection: `analytics_search_aggregates`
  - Used by `/workspace/statistics` city demand metrics (`auftragSuchenCount`, `anbieterSuchenCount`).

## Reviews BFF Endpoint
- `GET /reviews/overview`
  Single public endpoint for provider/client reviews UI.
  Returns paged `items` and aggregated `summary` (`total`, `averageRating`, `distribution` 1..5) in one response.

Notes:
- Legacy public reads `GET /reviews` and `GET /reviews/summary` were removed in favor of `GET /reviews/overview`.
- Authenticated endpoint `GET /reviews/my` remains for workspace/private flows.

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
- In `PASSWORD_RESET_EMAIL_MODE=log`, reset URLs are redacted from logs

## Legal Endpoints
- `GET /legal/privacy`
- `GET /legal/cookies`

## Health Endpoints
- `GET /health` (basic compatibility check)
- `GET /health/live` (liveness probe)
- `GET /health/ready` (readiness probe with Mongo + Redis status)

## Request Logging
- Every HTTP request is logged as structured JSON with:
  - `event`
  - `requestId`
  - `method`
  - `path` (without query string)
  - `statusCode`
  - `durationMs`
  - `contentLength`
  - `userAgent`
- Severity mapping:
  - `error` for `5xx`
  - `warn` for `4xx` or slow requests
  - `log` for successful requests

Sources:
- `legal/privacy-policy.md`
- `legal/cookie-notice.md`

## Quick Start
Prerequisites:
- Node.js 20.20+ (recommended)
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
- `REDIS_DISABLED=true` (enables in-memory fallback cache/session store for local/dev)
- `TRUST_PROXY` (`0` by default; set `1` or `true` when running behind reverse proxy)
- `SEARCH_ANALYTICS_BUCKET_SECONDS` (default `900`, dedupe/aggregation time bucket)
- `SEARCH_ANALYTICS_DEDUPE_TTL_SECONDS` (default `1020`, Redis dedupe key TTL)
- `ANALYTICS_HASH_SALT` (optional salt for hashing actor/query dedupe keys)
- `PLATFORM_TAKE_RATE_PERCENT` (default `10`, used to derive `activity.metrics.platformRevenueAmount`)

Run:
```bash
npm run start:dev
```

## Provider Profile Contract
- `ProviderProfileDto` now includes server-derived `isProfileComplete`.
- Returned by `GET /providers/me/profile`, `PATCH /providers/me/profile`, and nested in `POST /offers`/`PATCH /offers/:id` responses.
- Computed on backend from profile data completeness (`displayName`, `cityId`, `serviceKeys`, `basePrice`) and should be treated as the source of truth for offer-readiness UX.

## Platform Reviews Overview Contract
- `GET /reviews/platform/overview` supports workspace reviews filtering directly on the backend.
- Query parameters:
  - `range`: `24h | 7d | 30d | 90d`
  - `sort`: `created_desc | rating_desc`
  - `limit`: `1..100`
  - `offset`: `0..n`
- Filtering happens before pagination and before summary aggregation, so `items`, `total`, and `summary.distribution` always describe the same selected period.
- This is the contract consumed by `/workspace?section=reviews`.

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
- `npm run test:e2e:smoke`
- `npm run swagger`
- `npm run security:audit`
- `npm run seed:cities`
- `npm run import:cities:geonames -- /path/to/DE.txt`
- `npm run import:cities:postal:geonames -- /path/to/DE.txt`
- `npm run migrate:cities:state-labels`
- `npm run seed:services`
- `npm run seed:demo`

## Catalog Data Workflow
- GeoNames city import seeds the base city catalog and search aliases.
- GeoNames postal import enriches existing city documents with `postalCodes[]` for ZIP-first autocomplete and mixed queries like `10115 Berlin`.
- `migrate:cities:state-labels` fixes legacy German state labels after older imports.
- Recommended order for a fresh Germany catalog:
  1. `npm run import:cities:geonames -- ./data/geonames/DE.txt`
  2. `npm run import:cities:postal:geonames -- ./data/geonames-postal/DE.txt`
  3. `npm run migrate:cities:state-labels`

## Security Notes
- Do not commit `.env`.
- Use strong `JWT_SECRET`.
- Keep OAuth secrets private.
- Refresh flow uses `httpOnly` cookie (`refreshToken`).
- Rotate compromised credentials immediately.

## License
See `LICENSE`.
