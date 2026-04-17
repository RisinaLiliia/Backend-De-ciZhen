# Requests Module

## Owner Request Commands

Owner actions for `/workspace?section=requests&scope=my` are backend-owned.

Implemented commands:

- `POST /requests/my/:requestId/duplicate`
  - creates a new draft copy of the owner request
  - keeps request content fields
  - resets workflow-only fields like `matchedProviderUserId`, `assignedContractId`, `matchedAt`, and price trend history
- `POST /requests/my/:requestId/archive`
  - performs soft delete by setting `archivedAt`
  - is idempotent for already archived requests
- `DELETE /requests/my/:requestId`
  - performs hard delete

## Archive Semantics

`archivedAt` is separate from lifecycle `status`.

That separation keeps business workflow state intact while allowing soft deletion to behave consistently across:

- public request listing and detail endpoints
- `GET /requests/my`
- workspace private overview and request cards
- public summary counters and city activity aggregation

Archived requests are excluded from those reads by default.

## Workspace Contract

Customer cards expose owner-menu entries through `workspaceRequests.list.items[].status.actions`.

Current customer action contract:

- `open`
- `edit-request`
- `duplicate-request`
- `share-request`
- `archive-request`
- `delete-request`

Frontend is expected to render the owner menu from that payload and keep only UI-only concerns such as share transport and delete confirmation.
