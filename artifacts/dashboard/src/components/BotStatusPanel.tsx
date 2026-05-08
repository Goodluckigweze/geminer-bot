import { useQueryClient } from "@tanstack/react-query";
import { Play, Square, Activity, AlertTriangle, Loader2 } from "lucide-react";
import { 
  useGetBotStatus, 
  useLaunchBot, 
  useStopBot,
  getGetBotStatusQueryKey,
  getGetBotLogsQueryKey,
  getGetBotStatsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function BotStatusPanel() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetBotStatus({
    query: { queryKey: getGetBotStatusQueryKey(), refetchInterval: 2000 }
  });

  const launchBot = useLaunchBot();
  const stopBot = useStopBot();

  const handleLaunch = () => {
    launchBot.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBotLogsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBotStatsQueryKey() });
      }
    });
  };

  const handleStop = () => {
    stopBot.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBotLogsQueryKey() });
      }
    });
  };

  const isRunning = status?.state === "running";
  const isStarting = status?.state === "starting" || status?.state === "waiting_for_wallet";
  const isIdle = status?.state === "idle" || status?.state === "stopped";
  const isError = status?.state === "error";

  const getStatusColor = (state?: string) => {
    switch(state) {
      case "running": return "bg-primary text-primary-foreground neon-glow";
      case "starting":
      case "waiting_for_wallet": return "bg-yellow-500 text-black";
      case "error": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="border-primary/30 bg-card/80 backdrop-blur-sm scanline">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold tracking-tight uppercase text-primary neon-text-glow flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System Status
        </CardTitle>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
          <Badge variant="outline" className={`uppercase font-bold tracking-wider ${getStatusColor(status?.state)}`}>
            {status?.state || "UNKNOWN"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Current Action</div>
          <div className="font-mono text-sm min-h-[40px] p-3 rounded bg-black/50 border border-primary/20 text-primary/90 break-words">
            {isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin"/> Loading status...</span>
            ) : status?.currentAction || status?.message || "Standing by for orders."}
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            className="flex-1 uppercase tracking-widest font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 hover:border-primary hover:neon-glow transition-all"
            disabled={isRunning || isStarting || launchBot.isPending}
            onClick={handleLaunch}
            data-testid="button-launch-bot"
          >
            {launchBot.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Initialize
          </Button>
          
          <Button 
            variant="destructive"
            className="flex-1 uppercase tracking-widest font-bold bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/50 hover:border-destructive transition-all"
            disabled={isIdle || stopBot.isPending}
            onClick={handleStop}
            data-testid="button-stop-bot"
          >
            {stopBot.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
            Terminate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
