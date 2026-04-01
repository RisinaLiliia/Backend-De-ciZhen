# Chats Module

## Purpose

The chat module is the communication layer inside the decision workspace.
It keeps conversation state attached to:

- `request`
- `offer`
- `order`

Backend remains the source of truth for access checks, unread counters, last message snapshots,
pagination, normalization, and realtime fan-out.

Externally the page behaves like a familiar messenger UI:

- dense conversation sidebar
- single active thread
- compact header/info drawer
- viewer-specific unread and counterpart payloads

## Architecture

Files in this repo stay aligned with the existing Nest module structure:

- `src/modules/chats/chats.module.ts`
- `src/modules/chats/chats.controller.ts`
- `src/modules/chats/chats.service.ts`
- `src/modules/chats/chats.gateway.ts`
- `src/modules/chats/schemas/chat-thread.schema.ts`
- `src/modules/chats/schemas/chat-message.schema.ts`
- `src/modules/chats/dto/*`

## Data Model

### Conversation (`chat_threads`)

Canonical fields:

- `participantEntries`
- `relatedEntity`
- `lastMessage`
- `unreadCount`
- `status`
- `searchText`

Legacy compatibility fields are still persisted so existing `/chat/threads` clients continue to work:

- `requestId`
- `clientId`
- `providerUserId`
- `offerId`
- `contractId`
- `participants`
- `lastMessageAt`
- `lastMessagePreview`
- `unreadClientCount`
- `unreadProviderCount`

### Message (`chat_messages`)

Canonical fields:

- `conversationId`
- `type`
- `text`
- `attachments`
- `deliveryStatus`

Legacy compatibility field:

- `threadId`

## HTTP API

### New endpoints

- `POST /chat/conversations`
- `GET /chat/conversations`
- `GET /chat/conversations/:id`
- `GET /chat/conversations/:id/messages`
- `POST /chat/conversations/:id/messages`
- `POST /chat/messages`
- `POST /chat/conversations/:id/read`

### Legacy compatibility endpoints

- `POST /chat/threads`
- `GET /chat/inbox`
- `GET /chat/threads/:id/messages`
- `POST /chat/threads/:id/messages`
- `POST /chat/threads/:id/read`

## Realtime

Socket.IO namespace: `/chat`

Events:

- `chat.message.created`
- `chat.message.read`
- `chat.conversation.updated`

Clients authenticate the same way as the presence gateway, then join room `user:<userId>`.

## Business Rules

- Access is verified against request/client/provider ownership before a conversation is created.
- Messages are sanitized server-side.
- Attachments are metadata-only for now and capped at 5 items.
- Global throttling is active, and message write endpoints add tighter route-level throttling.
- Conversations are sorted by `updatedAt desc, _id desc`.
- Cursor pagination is used on new endpoints.
- Legacy endpoints still support offset pagination for compatibility.

## Swagger

Swagger is generated from DTO classes used by the controller:

- conversation DTOs
- message DTOs
- paginated response DTOs
- bearer auth requirements

Regenerate with:

```bash
npm run swagger
```

## Example Requests

### Create conversation

```http
POST /chat/conversations
Authorization: Bearer <token>
Content-Type: application/json

{
  "relatedEntity": {
    "type": "offer",
    "id": "66f0c1a2b3c4d5e6f7a8b9aa"
  },
  "requestId": "65f0c1a2b3c4d5e6f7a8b9c1",
  "participantUserId": "64f0c1a2b3c4d5e6f7a8b9c9",
  "participantRole": "provider",
  "providerUserId": "64f0c1a2b3c4d5e6f7a8b9c9",
  "offerId": "66f0c1a2b3c4d5e6f7a8b9aa"
}
```

### Send message

```http
POST /chat/conversations/66f0c1a2b3c4d5e6f7a8b9aa/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Confirmed. I can start on Tuesday."
}
```

### List conversations

```http
GET /chat/conversations?role=provider&state=active&search=frankfurt&limit=24
Authorization: Bearer <token>
```

Example sidebar-ready response fields:

- `counterpart`
- `unread`
- `lastMessagePreview`
- `relatedEntity`

### Get conversation info

```http
GET /chat/conversations/66f0c1a2b3c4d5e6f7a8b9aa
Authorization: Bearer <token>
```

## Tests

Targeted verification:

```bash
npm run test -- src/modules/chats/chats.service.spec.ts
npm run test:e2e -- test/chats.e2e-spec.ts test/chat.e2e-spec.ts
```
