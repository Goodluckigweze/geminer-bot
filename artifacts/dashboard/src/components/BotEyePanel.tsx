import { useGetBotStatus, getGetBotStatusQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function BotEyePanel() {
  const { data: status } = useGetBotStatus({ query: { queryKey: getGetBotStatusQueryKey(), refetchInterval: 2000 } });
  const [imgSrc, setImgSrc] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive =
    status?.state === "running" ||
    status?.state === "starting" ||
    status?.state === "waiting_for_wallet";

  const refreshScreenshot = () => {
    const ts = Date.now();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${base}/api/bot/screenshot?t=${ts}`;
    const img = new Image();
    img.onload = () => {
      setImgSrc(url);
      setLastUpdated(new Date());
      setError(false);
    };
    img.onerror = () => {
      setError(true);
    };
    img.src = url;
  };

  useEffect(() => {
    if (isActive) {
      refreshScreenshot();
      intervalRef.current = setInterval(refreshScreenshot, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  return (
    <Card className="border-primary/30 bg-card/80 backdrop-blur-sm flex flex-col scanline">
      <CardHeader className="pb-2 border-b border-primary/10">
        <CardTitle className="text-sm font-bold tracking-tight uppercase text-primary flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Bot Eye View
          </span>
          {lastUpdated && (
            <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 flex flex-col items-center justify-center min-h-[180px]">
        {imgSrc && !error ? (
          <img
            src={imgSrc}
            alt="Bot browser view"
            className="w-full rounded border border-primary/20 object-contain"
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs font-mono py-8">
            <Eye className="w-8 h-8 opacity-20" />
            {isActive ? (
              <span className="animate-pulse">Waiting for first frame...</span>
            ) : (
              <span className="opacity-50">Start the bot to see its view</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
