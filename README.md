# Chatify Monorepo

This directory is the new monorepo shell for Chatify.

## Planning

- V1 production execution plan: [V1_PRODUCTION_PLAN.md](/C:/Users/aniru/OneDrive/Desktop/own/chatify/chatify/V1_PRODUCTION_PLAN.md)

## Structure

- `apps/backend`
- `apps/web`
- `apps/mobile`
- `packages/types`
- `packages/config`
- `packages/api-client`
- `packages/eslint-config`
- `packages/tsconfig`

## Quick Start

1. Install dependencies
   - `pnpm install`
2. Run all dev tasks
   - `pnpm dev`
3. Run by app (after app imports)
   - `pnpm --filter @chatify/backend start`
   - `pnpm --filter @chatify/web dev`
   - `pnpm --filter @chatify/mobile start`

## Next Step

Import existing repos with history into:
- `apps/backend` from `chatify-backend`
- `apps/web` from `chatify-next`
- `apps/mobile` from `chatify-rne`
