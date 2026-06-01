# Milestone 1 Auth Parity

This document records the authenticated write contract for V1 after the Milestone 1 hardening pass.

## Backend Contract

All server-side writes must derive actor identity from the authenticated session or socket, not from client payload fields.

### HTTP routes

| Surface | Auth source | Notes |
| --- | --- | --- |
| `/users/:uid/*` | `req.uid` from session cookie | `:uid` must match authenticated user |
| `/auth/*` E2EE write routes | `req.uid` from session cookie | user/room membership and device validation enforced |
| `/api/scheduled-messages/*` | `req.uid` from session cookie | room membership and owner checks enforced |
| `/api/search`, `/api/summary/:roomId` | `req.uid` from session cookie | room membership enforced |

### Socket events

| Event | Actor derived from | Server checks |
| --- | --- | --- |
| `join_room` | `socket.uid` | valid room id, room membership |
| `load_chat_doc_from_db` | `socket.uid` | valid room/chat doc ids, room membership |
| `chat_event_client_to_server` | `socket.uid`, `socket.session` | valid room/message ids, room membership |
| `chat_edit_client_to_server` | `socket.uid` | valid ids, room membership, room-level ownership check |
| `chat_delete_client_to_server` | `socket.uid` | valid ids, room membership, room-level ownership check |
| `chat_save_client_to_server` | `socket.uid` | valid ids, room membership |
| `chat_reaction_client_to_server` | `socket.uid`, `socket.session.name` | valid ids, room membership |
| `send_friend_request_client_to_server` | `socket.uid` | valid receiver id |
| `respond_friend_request_client_to_server` | `socket.uid` | valid requester id |
| `update_user_data` | `socket.uid` | supported-field filtering only |
| `ai_summarize_conversation` | `socket.uid` | room membership |
| `ai_smart_replies` | `socket.uid` | room membership when scoped to a room |
| `schedule_message` | `socket.uid`, `socket.session` | valid room id, room membership |
| `get_scheduled_messages` | `socket.uid` | room membership when scoped to a room |
| `update_scheduled_message` | `socket.uid` | valid message id, ownership, room membership |
| `delete_scheduled_message` | `socket.uid` | valid message id, ownership |

## Web client status

- Profile updates no longer send `uid` in socket payloads.
- Friend requests no longer send `senderUid` in socket payloads.
- Scheduled-message socket actions no longer send `userUid` in socket payloads.
- AI summarize and smart-replies flows surface permission errors instead of silently failing.

## Mobile client status

- Profile updates no longer send `uid` in socket payloads.
- Friend requests no longer send `senderUid` in socket payloads.
- Reactions no longer send `userUid` / `userName` in socket payloads.
- Scheduled-message socket actions no longer send `userUid` in socket payloads.
- Profile and friend-request flows now surface backend authorization errors with user-facing messages.

## Deferred from Milestone 1

- Rate limiting for auth, search, AI, uploads, and friend actions remains intentionally deferred to a later milestone.
