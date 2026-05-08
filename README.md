GemMiner Bot
A Playwright-powered automation bot for gemminer.app with a real-time React control dashboard.

The bot automatically completes missions, spins the wheel, and flips coins. The dashboard gives you live status, a bot-eye view of the browser, activity logs, and stats.

Features
Auto-completes missions, wheel spins, and coin flips
Headless Chromium browser controlled via Playwright
Real-time Bot Eye View — see exactly what the bot sees, refreshed every 3 seconds
WalletConnect support — QR code appears in the dashboard for mobile wallet scanning
Activity log with timestamps
Live stats: missions completed, wheel spins, coin flips, uptime
Stack
Backend: Node.js 24, Express 5, Playwright (Chromium)
Frontend: React, Vite, Tailwind v4 (dark neon-cyan theme)
API contract: OpenAPI spec → Orval codegen (React Query hooks + Zod schemas)
Monorepo: pnpm workspaces, TypeScript 5.9
Setup on Replit
1. Clone or upload the project
If using Replit Agent, paste this into your first message:

"Clone this repo and set it up: https://github.com/Goodluckigweze/geminer-bot — follow the SETUP.md inside."

Or manually in the Shell:

git clone https://github.com/Goodluckigweze/geminer-bot.git .

2. Install dependencies
pnpm install

3. Install the Playwright browser binary
cd artifacts/api-server && npx playwright install chromium && cd ../..

4. Add the required secret
In Replit → Secrets panel, add:

Key	Value
SESSION_SECRET	any long random string
5. Start the app
Replit will auto-start workflows from .replit. If not, run:

# API server (port 8080)
pnpm --filter @workspace/api-server run dev
# Dashboard (auto port)
pnpm --filter @workspace/dashboard run dev

Usage
Open the dashboard in the Replit preview pane
Click Initialize — the bot launches Chromium headlessly on the server
Watch Bot Eye View — it shows what the bot sees in real time
The bot clicks Connect Wallet automatically — scan the QR code with your mobile wallet (WalletConnect)
Once your wallet is connected, the bot detects it and starts automating the game loop
Project Structure
artifacts/
  api-server/         Express API + Playwright bot engine
    src/lib/bot.ts    Main bot logic
    src/routes/bot.ts REST API routes
  dashboard/          React + Vite frontend
    src/components/   BotStatusPanel, BotEyePanel, ActivityLogPanel, StatsPanel
lib/
  api-spec/           OpenAPI spec (source of truth)
  api-client-react/   Generated React Query hooks
  api-zod/            Generated Zod schemas

API Endpoints
Method	Path	Description
GET	/api/bot/status	Current bot state
POST	/api/bot/start	Launch the bot
POST	/api/bot/stop	Stop the bot
GET	/api/bot/logs	Activity log entries
GET	/api/bot/stats	Mission/spin/flip counts
GET	/api/bot/screenshot	Latest browser screenshot (PNG)
Regenerate API types
After changing lib/api-spec/openapi.yaml:

pnpm --filter @workspace/api-spec run codegen
