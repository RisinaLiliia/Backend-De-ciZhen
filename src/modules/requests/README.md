# Requests Module

## Lifecycle Ownership

Request lifecycle decisions are backend-owned. The frontend renders request state, visibility, and available actions from API DTOs instead of deriving business rules from local role/status heuristics.

Core states:

- `draft`: owner-only request copy or newly created request that is not visible in the public feed.
- `published`: visible in `/requests/public`, public workspace feeds, and provider discovery.
- `paused`: owner removed the publication before any provider response arrived; the request is hidden from public discovery and can be published again.
- `matched` / `closed`: contract-driven states that cannot be deleted through the regular owner delete command.
- `cancelled`: owner cancelled a request that already had retained participants such as favorites, offers, or chats.

## Owner Request Commands

Owner actions for `/workspace?section=requests&scope=my` are backend-owned and exposed through `workspaceRequests.list.items[].status.actions` and `decision.primaryAction`.

Implemented commands:

- `POST /requests/my/:requestId/duplicate`
  - creates a new draft copy of the owner request
  - assigns a fresh `createdAt`
  - keeps request content fields
  - resets workflow-only fields like `matchedProviderUserId`, `assignedContractId`, `matchedAt`, price trend history, publication timestamps, cancellation metadata, and retention metadata
- `POST /requests/my/:requestId/publish`
  - publishes `draft`, `paused`, or retained `cancelled` owner requests
  - sets `publishedAt` to the current backend time
  - clears `cancelledAt`, `purgeAt`, `inactiveReason`, and `inactiveMessage`
  - makes the request visible in the public request feed
- `POST /requests/my/:requestId/unpublish`
  - moves a `published` request without offers to `paused`
  - removes the request from the public feed without creating retained inactive cards
  - returns `409` once provider offers exist because owner must review responses instead
- `POST /requests/my/:requestId/archive`
  - performs owner-side soft archive by setting `archivedAt`
  - is idempotent for already archived requests
- `DELETE /requests/my/:requestId`
  - hard deletes requests without retained participants
  - cancels requests with favorites, offers, or chats by setting `status=cancelled`, `cancelledAt`, `purgeAt`, `inactiveReason=cancelled_by_customer`, and `inactiveMessage`

## Retained Cancelled Requests

When a request is deleted after other users already interacted with it, it is removed from public discovery but retained for related users.

Visibility rules:

- public list/count endpoints only return `status=published` and `archivedAt=null`
- unauthenticated public detail still returns `404` for cancelled requests
- authenticated users can load a cancelled request detail only when they are the owner or have a retained relation through favorite, offer, or chat
- favorites can return retained cancelled request cards for the user who saved them
- retained cards expose `isInactive=true`, `inactiveReason=cancelled_by_customer`, `inactiveMessage`, and `purgeAt`

`purgeAt` is calculated as seven days after cancellation. A partial MongoDB TTL index (`idx_requests_cancelled_purge_at_ttl`) automatically removes cancelled retained requests after that timestamp, so retention is enforced by the database and not by frontend timers.

## Workspace Action Contract

Customer cards expose the following owner actions through backend DTOs:

- `open`
- `edit-request`
- `publish-request`
- `unpublish-request`
- `review-responses`
- `duplicate-request`
- `share-request`
- `archive-request`
- `delete-request`

Primary CTA rules are server-owned:

- draft / paused / retained cancelled without current publication: `publish_request` (`Veröffentlichen`)
- published without responses: `unpublish_request` (`Publikation aufheben`)
- published with responses: `review_responses` (`Antworten ansehen`)

Frontend should render this action payload directly and keep only UI-only concerns such as menu layout, confirmation dialogs, share transport, and query invalidation.
