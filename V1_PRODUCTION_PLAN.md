# Hoplio V1 Production Plan

This document turns the current Hoplio monorepo into a concrete V1 execution plan.

## V1 Decisions

These are locked unless we intentionally reopen scope:

- Mobile and web must ship the same core chat feature set.
- Mobile must support E2EE and AI features just like web.
- Web does not need offline login or offline cache for V1.
- Mobile calls and camera-related UI stay hidden for V1.
- Backend should be prepared for stateless horizontal scaling with Redis.
- Google Play readiness is part of V1.

## V1 Feature Contract

The following features are in scope on both web and mobile:

- Authentication
  - Google sign-in
  - Email/password sign-in
  - Secure session handling
- Messaging
  - 1:1 chat
  - Group chat
  - Message history pagination
  - Text messages
  - Image/file attachments
  - Reactions
  - Edit/delete/save
  - Presence and last seen
  - Unread counts
  - Push notifications
- Intelligence
  - AI assistant room
  - AI summarize
  - AI smart replies
  - Semantic search
- Privacy
  - E2EE on web
  - E2EE on mobile
- Utility
  - Scheduled messages
  - Group management

## Explicitly Out of Scope for V1

- Voice calls
- Video calls
- Camera entry points in mobile UI
- Offline login/cache for web
- New nonessential social features
- Large visual redesigns unrelated to usability or parity

## Release Gates

V1 is not ready until all of these are true:

- All client write actions are authorized server-side using authenticated identity.
- Web and mobile pass the feature parity checklist.
- Mobile E2EE works for sending, receiving, loading history, and key recovery paths.
- Backend can run across multiple instances without in-memory coordination bugs.
- Scheduled messages run from durable background processing, not in-process cron.
- Android release is signed correctly and produces a Play-ready AAB.
- Basic CI, test coverage, logging, and crash reporting are in place.

## Recommended Delivery Order

1. Scope lock and parity matrix
2. Security and authorization hardening
3. Redis and stateless backend work
4. Mobile E2EE and AI parity
5. Hide dead-end mobile UI and remove "coming soon" experience
6. Message data model hardening
7. Unread counts and push notifications
8. Android release readiness
9. Test, CI, and observability
10. Beta rollout and bug-fix pass

## Milestone Plan

### Milestone 0 - Scope Lock and Audit Baseline

Goal: freeze V1 and make all future work measured against one shared checklist.

#### Checklist

- [ ] Create a parity matrix for every feature across `apps/web`, `apps/mobile`, and `apps/backend`
- [ ] Decide whether GIF support is in V1 on both clients or removed from both
- [ ] Mark all non-V1 features in code comments or follow-up issues
- [ ] Add a release board with labels: `backend`, `web`, `mobile`, `ops`, `security`, `play-store`

#### Exit Criteria

- One agreed V1 feature matrix exists
- No open ambiguity about what "same features" means

### Milestone 1 - Security and Authorization Hardening

Goal: stop trusting client payloads and make server-side authorization real.

Status: complete on June 1, 2026, with rate limiting intentionally deferred by product decision.

#### Backend

- [x] Replace client-trusted `uid`/actor fields in socket mutations with authenticated socket identity
- [x] Enforce membership checks on:
  - [x] message send
  - [x] message edit
  - [x] message delete
  - [x] message save
  - [x] reactions
  - [x] scheduled messages
- [x] Enforce ownership checks on:
  - [x] profile updates
  - [x] scheduled message updates/deletes
- [x] Enforce group admin/owner checks on:
  - [x] add member
  - [x] remove member
  - [x] update group
  - [x] delete group
- [x] Validate all room IDs, message IDs, device IDs, and upload paths
- [ ] Add rate limiting for auth, search, AI, uploads, and friend actions
- [x] Revisit session cookie production config

#### Web

- [x] Verify all web mutations can work without client-trusted identity fields
- [x] Remove any UI assumptions that bypass permission errors

#### Mobile

- [x] Verify all mobile mutations can work without client-trusted identity fields
- [x] Add proper failure UX for authorization errors

#### Exit Criteria

- All writes are authorized from session/socket identity
- Group management cannot be spoofed by payload edits
- Session/cookie configuration is production-safe

Rate limiting is intentionally deferred by current product decision and is not part of the Milestone 1 completion call for this branch.

### Milestone 2 - Backend Statelessness and Realtime Reliability

Goal: allow the backend to scale horizontally without losing correctness.

#### Backend

- [ ] Introduce Redis
- [ ] Move socket session tracking out of in-memory `Map`
- [ ] Move cross-instance presence state to Redis-backed coordination
- [ ] Add Socket.IO Redis adapter
- [ ] Make room membership and presence broadcasts work across multiple backend instances
- [ ] Add reconnect-safe session restoration behavior
- [ ] Remove assumptions that one server instance owns all room state
- [ ] Add health and readiness endpoints

#### Ops

- [ ] Define deployment shape for web/backend/mobile services
- [ ] Add environment separation for development, staging, production
- [ ] Add Redis provisioning and secret management

#### Exit Criteria

- Two backend instances can run simultaneously without broken presence or room fanout
- Restarts do not corrupt realtime state

### Milestone 3 - Message Persistence and Background Jobs

Goal: make chat storage and scheduling durable under concurrency and growth.

#### Backend

- [ ] Redesign message storage away from large mutable Firestore arrays
- [ ] Choose a stable storage model:
  - [ ] one message per document, or
  - [ ] partitioned message pages with constrained update patterns
- [ ] Add pagination cursors/indexes
- [ ] Preserve edits/deletes/reactions without full-array rewrites
- [ ] Create migration plan for legacy room data
- [ ] Move scheduled message execution out of in-process cron
- [ ] Introduce durable worker/queue processing backed by Redis
- [ ] Add idempotency for scheduled sends
- [ ] Add retry and failure handling for background jobs

#### Exit Criteria

- Message persistence no longer depends on rewriting large chat arrays
- Scheduled messages continue to work across restarts and multiple workers

### Milestone 4 - Mobile E2EE and AI Parity

Goal: mobile reaches the same privacy and AI baseline as web.

#### Mobile E2EE

- [x] Port web E2EE architecture to mobile
- [x] Generate and persist mobile device identity keys
- [x] Register mobile identity keys with backend
- [x] Generate and persist per-room mobile keys
- [x] Fetch room member public keys on mobile
- [x] Encrypt outbound mobile messages
- [x] Decrypt inbound mobile messages
- [x] Decrypt paginated chat history on mobile
- [ ] Handle missing-key and key-rotation states gracefully
- [x] Add E2EE initialization/loading UX

#### Mobile AI

- [x] Add AI assistant room creation/entry flow in mobile
- [x] Ensure mobile uses only backend-supported AI events
- [x] Match web AI summarize behavior
- [x] Match web smart replies behavior
- [x] Decide and document AI behavior for encrypted conversations

AI behavior for encrypted conversations: mobile disables AI summaries and smart replies when encrypted messages are present in the room.

#### Backend

- [ ] Verify backend E2EE endpoints support both clients consistently
- [ ] Remove or implement unsupported AI events referenced by clients

#### Exit Criteria

- Mobile can send and read encrypted messages in real rooms
- Mobile AI behavior matches web V1 behavior
- Room device keys are signed per device and verified against persisted device fingerprints before use

### Milestone 5 - Client Parity Cleanup and UX Completion

Goal: remove dead UI, align flows, and make the app feel intentionally finished.

Status: complete on June 3, 2026.

#### Mobile

- [x] Hide Calls tab
- [x] Hide call buttons in room header
- [x] Hide camera actions and camera CTA surfaces
- [x] Remove all "coming soon" v1 dead-end interactions
- [x] Keep only stable attachment paths visible
- [x] Finish unread count display
- [x] Ensure group management matches web
- [x] Ensure semantic search matches web
- [x] Ensure scheduled message flows match web

#### Web

- [x] Keep web focused on online authenticated use only
- [x] Remove any future-facing UI that is not in V1
- [x] Finish unread count handling
- [x] Verify responsive usability
- [x] Fix any string/encoding glitches

#### Shared

- [x] Normalize timestamps, presence labels, and error states
- [x] Normalize saved-message behavior
- [x] Normalize attachment behavior

#### Exit Criteria

- No dead-end "coming soon" UX remains in the shipped app
- Web and mobile present the same core features

### Milestone 6 - Notifications, Delivery State, and Reliability

Goal: make the app usable when users are not actively watching the room.

#### Backend

- [ ] Add message idempotency strategy
- [ ] Prevent duplicate sends on reconnect/retry
- [ ] Add unread count source-of-truth model
- [ ] Add push notification event pipeline

#### Mobile

- [ ] Add Android push notification handling
- [ ] Add foreground/background notification UX
- [ ] Open the right room from a notification tap

#### Web

- [ ] Decide whether web push/browser notifications are in V1
- [ ] If yes, implement browser notification flow
- [ ] If no, keep unread counts accurate in-app

#### Exit Criteria

- Users can miss the app for a while and still reliably see unread activity

### Milestone 7 - Config, Secrets, and Environment Hygiene

Goal: make environments reproducible and safe.

#### Shared

- [ ] Move all environment-specific values into env/config management
- [ ] Remove machine-specific URLs and local IPs from committed runtime config
- [ ] Add `.env.example` files per app where needed
- [ ] Separate dev/staging/prod backend URLs clearly
- [ ] Rotate secrets if required

#### Mobile

- [ ] Clean up Android/Expo config for production
- [ ] Remove dev-only packager assumptions

#### Web

- [ ] Verify all runtime config uses env-based values

#### Exit Criteria

- Fresh setup for each environment is documented and reproducible

### Milestone 8 - Testing, CI, and Observability

Goal: stop relying on manual hope.

#### Tests

- [ ] Add backend integration tests for:
  - [ ] auth/session
  - [ ] friend flows
  - [ ] room membership
  - [ ] group permissions
  - [ ] message send/edit/delete/reaction
  - [ ] scheduled messages
  - [ ] E2EE API flows
- [ ] Add web smoke/e2e tests for critical paths
- [ ] Add mobile happy-path e2e tests
- [ ] Add regression coverage for unread counts and notifications

#### CI

- [ ] Add CI workflow for:
  - [ ] install
  - [ ] lint
  - [ ] typecheck
  - [ ] test
  - [ ] build web
  - [ ] build backend
  - [ ] build mobile release validation as feasible

#### Observability

- [ ] Add structured logs
- [ ] Add error tracking for backend
- [ ] Add crash reporting for mobile
- [ ] Add frontend error reporting for web
- [ ] Add metrics and alerts for:
  - [ ] message failures
  - [ ] AI failures
  - [ ] worker failures
  - [ ] auth failures

#### Exit Criteria

- A broken build or major regression is caught before release
- Production failures are visible, not mysterious

### Milestone 9 - Android Release and Play Store Readiness

Goal: make mobile ready for a real external beta and store submission.

#### Mobile / Release

- [ ] Replace debug signing with real release signing
- [ ] Produce a Play-ready AAB
- [ ] Configure Play App Signing
- [ ] Clean up Android permissions to minimum necessary
- [ ] Verify versioning and upgrade behavior
- [ ] Validate release build on physical Android devices

#### Store Readiness

- [ ] Host privacy policy at a public URL
- [ ] Complete Play Console data safety details
- [ ] Add support contact details
- [ ] Prepare store screenshots and graphics
- [ ] Create internal testing track
- [ ] Run closed testing before broader release

#### Exit Criteria

- Android release build is signed correctly
- Play Console submission materials are complete

## Work Breakdown by Area

### Backend Workstream

- [ ] Security/authz hardening
- [ ] Redis integration
- [ ] Socket.IO multi-instance support
- [ ] Message storage redesign
- [ ] Queue/worker for scheduled messages
- [ ] Notification pipeline
- [ ] Rate limiting and abuse controls
- [ ] Health checks and observability
- [ ] Integration tests

### Web Workstream

- [ ] Keep V1 feature set aligned with mobile
- [ ] Finish unread counts
- [ ] Stabilize E2EE
- [ ] Stabilize AI flows
- [ ] Remove non-V1 UI
- [ ] Improve error/loading states
- [ ] Add smoke/e2e coverage

### Mobile Workstream

- [ ] Port E2EE from web
- [ ] Add AI assistant parity
- [ ] Remove calls/camera UI
- [ ] Finish scheduled/search/group parity
- [ ] Finish unread counts
- [ ] Add push notifications
- [ ] Android release setup
- [ ] Mobile e2e and device QA

### Ops Workstream

- [ ] Environment strategy
- [ ] Secrets management
- [ ] Redis provisioning
- [ ] Deployment topology
- [ ] Monitoring and alerting
- [ ] Release checklist

## First 12 PRs to Open

These are the smallest sensible slices to start with.

1. `docs: add v1 parity matrix and production plan`
2. `backend: enforce socket actor identity and group authz`
3. `backend: add rate limiting and hardened session config`
4. `backend: introduce redis and socket.io adapter`
5. `backend: add health checks and structured request logging`
6. `mobile: hide calls and camera v1 surfaces`
7. `mobile: add e2ee device identity and key bootstrap`
8. `mobile: add e2ee encrypt/decrypt message flow`
9. `mobile: add ai assistant room entry and parity polish`
10. `shared: implement unread count model`
11. `backend: move scheduled messages to durable worker`
12. `ci: add lint typecheck test build workflows`

## Weekly Review Template

Use this at the end of each week:

- What milestones moved forward?
- What release blockers remain?
- Did scope drift?
- Did parity improve or regress?
- Are there any security issues still open?
- Can the current branch be deployed to a staging environment?

## Definition of Done for V1

V1 is done when:

- Web and mobile provide the same agreed feature set
- Mobile E2EE is working and verified
- AI flows are consistent on both clients
- Calls and camera are absent from the shipped mobile experience
- Backend is safe to scale horizontally with Redis
- Scheduled messaging is durable
- Security and authorization gaps are closed
- Tests and CI cover the critical paths
- Android app is ready for Play distribution
