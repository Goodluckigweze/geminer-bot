import { chromium, type Browser, type Page } from "playwright";
import { logger } from "./logger";

export type BotState =
  | "idle"
  | "starting"
  | "waiting_for_wallet"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface BotStats {
  missionsCompleted: number;
  wheelSpins: number;
  coinFlips: number;
  actionsTotal: number;
  sessionStartedAt: string | null;
  uptime: number | null;
}

export interface BotStatus {
  state: BotState;
  message: string;
  startedAt: string | null;
  stoppedAt: string | null;
  currentAction: string | null;
}

let browser: Browser | null = null;
let page: Page | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let walletCheckTimer: ReturnType<typeof setInterval> | null = null;

let logId = 0;
const logs: LogEntry[] = [];

const stats: BotStats = {
  missionsCompleted: 0,
  wheelSpins: 0,
  coinFlips: 0,
  actionsTotal: 0,
  sessionStartedAt: null,
  uptime: null,
};

let status: BotStatus = {
  state: "idle",
  message: "Bot is idle. Click Start to begin.",
  startedAt: null,
  stoppedAt: null,
  currentAction: null,
};

function addLog(level: LogEntry["level"], message: string): void {
  const entry: LogEntry = {
    id: ++logId,
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  logs.unshift(entry);
  if (logs.length > 200) logs.splice(200);
  logger.info({ level, message }, "Bot log");
}

function setStatus(update: Partial<BotStatus>): void {
  status = { ...status, ...update };
}

export function getBotStatus(): BotStatus {
  return { ...status };
}

export function getBotLogs(limit = 50): LogEntry[] {
  return logs.slice(0, limit);
}

export function getBotStats(): BotStats {
  if (stats.sessionStartedAt && status.state === "running") {
    stats.uptime = Math.floor(
      (Date.now() - new Date(stats.sessionStartedAt).getTime()) / 1000
    );
  }
  return { ...stats };
}

async function safeClick(selector: string, description: string): Promise<boolean> {
  if (!page) return false;
  try {
    const el = await page.$(selector);
    if (el) {
      await el.click();
      addLog("info", `Clicked: ${description}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function tryMissions(): Promise<void> {
  if (!page) return;
  setStatus({ currentAction: "Checking missions..." });
  addLog("info", "Looking for mission opportunities...");

  try {
    // Navigate to missions tab if present
    const missionTab = await page.$('[data-tab="missions"], button:has-text("Missions"), [class*="mission"]');
    if (missionTab) {
      await missionTab.click();
      await page.waitForTimeout(1500);
    }

    // Try clicking any "claim" or "complete" or "start" buttons in missions
    const claimSelectors = [
      'button:has-text("Claim")',
      'button:has-text("Complete")',
      'button:has-text("Start Mission")',
      'button:has-text("Mine")',
      '[class*="claim"]',
      '[class*="complete-btn"]',
    ];

    let claimed = false;
    for (const sel of claimSelectors) {
      try {
        const buttons = await page.$$(sel);
        for (const btn of buttons) {
          const isVisible = await btn.isVisible();
          if (isVisible) {
            await btn.click();
            await page.waitForTimeout(800);
            stats.missionsCompleted++;
            stats.actionsTotal++;
            claimed = true;
            addLog("success", "Completed a mission!");
          }
        }
      } catch {
        // ignore
      }
    }

    if (!claimed) {
      addLog("info", "No missions available right now.");
    }
  } catch (err) {
    addLog("warning", `Mission check failed: ${String(err)}`);
  }
}

async function tryWheel(): Promise<void> {
  if (!page) return;
  setStatus({ currentAction: "Trying wheel spin..." });

  try {
    // Look for wheel tab or button
    const wheelTab = await page.$('button:has-text("Wheel"), [data-tab="wheel"], [class*="wheel"]');
    if (wheelTab) {
      await wheelTab.click();
      await page.waitForTimeout(1500);
    }

    const spinBtn = await page.$('button:has-text("Spin"), [class*="spin-btn"], [class*="spin_btn"]');
    if (spinBtn) {
      const isVisible = await spinBtn.isVisible();
      const isEnabled = await spinBtn.isEnabled();
      if (isVisible && isEnabled) {
        await spinBtn.click();
        await page.waitForTimeout(3000);
        stats.wheelSpins++;
        stats.actionsTotal++;
        addLog("success", "Spun the wheel!");
        return;
      }
    }
    addLog("info", "Wheel not available or already spun.");
  } catch (err) {
    addLog("warning", `Wheel attempt failed: ${String(err)}`);
  }
}

async function tryCoinflip(): Promise<void> {
  if (!page) return;
  setStatus({ currentAction: "Trying coinflip..." });

  try {
    const coinTab = await page.$('button:has-text("Coinflip"), button:has-text("Coin"), [data-tab="coinflip"]');
    if (coinTab) {
      await coinTab.click();
      await page.waitForTimeout(1500);
    }

    // Click heads or tails
    const headsBtn = await page.$('button:has-text("Heads"), button:has-text("heads")');
    if (headsBtn && await headsBtn.isVisible()) {
      await headsBtn.click();
      await page.waitForTimeout(500);
    }

    const flipBtn = await page.$('button:has-text("Flip"), button:has-text("flip")');
    if (flipBtn && await flipBtn.isVisible() && await flipBtn.isEnabled()) {
      await flipBtn.click();
      await page.waitForTimeout(2000);
      stats.coinFlips++;
      stats.actionsTotal++;
      addLog("success", "Flipped a coin!");
      return;
    }
    addLog("info", "Coinflip not available.");
  } catch (err) {
    addLog("warning", `Coinflip attempt failed: ${String(err)}`);
  }
}

async function dismissDialogs(): Promise<void> {
  if (!page) return;
  try {
    // Dismiss any modal/popup by clicking "tap to continue" or close buttons
    const dismissSelectors = [
      '[class*="tap-to-continue"]',
      'text=Tap to continue',
      '[class*="close"]',
      '[aria-label="Close"]',
    ];
    for (const sel of dismissSelectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          await el.click();
          await page.waitForTimeout(500);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

async function checkWalletConnected(): Promise<boolean> {
  if (!page) return false;
  try {
    // Check if user has wallet connected by looking for wallet-gated content
    // or absence of "Connect Wallet" button
    const connectBtn = await page.$('button:has-text("Connect"), button:has-text("Enter the Mines")');
    if (connectBtn) {
      const text = await connectBtn.innerText();
      // If there's an "Enter the Mines" button, wallet may not be connected yet
      // We look for game UI that indicates we're inside the game
      const inGame = await page.$('[class*="mine"], [class*="mission"], [class*="earn"]');
      return !!inGame;
    }
    // If no connect button, assume connected
    return true;
  } catch {
    return false;
  }
}

async function gameLoop(): Promise<void> {
  if (status.state !== "running" || !page) return;

  try {
    setStatus({ currentAction: "Dismissing dialogs..." });
    await dismissDialogs();

    // Rotate through game actions
    await tryMissions();
    await page.waitForTimeout(2000);

    if (status.state !== "running") return;

    await tryWheel();
    await page.waitForTimeout(2000);

    if (status.state !== "running") return;

    await tryCoinflip();
    await page.waitForTimeout(2000);

    setStatus({ currentAction: "Waiting for next cycle..." });
    addLog("info", "Cycle complete. Waiting 30s before next round...");

    if (status.state === "running") {
      loopTimer = setTimeout(() => {
        gameLoop().catch((err) => {
          addLog("error", `Game loop error: ${String(err)}`);
          logger.error({ err }, "Game loop crashed");
        });
      }, 30000);
    }
  } catch (err) {
    addLog("error", `Game loop error: ${String(err)}`);
    logger.error({ err }, "Game loop error");
    setStatus({ state: "error", message: `Error: ${String(err)}`, currentAction: null });
  }
}

export async function startBot(): Promise<{ success: boolean; message: string }> {
  if (status.state === "running" || status.state === "starting") {
    return { success: false, message: "Bot is already running" };
  }

  // Reset stats
  stats.missionsCompleted = 0;
  stats.wheelSpins = 0;
  stats.coinFlips = 0;
  stats.actionsTotal = 0;
  stats.sessionStartedAt = null;
  stats.uptime = null;

  setStatus({
    state: "starting",
    message: "Launching browser...",
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    currentAction: "Launching browser",
  });
  addLog("info", "Starting GemMiner bot...");

  try {
    browser = await chromium.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    page = await context.newPage();

    addLog("info", "Navigating to gemminer.app...");
    setStatus({ currentAction: "Navigating to game..." });

    await page.goto("https://www.gemminer.app/", { waitUntil: "domcontentloaded", timeout: 30000 });

    addLog("info", "Game loaded. Waiting for wallet connection...");
    setStatus({
      state: "waiting_for_wallet",
      message: "Please connect your wallet in the browser window to continue.",
      currentAction: "Waiting for wallet connection",
    });

    // Poll until wallet is connected or bot is stopped
    let walletConnected = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes

    while (!walletConnected && attempts < maxAttempts && status.state === "waiting_for_wallet") {
      await page.waitForTimeout(1000);
      walletConnected = await checkWalletConnected();
      attempts++;

      if (attempts % 10 === 0) {
        addLog("info", `Still waiting for wallet... (${attempts}s elapsed)`);
      }
    }

    if (status.state !== "waiting_for_wallet") {
      // Bot was stopped while waiting
      return { success: false, message: "Bot stopped while waiting for wallet" };
    }

    if (!walletConnected) {
      // Try entering without wallet — explore free mode
      addLog("warning", "Wallet not connected. Trying free exploration mode...");
      await safeClick('button:has-text("EXPLORE THE MINE FREE"), a:has-text("EXPLORE")', "Explore free");
      await page.waitForTimeout(2000);
    } else {
      addLog("success", "Wallet connected! Entering the mines...");
      await safeClick('button:has-text("Enter the Mines")', "Enter Mines");
      await page.waitForTimeout(2000);
    }

    stats.sessionStartedAt = new Date().toISOString();
    setStatus({
      state: "running",
      message: "Bot is running the automation loop.",
      currentAction: "Starting game loop",
    });
    addLog("success", "Bot is now running! Starting automation loop...");

    // Start the game loop
    await gameLoop();

    return { success: true, message: "Bot started successfully" };
  } catch (err) {
    const msg = `Failed to start: ${String(err)}`;
    addLog("error", msg);
    logger.error({ err }, "Bot start failed");
    setStatus({
      state: "error",
      message: msg,
      currentAction: null,
    });
    await cleanupBrowser();
    return { success: false, message: msg };
  }
}

async function cleanupBrowser(): Promise<void> {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
  if (walletCheckTimer) {
    clearInterval(walletCheckTimer);
    walletCheckTimer = null;
  }
  if (browser) {
    try {
      await browser.close();
    } catch {
      // ignore
    }
    browser = null;
    page = null;
  }
}

export async function stopBot(): Promise<void> {
  if (status.state === "idle" || status.state === "stopped") return;

  addLog("info", "Stopping bot...");
  setStatus({
    state: "stopping",
    message: "Stopping bot...",
    currentAction: "Shutting down",
  });

  await cleanupBrowser();

  setStatus({
    state: "stopped",
    message: "Bot stopped.",
    stoppedAt: new Date().toISOString(),
    currentAction: null,
  });
  addLog("info", "Bot stopped successfully.");
}
