# GemMiner Bot Dashboard

A Playwright-powered automation bot for gemminer.app with a real-time control dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/dashboard run dev` — run the dashboard (port 23183)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Bot: Playwright (Chromium)
- Frontend: React + Vite + Tailwind v4
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `artifacts/api-server/src/lib/bot.ts` — Playwright bot engine
- `artifacts/api-server/src/routes/bot.ts` — Bot REST API routes
- `artifacts/dashboard/src/` — React dashboard frontend
- `artifacts/dashboard/src/components/` — BotStatusPanel, ActivityLogPanel, StatsPanel

## Architecture decisions

- Bot runs inside the Express API server process using Playwright (Chromium)
- Bot state is held in-memory (no DB needed — session-scoped)
- Dashboard polls the API every 2-5s for live status updates
- Bot uses `headless: false` so you can watch it work and interact with wallet prompts
- Playwright browser binary stored at `.cache/ms-playwright/`

## Product

- Start/stop a Playwright browser bot that automates gemminer.app
- Bot automatically completes missions, spins the wheel, and flips coins
- Real-time dashboard shows current action, activity log, and stats (missions, spins, flips, uptime)
- Wallet connection is done manually by the user in the launched browser window

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Playwright browser binary must be installed: `cd artifacts/api-server && npx playwright install chromium`
- The bot runs `headless: false` — it opens a real browser window so you can connect your wallet
- After connecting wallet in the browser, the bot takes over automatically
- GemMiner may update its UI selectors — update `bot.ts` if actions stop working

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
