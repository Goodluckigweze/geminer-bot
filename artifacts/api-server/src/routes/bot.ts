import { Router, type IRouter } from "express";
import {
  GetBotStatusResponse,
  GetBotLogsResponse,
  GetBotLogsQueryParams,
  GetBotStatsResponse,
} from "@workspace/api-zod";
import { getBotStatus, getBotLogs, getBotStats, startBot, stopBot } from "../lib/bot";

const router: IRouter = Router();

router.get("/bot/status", async (_req, res): Promise<void> => {
  const status = getBotStatus();
  res.json(GetBotStatusResponse.parse(status));
});

router.post("/bot/start", async (req, res): Promise<void> => {
  const current = getBotStatus();
  if (current.state === "running" || current.state === "starting") {
    res.status(409).json({ error: "Bot is already running" });
    return;
  }

  // Start bot in background — don't await the whole thing
  startBot().catch((err) => {
    req.log.error({ err }, "Bot start background error");
  });

  // Return immediately with starting status
  await new Promise((r) => setTimeout(r, 200));
  const status = getBotStatus();
  res.json(GetBotStatusResponse.parse(status));
});

router.post("/bot/stop", async (_req, res): Promise<void> => {
  await stopBot();
  const status = getBotStatus();
  res.json(GetBotStatusResponse.parse(status));
});

router.get("/bot/logs", async (req, res): Promise<void> => {
  const parsed = GetBotLogsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const logs = getBotLogs(limit);
  res.json(GetBotLogsResponse.parse(logs));
});

router.get("/bot/stats", async (_req, res): Promise<void> => {
  const stats = getBotStats();
  res.json(GetBotStatsResponse.parse(stats));
});

export default router;
