# Hoplio

Hoplio is an AI-powered communication platform for teams and communities that need fast, secure, and searchable conversations across web and mobile. It combines real-time messaging, group collaboration, end-to-end encryption, scheduled messages, semantic search, and an integrated AI assistant in one workspace.

## What Hoplio Does

Hoplio gives users a secure place to connect with friends, teammates, and groups while layering in AI features that make conversations easier to manage.

- Real-time direct and group messaging powered by Socket.IO
- Google/Firebase authentication with session-backed API and socket access
- End-to-end encrypted room setup with per-device identity keys and room keys
- Friend requests, room membership, user profiles, online presence, and last-seen status
- Message actions including reactions, editing, deletion, and starred/saved messages
- Scheduled and recurring messages with timezone-aware delivery
- Semantic search that finds messages by meaning, not only exact keywords
- AI assistant rooms with contextual replies and memory-backed conversation support
- AI summaries, sentiment analysis hooks, and smart reply generation
- File/image upload support through Firebase Storage
- Web and mobile clients sharing the same backend and real-time event model

## Product Surface

### Web App

The web client is a Next.js app with a polished chat workspace, Google sign-in, room sidebar, friend management, group creation, semantic search, scheduled messages, AI assistant access, dark mode, and responsive mobile-friendly layouts.

Path: `apps/web`

### Mobile App

The mobile client is an Expo/React Native app that brings the same Hoplio experience to Android and iOS. It includes secure room bootstrapping, offline-aware state, bottom-tab navigation, friends, profile settings, group creation, unread counts, and synchronized real-time events.

Path: `apps/mobile`

### Backend

The backend is an Express and Socket.IO service backed by Firebase Admin, Firestore, Firebase Storage, Redis-compatible realtime state, scheduled jobs, and AI integrations. It handles authenticated sessions, room authorization, websocket events, E2EE key management, search, scheduled delivery, presence, and AI assistant workflows.

Path: `apps/backend`

## Core Architecture

This repository is a pnpm/Turborepo monorepo.

```text
apps/
  backend/   Express, Socket.IO, Firebase Admin, scheduler, AI/search APIs
  web/       Next.js, React, Redux Toolkit, Tailwind, shadcn/Radix UI
  mobile/    Expo, React Native, Redux Toolkit, NativeWind

packages/
  eslint-config/
  tsconfig/
```

## Tech Stack

- Frontend: Next.js, React, Tailwind CSS, Radix UI, shadcn-style components
- Mobile: Expo, React Native, Expo Router, NativeWind, React Native Paper
- State: Redux Toolkit and React Redux
- Realtime: Socket.IO with optional Redis adapter support
- Auth and data: Firebase Auth, Firebase Admin, Firestore, Firebase Storage
- Security: session cookies, room-level authorization, E2EE identity and room key APIs
- AI: Google Gemini, Zep memory, semantic embeddings
- Tooling: pnpm workspaces, Turborepo, TypeScript, ESLint

## Getting Started

### Prerequisites

- Node.js
- pnpm 10
- Firebase project credentials for the backend
- Optional AI/search credentials depending on the features you run locally

### Install Dependencies

```bash
pnpm install
```

### Configure the Backend

Create a backend environment file from the example:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Fill in the Firebase service account values and any optional integration keys you need:

- `PROJECT_ID`
- `PRIVATE_KEY_ID`
- `PRIVATE_KEY`
- `CLIENT_EMAIL`
- `CLIENT_ID`
- `ZEP_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `REDIS_URL`

### Run the Apps

Run everything through Turborepo:

```bash
pnpm dev
```

Or run individual apps:

```bash
pnpm dev:backend
pnpm dev:web
pnpm dev:mobile
```

Useful package-level commands:

```bash
pnpm --filter @hoplio/backend start
pnpm --filter @hoplio/backend test
pnpm --filter @hoplio/web dev
pnpm --filter @hoplio/mobile start
```

## Quality Checks

From the repo root:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

The backend also includes focused Node test coverage for router auth, socket auth, group auth, and E2EE fingerprint behavior.

## Positioning

Hoplio is designed for users who want the speed of consumer messaging with the control and intelligence expected from a SaaS collaboration platform. It is private by default, live by design, and enhanced by AI where it helps most: retrieving context, summarizing conversation history, suggesting replies, and providing a dedicated assistant inside the chat workflow.
