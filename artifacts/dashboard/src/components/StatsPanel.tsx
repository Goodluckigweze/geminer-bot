import { useGetBotStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Target, Dices, Coins, Zap, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function StatsPanel() {
  const { data: stats } = useGetBotStats({
    query: { refetchInterval: 5000 }
  });

  const formatUptime = (ms: number | null | undefined) => {
    if (!ms) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const statItems = [
    {
      label: "Missions Completed",
      value: stats?.missionsCompleted || 0,
      icon: <Target className="w-4 h-4 text-primary" />,
      testid: "stat-missions"
    },
    {
      label: "Wheel Spins",
      value: stats?.wheelSpins || 0,
      icon: <Dices className="w-4 h-4 text-primary" />,
      testid: "stat-wheel"
    },
    {
      label: "Coin Flips",
      value: stats?.coinFlips || 0,
      icon: <Coins className="w-4 h-4 text-primary" />,
      testid: "stat-coins"
    },
    {
      label: "Total Actions",
      value: stats?.actionsTotal || 0,
      icon: <Zap className="w-4 h-4 text-primary" />,
      testid: "stat-actions"
    },
  ];

  return (
    <Card className="border-primary/30 bg-card/80 backdrop-blur-sm scanline">
      <CardHeader className="pb-2 border-b border-primary/10">
        <CardTitle className="text-sm font-bold tracking-tight uppercase text-primary flex items-center gap-2">
          <Database className="w-4 h-4" />
          Metrics & Telemetry
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        
        <div className="grid grid-cols-2 gap-4">
          {statItems.map((item, i) => (
            <div key={i} className="bg-black/40 border border-primary/10 p-3 rounded-md flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</span>
                {item.icon}
              </div>
              <div className="text-2xl font-bold font-sans text-primary/90" data-testid={item.testid}>
                {item.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-primary/10 flex items-center justify-between text-xs text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Uptime
          </div>
          <div className="font-mono text-primary/70" data-testid="stat-uptime">
            {formatUptime(stats?.uptime)}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
