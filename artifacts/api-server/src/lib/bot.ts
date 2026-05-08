import { chromium, type Browser, type Page } from "playwright";
import path from "path";
import fs from "fs";
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

const SCREENSHOT_PATH = path.join(process.cwd(), "dist", "bot-screen.png");
const CLICK_TIMEOUT = 2000;
const NAV_TIMEOUT = 8000;

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

export function getScreenshotPath(): string {
  return SCREENSHOT_PATH;
}

async function takeScreenshot(): Promise<void> {
  if (!page) return;
  try {
    const dir = path.dirname(SCREENSHOT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH, timeout: 5000 });
  } catch {
    // ignore screenshot errors
  }
}

// Try to click a locator — returns true if clicked, false if not found/visible
async function tryClick(selector: string, description: string): Promise<boolean> {
  if (!page) return false;
  try {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: "visible", timeout: CLICK_TIMEOUT });
    await loc.click({ timeout: CLICK_TIMEOUT });
    addLog("info", `Clicked: ${description}`);
    return true;
  } catch {
    return false;
  }
}

// Get all visible text content on page for debugging
async function getVisibleText(): Promise<string> {
  if (!page) return "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await page.evaluate((): string => {
      // runs in browser context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (globalThis as any).document as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const visible: string[] = Array.from(d.querySelectorAll(
        "button, a, [role='button'], [class*='tab'], [class*='nav'], [class*='btn']"
      ) as any[])
        .filter((el: any) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((el: any) => (el.textContent ?? "").trim())
        .filter((t: string) => t.length > 0)
        .slice(0, 30);
      return visible.join(" | ");
    });
  } catch {
    return "";
  }
}

// Get all visible buttons/links for smart interaction
async function getVisibleButtons(): Promise<Array<{ text: string }>> {
  if (!page) return [];
  try {
    return await page.evaluate((): Array<{ text: string }> => {
      // runs in browser context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (globalThis as any).document as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = (globalThis as any).window as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (Array.from(d.querySelectorAll("button, a, [role='button']") as any[]) as any[])
        .filter((el: any) => {
          const rect = el.getBoundingClientRect();
          const style = w.getComputedStyle(el);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
          );
        })
        .map((el: any) => ({ text: (el.textContent ?? "").trim().slice(0, 50) }))
        .filter((b: { text: string }) => b.text.length > 0)
        .slice(0, 20);
    });
  } catch {
    return [];
  }
}

// Navigate to a game section by clicking nav tabs
async function navigateToSection(sectionKeywords: string[]): Promise<boolean> {
  if (!page) return false;
  for (const keyword of sectionKeywords) {
    const lower = keyword.toLowerCase();
    // Try various tab/nav selectors
    const selectors = [
      `button:has-text("${keyword}")`,
      `a:has-text("${keyword}")`,
      `[class*="tab"]:has-text("${keyword}")`,
      `[class*="nav"]:has-text("${keyword}")`,
      `[title="${keyword}"]`,
      `[aria-label="${keyword}"]`,
      `[class*="${lower}"]`,
    ];
    for (const sel of selectors) {
      if (await tryClick(sel, `Navigate to ${keyword}`)) {
        await page.waitForTimeout(1500);
        return true;
      }
    }
  }
  return false;
}

async function dismissDialogs(): Promise<void> {
  if (!page) return;
  const dismissors = [
    'text="Tap to continue"',
    '[class*="tap-continue"]',
    '[class*="dialog-close"]',
    '[class*="modal-close"]',
    'button[class*="close"]',
    '[aria-label="Close"]',
    '[class*="overlay"]:has-text("continue")',
  ];
  for (const sel of dismissors) {
    await tryClick(sel, "Dismiss dialog");
  }
}

async function tryMissions(): Promise<void> {
  if (!page) return;
  setStatus({ currentAction: "Checking missions..." });
  addLog("info", "Navigating to missions...");
  await takeScreenshot();

  await navigateToSection(["Mission", "Missions", "MISSIONS"]);
  await page.waitForTimeout(2000);
  await takeScreenshot();

  // Dump visible elements for debugging
  const visible = await getVisibleText();
  if (visible) addLog("info", `Visible elements: ${visible.slice(0, 120)}`);

  // Try to click any action buttons in the mission section
  const claimSelectors = [
    'button:has-text("Claim")',
    'button:has-text("claim")',
    'button:has-text("CLAIM")',
    'button:has-text("Complete")',
    'button:has-text("Start")',
    'button:has-text("Mine")',
    'button:has-text("MINE")',
    'button:has-text("Collect")',
    'button:has-text("Go")',
    '[class*="claim"]:not([disabled])',
    '[class*="mission-btn"]',
    '[class*="collect"]',
  ];

  let claimed = false;
  for (const sel of claimSelectors) {
    try {
      const locs = page.locator(sel);
      const count = await locs.count();
      for (let i = 0; i < Math.min(count, 5); i++) {
        const loc = locs.nth(i);
        try {
          const isVisible = await loc.isVisible();
          const isEnabled = await loc.isEnabled();
          if (isVisible && isEnabled) {
            await loc.click({ timeout: CLICK_TIMEOUT });
            await page.waitForTimeout(1000);
            stats.missionsCompleted++;
            stats.actionsTotal++;
            claimed = true;
            addLog("success", "Completed a mission!");
            await takeScreenshot();
            await dismissDialogs();
          }
        } catch {
          // ignore individual click failures
        }
      }
    } catch {
      // ignore selector errors
    }
  }

  if (!claimed) {
    addLog("info", "No claimable missions found this cycle.");
  }
}

async function tryWheel(): Promise<void> {
  if (!page) return;
  setStatus({ currentAction: "Trying wheel spin..." });
  addLog("info", "Navigating to wheel...");

  await navigateToSection(["Wheel", "WHEEL", "Spin"]);
  await page.waitForTimeout(2000);
  await takeScreenshot();

  const spinSelectors = [
    'button:has-text("Spin")',
    'button:has-text("SPIN")',
    'button:has-text("spin")',
    '[class*="spin-btn"]',
    '[class*="spin_btn"]',
    '[class*="wheel-btn"]',
    '[class*="spinButton"]',
  ];

  for (const sel of spinSelectors) {
    try {
      const loc = page.locator(sel).first();
      const isVisible = await loc.isVisible().catch(() => false);
      const isEnabled = await loc.isEnabled().catch(() => false);
      if (isVisible && isEnabled) {
        await loc.click({ timeout: CLICK_TIMEOUT });
        await page.waitForTimeout(4000); // wait for spin animation
        stats.wheelSpins++;
        stats.actionsTotal++;
        addLog("success", "Spun the wheel!");
        await takeScreenshot();
        await dismissDialogs();
        return;
      }
    } catch {
      // try next
    }
  }
  addLog("info", "Wheel spin not available this cycle.");
}

async function tryCoinflip(): Promise<void> {
  if (!page) return;
  setStatus({ currentAction: "Trying coinflip..." });
  addLog("info", "Navigating to coinflip...");

  await navigateToSection(["Coinflip", "COINFLIP", "Coin", "coin"]);
  await page.waitForTimeout(2000);
  await takeScreenshot();

  // Pick a side first
  const sideSelectors = [
    'button:has-text("Heads")',
    'button:has-text("HEADS")',
    'button:has-text("Tails")',
    'button:has-text("TAILS")',
    '[class*="heads"]',
    '[class*="tails"]',
  ];
  for (const sel of sideSelectors) {
    const ok = await tryClick(sel, "Select coin side");
    if (ok) {
      await page.waitForTimeout(500);
      break;
    }
  }

  // Now flip
  const flipSelectors = [
    'button:has-text("Flip")',
    'button:has-text("FLIP")',
    'button:has-text("flip")',
    '[class*="flip-btn"]',
    '[class*="flipButton"]',
    '[class*="coinflip-btn"]',
  ];

  for (const sel of flipSelectors) {
    try {
      const loc = page.locator(sel).first();
      const isVisible = await loc.isVisible().catch(() => false);
      const isEnabled = await loc.isEnabled().catch(() => false);
      if (isVisible && isEnabled) {
        await loc.click({ timeout: CLICK_TIMEOUT });
        await page.waitForTimeout(3000);
        stats.coinFlips++;
        stats.actionsTotal++;
        addLog("success", "Flipped a coin!");
        await takeScreenshot();
        await dismissDialogs();
        return;
      }
    } catch {
      // try next
    }
  }
  addLog("info", "Coinflip not available this cycle.");
}

async function gameLoop(): Promise<void> {
  if (status.state !== "running" || !page) return;

  try {
    setStatus({ currentAction: "Starting action cycle..." });
    await dismissDialogs();
    await page.waitForTimeout(1000);

    // Screenshot at loop start for debugging
    await takeScreenshot();

    await tryMissions();
    if (status.state !== "running") return;

    await tryWheel();
    if (status.state !== "running") return;

    await tryCoinflip();
    if (status.state !== "running") return;

    await takeScreenshot();
    setStatus({ currentAction: "Waiting for next cycle (30s)..." });
    addLog("info", "Cycle complete. Next round in 30 seconds.");

    if (status.state === "running") {
      loopTimer = setTimeout(() => {
        gameLoop().catch((err) => {
          addLog("error", `Game loop error: ${String(err)}`);
          logger.error({ err }, "Game loop crashed");
          setStatus({ state: "error", message: `Loop crashed: ${String(err)}`, currentAction: null });
        });
      }, 30000);
    }
  } catch (err) {
    const msg = String(err);
    // If the page closed, it means bot was stopped — don't mark as error
    if (msg.includes("Target page") || msg.includes("browser has been closed")) {
      addLog("info", "Browser closed — bot stopped.");
      return;
    }
    addLog("error", `Game loop error: ${msg}`);
    logger.error({ err }, "Game loop error");
    setStatus({ state: "error", message: `Error: ${msg}`, currentAction: null });
  }
}

async function checkWalletConnected(): Promise<boolean> {
  if (!page) return false;
  try {
    // Check if we're past the landing page by looking for in-game nav elements
    const inGame = await page.evaluate((): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (globalThis as any).document as any;
      const text = (d.body.innerText as string).toLowerCase();
      return (
        text.includes("mission") ||
        text.includes("earning") ||
        text.includes("wheel") ||
        text.includes("coinflip") ||
        text.includes("forge")
      );
    });
    // Make sure "Enter the Mines" button is NOT still visible
    const enterBtn = page.locator('button:has-text("Enter the Mines"), button:has-text("ENTER THE MINES")').first();
    const enterVisible = await enterBtn.isVisible().catch(() => false);
    return inGame && !enterVisible;
  } catch {
    return false;
  }
}

async function cleanupBrowser(): Promise<void> {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
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
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    // Set default timeouts
    context.setDefaultTimeout(NAV_TIMEOUT);
    context.setDefaultNavigationTimeout(NAV_TIMEOUT);

    page = await context.newPage();

    addLog("info", "Navigating to gemminer.app...");
    setStatus({ currentAction: "Loading game..." });

    await page.goto("https://www.gemminer.app/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);
    await takeScreenshot();

    // Try to click "Connect Wallet" first so the WalletConnect popup appears
    const walletBtnClicked = await tryClick(
      [
        'button:has-text("Connect Wallet")',
        'button:has-text("CONNECT WALLET")',
        'button:has-text("Connect")',
        'a:has-text("Connect Wallet")',
        '[class*="connect"][class*="wallet"]',
        '[data-testid*="connect"]',
      ].join(", "),
      "Connect Wallet"
    );

    if (walletBtnClicked) {
      addLog("info", "Wallet connect popup triggered — check the Bot Eye View for the QR code.");
      await page.waitForTimeout(2000);
      await takeScreenshot();
    } else {
      // Fall back to free exploration if no wallet button found
      const freeEntered = await tryClick(
        'button:has-text("EXPLORE THE MINE FREE"), a:has-text("EXPLORE THE MINE FREE"), button:has-text("Explore")',
        "Enter free exploration"
      );
      if (freeEntered) {
        addLog("info", "Entered free exploration mode. Waiting for game to load...");
        await page.waitForTimeout(3000);
        await takeScreenshot();
      }
    }

    addLog("info", "Scan the QR code in Bot Eye View, or connect your wallet — bot will detect it automatically.");
    setStatus({
      state: "waiting_for_wallet",
      message: "Connect your wallet in the browser window, then the bot will start automatically.",
      currentAction: "Waiting for wallet connection (or free mode active)",
    });

    // Poll for wallet connection or game state
    let walletConnected = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds
    const getState = (): BotState => status.state;

    while (!walletConnected && attempts < maxAttempts && (getState() === "waiting_for_wallet" || getState() === "starting")) {
      try {
        await page.waitForTimeout(1000);
      } catch {
        // Browser was closed (bot was stopped) — exit cleanly
        return { success: false, message: "Bot stopped" };
      }
      walletConnected = await checkWalletConnected();
      attempts++;
      // Take a screenshot every 3s so the dashboard Bot Eye View stays current
      if (attempts % 3 === 0) {
        await takeScreenshot();
      }
      if (attempts % 10 === 0) {
        addLog("info", `Waiting for wallet connection... (${attempts}s) — check Bot Eye View for QR code`);
      }
    }

    if (getState() !== "waiting_for_wallet" && getState() !== "running") {
      return { success: false, message: "Bot stopped while waiting" };
    }

    // Even if wallet not detected, try to proceed if we can see game elements
    const buttons = await getVisibleButtons();
    addLog("info", `Game buttons visible: ${buttons.map((b) => b.text).join(", ").slice(0, 150)}`);

    stats.sessionStartedAt = new Date().toISOString();
    setStatus({
      state: "running",
      message: "Bot is running the automation loop.",
      currentAction: "Starting game loop",
    });
    addLog("success", "Bot is now running!");

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
