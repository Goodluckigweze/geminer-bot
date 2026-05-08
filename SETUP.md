# GemMiner Bot — New Replit Setup Guide

Follow these steps after uploading this project to a new Replit account.

---

## 1. Create the Replit project

1. Go to [replit.com](https://replit.com) and create a new **Blank Repl** (Node.js template works fine)
2. Upload this archive: click the three-dot menu in the Files panel → **Upload file** → select `gemminer-bot-export.tar.gz`
3. In the Replit Shell, extract it:
   ```bash
   tar -xzf gemminer-bot-export.tar.gz
   ```

---

## 2. Install dependencies

```bash
pnpm install
```

---

## 3. Install Playwright's Chromium browser

```bash
cd artifacts/api-server && npx playwright install chromium && cd ../..
```

This downloads the Chromium binary used by the bot (~170MB).

---

## 4. Set the required secret

In Replit → **Secrets** (lock icon in left sidebar), add:

| Key | Value |
|-----|-------|
| `SESSION_SECRET` | any long random string, e.g. `my-super-secret-key-12345` |

---

## 5. Start the workflows

Replit should auto-detect the `.replit` config and start both workflows. If not, run manually:

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Dashboard (auto-assigned port)
pnpm --filter @workspace/dashboard run dev
```

---

## 6. Using the bot

1. Open the dashboard in the Replit preview pane
2. Click **Initialize** — Chromium launches headlessly on the server
3. Watch **Bot Eye View** in the dashboard — it refreshes every 3 seconds showing what the bot sees
4. The bot clicks **Connect Wallet** automatically. Use the QR code shown in Bot Eye View to connect via WalletConnect on your phone
5. Once connected, the bot starts automating missions, wheel spins, and coinflips automatically

---

## Stack reference

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `artifacts/api-server/src/lib/bot.ts` — Playwright bot engine
- `artifacts/api-server/src/routes/bot.ts` — REST API routes
- `artifacts/dashboard/src/` — React dashboard

## Regenerate API types after any spec change

```bash
pnpm --filter @workspace/api-spec run codegen
```
