"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Zap,
  Gamepad2,
  BookOpen,
  Server,
  Terminal,
  Clock,
  Calendar,
  ArrowRight,
  Lock,
  Copy,
  Trash2,
  Send,
  Shield,
  LogOut,
  Cpu,
  HardDrive,
  CheckCircle2,
  XCircle,
  Play,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useDashboardStore } from "@/lib/dashboard-store";
import { getTierLimits, getTierLabel, canAccessServer, type TierKey } from "@/lib/tier";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ── Welcome Header ──
function WelcomeHeader({ username, tier }: { username: string; tier: string }) {
  const [time, setTime] = useState(new Date());
  const progress = 86;

  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, <span className="text-gradient-red">@{username}</span>
          </h1>
          <p className="text-[#a0a0a0] text-sm mt-1">Here&apos;s an overview of your system.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
          <Calendar className="w-4 h-4" />
          <span>
            {time.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            {time.toLocaleTimeString()}
          </span>
        </div>
      </div>
      <div className="bg-[#111] border border-[#222] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#a0a0a0] tracking-wider">
            INJECTION PROGRESS
          </span>
          <span className="text-xs font-bold text-[#e74c3c]">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-[#e74c3c] to-[#c0392b] rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Quick Actions ──
function QuickActions() {
  const actions = [
    {
      title: "Execute Script",
      desc: "Inject and execute your favorite scripts.",
      icon: Zap,
      color: "#f39c12",
      label: "Open Executor",
      href: "/dashboard/executor",
    },
    {
      title: "Open Games",
      desc: "Browse and join your favorite games.",
      icon: Gamepad2,
      color: "#e74c3c",
      label: "Go to Games",
      href: "/dashboard/games",
    },
    {
      title: "Script Hub",
      desc: "Explore and manage your script collection.",
      icon: BookOpen,
      color: "#3498db",
      label: "Open Script Hub",
      href: "/dashboard/scripts",
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {actions.map((a) => (
        <div key={a.title} className="bg-[#111] border border-[#222] rounded-xl p-5 hover:border-[#333] transition-colors group">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${a.color}15` }}>
              <a.icon className="w-5 h-5" style={{ color: a.color }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{a.title}</h3>
              <p className="text-xs text-[#a0a0a0] mt-0.5">{a.desc}</p>
            </div>
          </div>
          <a href={a.href}>
            <Button className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white text-xs h-9">
              {a.label} <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </a>
        </div>
      ))}
    </motion.div>
  );
}

// ── System Overview ──
function SystemOverview() {
  const stats = useDashboardStore((s) => s.stats);
  const serverStatus = useDashboardStore((s) => s.serverStatus);
  const wsConnected = useDashboardStore((s) => s.wsConnected);

  const items = [
    { label: "Total Games", value: stats.totalGames.toString(), change: "+12 this week", icon: Gamepad2, color: "#e74c3c" },
    { label: "Active Servers", value: stats.activeServers.toString(), change: `${serverStatus.filter(s => s.status === "online").length} online`, icon: Server, color: "#2ecc71" },
    { label: "Scripts Running", value: stats.scriptsRunning.toString(), change: "+2 active", icon: Terminal, color: "#f39c12" },
    { label: "System Uptime", value: typeof stats.uptime === "number" ? `${stats.uptime}%` : stats.uptime, change: "Excellent", icon: Clock, color: "#3498db" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map((s) => (
        <div key={s.label} className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#333] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-[#a0a0a0] font-semibold uppercase tracking-wider">{s.label}</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
              <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
            </div>
          </div>
          <p className="text-xl font-bold text-white">{s.value}</p>
          <div className="flex items-center gap-1 mt-1">
            {wsConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            <p className="text-[10px] text-emerald-500">{s.change}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ── Favorite Games ──
function FavoriteGames({ userTier }: { userTier: TierKey }) {
  const [games, setGames] = useState<Array<{ id: string; name: string; playerCount: number; placeId: string; status: string; thumbnail: string; description: string }>>([]);

  useEffect(() => {
    api.games.list().then((r) => {
      if (r.success && r.data) {
        const gameList = (r.data as { games: Array<{ id: string; name: string; playerCount: number; placeId: string; status: string; thumbnail: string; description: string }> }).games;
        setGames(gameList.slice(0, 3));
      }
    });
  }, []);

  const canJoin = (playerCount: number) => canAccessServer(userTier, playerCount);
  const tierLimits = getTierLimits(userTier);

  const handleQuickJoin = (placeId: string) => {
    const deeplink = `roblox://placeId=${placeId}`;
    const webUrl = `https://www.roblox.com/games/${placeId}`;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = deeplink;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
      window.open(webUrl, "_blank");
    }, 1500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-white">Favorite Games</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-[#e74c3c]/15 text-[#e74c3c] font-semibold">{getTierLabel(userTier)} Tier</span>
          <a href="/dashboard/games" className="text-xs text-[#e74c3c] hover:underline">View All</a>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {games.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden animate-pulse">
              <div className="h-24 bg-[#1a1a1a]" />
              <div className="p-4">
                <div className="h-4 bg-[#1a1a1a] rounded w-2/3 mb-3" />
                <div className="h-6 bg-[#1a1a1a] rounded w-1/2 mb-3" />
                <div className="h-7 bg-[#1a1a1a] rounded" />
              </div>
            </div>
          ))
        ) : (
          games.map((g) => {
            const accessible = canJoin(g.playerCount);
            const hasThumbnail = g.thumbnail?.startsWith("http");
            const robloxUrl = `https://www.roblox.com/games/${g.placeId}`;
            return (
              <div key={g.id} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden hover:border-[#333] transition-colors group">
                {/* Thumbnail */}
                <div className="relative h-24 bg-[#1a1a1a] overflow-hidden">
                  {hasThumbnail ? (
                    <img
                      src={g.thumbnail}
                      alt={g.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gamepad2 className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
                  <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-emerald-400 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {g.status}
                  </span>
                </div>
                {/* Content */}
                <div className="p-3">
                  <h3 className="text-sm font-bold text-white mb-1">{g.name}</h3>
                  <p className="text-lg font-bold text-white mb-1">{g.playerCount.toLocaleString()} <span className="text-xs text-[#a0a0a0] font-normal">players</span></p>
                  <a href={robloxUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-600 font-mono hover:text-[#e74c3c] transition-colors block truncate mb-2">roblox.com/games/{g.placeId}</a>
                  <div className="flex gap-2">
                    {accessible ? (
                      <Button size="sm" onClick={() => handleQuickJoin(g.placeId)} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-xs h-7 flex-1">
                        <Play className="w-3 h-3 mr-1" /> Quick Join
                      </Button>
                    ) : (
                      <div className="relative flex-1 group">
                        <Button size="sm" disabled className="bg-[#333] text-[#666] text-xs h-7 w-full cursor-not-allowed">
                          <Lock className="w-3 h-3 mr-1" /> Quick Join
                        </Button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1a1a1a] border border-[#333] text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap hidden group-hover:block z-10">
                          Upgrade to access {g.name} (max {tierLimits.maxPlayers === Infinity ? "∞" : tierLimits.maxPlayers.toLocaleString()} players)
                        </div>
                      </div>
                    )}
                    <a href={robloxUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-[#333] text-[#a0a0a0] text-xs h-7 hover:bg-[#1a1a1a]">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ── Performance Monitor ──
function PerformanceMonitor() {
  const performance = useDashboardStore((s) => s.performance);
  const wsConnected = useDashboardStore((s) => s.wsConnected);

  const latencyData = (performance?.latency?.length ? performance.latency : Array.from({ length: 30 }, () => Math.random() * 70 + 10)).map((v, i) => ({
    time: performance?.timestamps?.[i]
      ? new Date(performance.timestamps[i]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : `${30 - i}s`,
    value: Math.round(v),
  }));
  const freqData = (performance?.frequency?.length ? performance.frequency : Array.from({ length: 30 }, () => Math.random() * 350 + 50)).map((v, i) => ({
    time: performance?.timestamps?.[i]
      ? new Date(performance.timestamps[i]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : `${30 - i}s`,
    value: Math.round(v),
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-white">Performance Monitor</h2>
        <div className="flex items-center gap-1.5">
          {wsConnected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-500 font-semibold">LIVE</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <span className="text-[10px] text-zinc-500">POLLING</span>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#222] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3">Script Execution Latency (ms)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="time" tick={{ fill: "#666", fontSize: 10 }} stroke="#333" />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} stroke="#333" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#e74c3c" strokeWidth={2} dot={false} animationDuration={300} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#111] border border-[#222] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3">Script Frequency (req/s)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={freqData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="time" tick={{ fill: "#666", fontSize: 10 }} stroke="#333" />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} stroke="#333" domain={[0, 500]} />
              <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#3498db" strokeWidth={2} dot={false} animationDuration={300} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

// ── Server Status ──
function ServerStatusPanel() {
  const serverStatus = useDashboardStore((s) => s.serverStatus);

  if (serverStatus.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 mb-6">
        <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3 flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-[#e74c3c]" /> Server Infrastructure
        </h3>
        <div className="space-y-2">
          {serverStatus.map((srv) => (
            <div key={srv.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${srv.status === "online" ? "bg-emerald-500" : srv.status === "degraded" ? "bg-[#f39c12]" : "bg-zinc-500"}`} />
                <span className="text-xs text-white font-medium">{srv.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${srv.load > 80 ? "bg-[#e74c3c]" : srv.load > 50 ? "bg-[#f39c12]" : "bg-emerald-500"}`}
                    style={{ width: `${srv.load}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 w-8 text-right">{srv.load}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Right Panel ──
function RightPanel({ username, tier }: { username: string; tier: string }) {
  const router = useRouter();
  const executions = useDashboardStore((s) => s.executions);
  const [whitelistStatus, setWhitelistStatus] = useState<{ whitelisted: boolean; tier: string | null } | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; type: string; msg: string }>>([
    { time: "12:08:01", type: "SUCCESS", msg: "Injected." },
    { time: "12:08:01", type: "CONSOLE", msg: "Connected -> Spider-core Subsector" },
    { time: "12:08:02", type: "SUCCESS", msg: "Bypassed Protections." },
    { time: "12:08:03", type: "INFO", msg: "Script execution started." },
    { time: "12:08:05", type: "SUCCESS", msg: "Auto-farm module loaded." },
    { time: "12:08:06", type: "CONSOLE", msg: "Collecting resources..." },
    { time: "12:08:10", type: "INFO", msg: "Performance: 45ms avg latency" },
    { time: "12:08:15", type: "SUCCESS", msg: "All modules operational." },
  ]);
  const [consoleInput, setConsoleInput] = useState("");

  const typeColor: Record<string, string> = {
    SUCCESS: "text-emerald-500",
    CONSOLE: "text-[#3498db]",
    INFO: "text-[#f39c12]",
    ERROR: "text-[#e74c3c]",
  };

  const tierLimits = getTierLimits(tier as TierKey);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } finally {
      useAuthStore.getState().logout();
      router.push("/");
    }
  };

  const handleConsoleCommand = () => {
    if (!consoleInput.trim()) return;
    const now = new Date();
    const time = now.toTimeString().split(" ")[0].slice(0, 8);
    setLogs((prev) => [...prev, { time, type: "CONSOLE", msg: `> ${consoleInput}` }]);
    setConsoleInput("");
  };

  // Fetch whitelist status
  useEffect(() => {
    fetch("/api/whitelist/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setWhitelistStatus({ whitelisted: data.data.whitelisted, tier: data.data.entry?.tier ?? null });
        }
      })
      .catch(() => {});
  }, []);

  // Show recent execution logs in the console
  useEffect(() => {
    const latestExec = executions[0];
    if (latestExec?.logs) {
      const newLogs = latestExec.logs.split("\n").map((line) => ({
        time: new Date().toTimeString().split(" ")[0].slice(0, 8),
        type: line.includes("SUCCESS") ? "SUCCESS" : line.includes("ERROR") ? "ERROR" : "INFO",
        msg: line.replace(/^\[(SUCCESS|ERROR|INFO)\]\s*/, ""),
      }));
      setLogs((prev) => [...prev, ...newLogs].slice(-50));
    }
  }, [executions]);

  return (
    <div className="space-y-4">
      {/* Console */}
      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#222]">
          <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider">Scriptable Output</h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(logs.map(l => `[${l.time}] [${l.type}] ${l.msg}`).join("\n"))} className="h-6 text-[10px] text-[#a0a0a0] hover:text-white px-2">
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLogs([])} className="h-6 text-[10px] text-[#a0a0a0] hover:text-[#e74c3c] px-2">
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          </div>
        </div>
        <div className="h-52 overflow-y-auto p-3 font-mono text-[11px] space-y-1">
          {logs.map((l, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-zinc-600">[{l.time}]</span>
              <span className={typeColor[l.type] || "text-zinc-500"}>[{l.type}]</span>
              <span className="text-zinc-300">{l.msg}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-[#222] p-2 flex gap-2">
          <input
            type="text"
            value={consoleInput}
            onChange={(e) => setConsoleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConsoleCommand()}
            placeholder="Type your command..."
            className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-[#e74c3c]"
          />
          <Button size="sm" onClick={handleConsoleCommand} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white h-7 w-7 p-0">
            <Send className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Active Executions */}
      {executions.length > 0 && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3">Active Executions</h3>
          <div className="space-y-2">
            {executions.slice(0, 3).map((exec) => (
              <div key={exec.jobId} className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0">
                <span className="text-[10px] text-white font-mono truncate">{exec.jobId.slice(0, 12)}...</span>
                <span className={`text-[10px] ${exec.status === "completed" ? "text-emerald-500" : exec.status === "failed" ? "text-[#e74c3c]" : exec.status === "running" ? "text-[#3498db]" : "text-[#f39c12]"}`}>
                  {exec.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Profile */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3">User Profile</h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#e74c3c]/15 flex items-center justify-center border-2 border-[#e74c3c]/30 shadow-[0_0_15px_rgba(231,76,60,0.2)]">
            <span className="text-base font-bold text-[#e74c3c]">{username.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">@{username}</p>
              {whitelistStatus ? (
                whitelistStatus.whitelisted ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> {whitelistStatus.tier ? getTierLabel(whitelistStatus.tier as TierKey) : "Whitelisted"}
                  </span>
                ) : (
                  <a href="/dashboard/whitelist" className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors">
                    <XCircle className="w-3 h-3" /> Redeem Key →
                  </a>
                )
              ) : null}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-emerald-500">Online</span>
            </div>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-zinc-500">User ID</span><span className="text-white font-mono">BRK-{useAuthStore.getState().user?.id?.slice(0, 8) || "0000-0000"}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Server Status</span><span className="text-emerald-500">Connected</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Membership</span><span className="text-[#e74c3c] font-semibold">{getTierLabel(tier as TierKey)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Games Access</span><span className="text-white">{tierLimits.maxGames === Infinity ? "0/∞" : `0/${tierLimits.maxGames}`}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Session Uptime</span><span className="text-emerald-500">{Math.floor((Date.now() % 86400000) / 3600000)}h {Math.floor((Date.now() % 3600000) / 60000)}m</span></div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/settings")} className="flex-1 border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a] text-xs h-8">
            <Shield className="w-3 h-3 mr-1" /> Profile
          </Button>
          <Button size="sm" onClick={handleLogout} className="flex-1 bg-[#e74c3c] hover:bg-[#c0392b] text-white text-xs h-8">
            <LogOut className="w-3 h-3 mr-1" /> Logout
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ──
export default function DashboardPage() {
  const { user } = useAuthStore();
  const { setStats, setPerformance } = useDashboardStore();

  const username = user?.email?.split("@")[0] || "beulrock";
  const tier = (user as Record<string, unknown>)?.tier || "free";

  // Load initial stats from API (fallback for when WS is not connected)
  useEffect(() => {
    api.dashboard.stats().then((r) => {
      if (r.success && r.data) {
        setStats(r.data as { totalGames: number; activeServers: number; scriptsRunning: number; uptime: string });
      }
    });
    api.dashboard.performance().then((r) => {
      if (r.success && r.data) {
        setPerformance(r.data as { latency: number[]; frequency: number[]; timestamps: string[] });
      }
    });
  }, [setStats, setPerformance]);

  // Poll performance data as fallback when WebSocket is disconnected
  useEffect(() => {
    const wsConnected = useDashboardStore.getState().wsConnected;
    if (wsConnected) return;

    const interval = setInterval(() => {
      if (!useDashboardStore.getState().wsConnected) {
        api.dashboard.performance().then((r) => {
          if (r.success && r.data) {
            setPerformance(r.data as { latency: number[]; frequency: number[]; timestamps: string[] });
          }
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [setPerformance]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <WelcomeHeader username={username} tier={tier as string} />
        <QuickActions />
        <SystemOverview />
        <FavoriteGames userTier={tier as TierKey} />
        <PerformanceMonitor />
        <ServerStatusPanel />
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-80 shrink-0">
        <RightPanel username={username} tier={tier as string} />
      </div>
    </div>
  );
}
