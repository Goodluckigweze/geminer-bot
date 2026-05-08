import { useGetBotLogs, getGetBotLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export function ActivityLogPanel() {
  const { data: logs } = useGetBotLogs(
    { limit: 100 },
    { query: { queryKey: getGetBotLogsQueryKey({ limit: 100 }), refetchInterval: 3000 } }
  );

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'info': return <Info className="w-3.5 h-3.5 text-blue-400" />;
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
      case 'warning': return <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />;
      case 'error': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <Terminal className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'info': return "text-blue-400/80";
      case 'success': return "text-green-400";
      case 'warning': return "text-yellow-400";
      case 'error': return "text-red-500 font-bold";
      default: return "text-primary/70";
    }
  };

  return (
    <Card className="border-primary/30 bg-card/80 backdrop-blur-sm flex flex-col h-full scanline">
      <CardHeader className="pb-2 border-b border-primary/10">
        <CardTitle className="text-sm font-bold tracking-tight uppercase text-primary flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          Terminal Output
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden relative">
        <div className="absolute inset-0 p-4 overflow-y-auto font-mono text-xs flex flex-col-reverse gap-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {logs && logs.length > 0 ? (
            [...logs].reverse().map((log) => (
              <div 
                key={log.id} 
                className={`flex gap-3 py-1 group hover:bg-white/5 rounded px-2 transition-colors animate-in slide-in-from-left-2 ${getLogColor(log.level)}`}
                data-testid={`log-entry-${log.id}`}
              >
                <span className="opacity-50 shrink-0 w-20">
                  {format(new Date(log.timestamp), "HH:mm:ss")}
                </span>
                <span className="shrink-0 mt-0.5">
                  {getLogIcon(log.level)}
                </span>
                <span className="break-words">{log.message}</span>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground italic opacity-50 p-2">Awaiting telemetry...</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
