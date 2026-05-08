import { BotStatusPanel } from "@/components/BotStatusPanel";
import { ActivityLogPanel } from "@/components/ActivityLogPanel";
import { StatsPanel } from "@/components/StatsPanel";
import { Cpu } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 text-foreground font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center gap-3 pb-4 border-b border-primary/20 mb-8">
          <div className="bg-primary/20 p-2 rounded border border-primary/50 text-primary">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase text-primary neon-text-glow">GemMiner Nexus</h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Automated Asset Acquisition Protocol</p>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[calc(100vh-140px)]">
          
          {/* Left Column - Controls & Stats */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <BotStatusPanel />
            <StatsPanel />
          </div>

          {/* Right Column - Terminal */}
          <div className="lg:col-span-8 flex flex-col h-[500px] lg:h-auto">
            <ActivityLogPanel />
          </div>

        </div>
      </div>
    </div>
  );
}
