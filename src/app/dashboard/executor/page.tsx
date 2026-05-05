"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Play,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  Shield,
  Server,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useDashboardStore } from "@/lib/dashboard-store";
import { validateScript, canAccessServer, type TierKey } from "@/lib/tier";

// ── Execution Phases ──
const PHASES = [
  { key: "queued", label: "Queued", icon: Clock },
  { key: "validating", label: "Validating", icon: Shield },
  { key: "allocating", label: "Server Allocation", icon: Server },
  { key: "injecting", label: "Injection", icon: Zap },
  { key: "running", label: "Running", icon: Activity },
  { key: "completed", label: "Completed", icon: CheckCircle },
] as const;

const statusColors: Record<string, string> = {
  queued: "text-yellow-500",
  running: "text-blue-400",
  completed: "text-emerald-500",
  failed: "text-[#e74c3c]",
};

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  queued: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
};

const phaseColors: Record<string, string> = {
  queued: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
  validating: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  allocating: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  injecting: "text-[#e74c3c] border-[#e74c3c]/30 bg-[#e74c3c]/10",
  running: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  completed: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  failed: "text-[#e74c3c] border-[#e74c3c]/30 bg-[#e74c3c]/10",
};

interface GameOption {
  id: string;
  name: string;
  playerCount: number;
  status: string;
}

export default function ExecutorPage() {
  const { user } = useAuthStore();
  const tier = ((user as Record<string, unknown>)?.tier || "free") as TierKey;
  const addExecution = useDashboardStore((s) => s.addExecution);
  const updateExecution = useDashboardStore((s) => s.updateExecution);
  const executions = useDashboardStore((s) => s.executions);

  const [script, setScript] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const [games, setGames] = useState<GameOption[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationMsg, setValidationMsg] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [executionHistory, setExecutionHistory] = useState<
    Array<{ id: string; game: string; status: string; time: string; duration?: string }>
  >([]);
  const [rateLimit, setRateLimit] = useState(5);
  const [currentPhase, setCurrentPhase] = useState<string>("queued");
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentLogs, setCurrentLogs] = useState<string[]>([]);
  const [showFullConsole, setShowFullConsole] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Get current job from dashboard store (synced via WebSocket)
  const currentJob = currentJobId
    ? executions.find((e) => e.jobId === currentJobId)
    : null;

  // Auto-scroll console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentLogs]);

  // Load games from API
  useEffect(() => {
    async function loadGames() {
      try {
        const result = await api.games.list();
        if (result.success && result.data) {
          const gameData = (result.data as { games: GameOption[] }).games;
          setGames(
            gameData.map((g) => ({
              id: g.id,
              name: g.name,
              playerCount: g.playerCount,
              status: g.status,
            }))
          );
        }
      } catch (err) {
        console.error("[Executor] Failed to load games:", err);
      } finally {
        setGamesLoading(false);
      }
    }
    loadGames();
  }, []);

  // Update execution when WebSocket updates arrive
  useEffect(() => {
    if (currentJobId && currentJob) {
      setExecutionHistory((prev) =>
        prev.map((e) =>
          e.id === currentJobId
            ? { ...e, status: currentJob.status }
            : e
        )
      );

      // Update logs
      if (currentJob.logs) {
        setCurrentLogs(currentJob.logs.split("\n"));
      }

      // If completed or failed, stop executing state
      if (currentJob.status === "completed" || currentJob.status === "failed") {
        setIsExecuting(false);
        setCurrentPhase(currentJob.status === "completed" ? "completed" : "failed");
        setCurrentProgress(currentJob.status === "completed" ? 100 : 0);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    }
  }, [currentJob?.status, currentJob?.logs, currentJobId]);

  const handleValidate = () => {
    const result = validateScript(script);
    setIsValid(result.valid);
    setValidationMsg(
      result.reason || (result.valid ? "Script is valid and safe to execute." : "")
    );
  };

  const handleExecute = async () => {
    if (!selectedGame || !script) return;
    setIsExecuting(true);
    setCurrentPhase("queued");
    setCurrentProgress(5);
    setCurrentLogs(["[INFO] Execution queued. Waiting for pipeline to start..."]);

    try {
      const result = await api.executor.run({
        raw_script: script,
        game_id: selectedGame,
      });
      if (result.success && result.data) {
        const data = result.data as {
          jobId: string;
          status: string;
          gameName?: string;
          serverName?: string;
        };
        setCurrentJobId(data.jobId);
        addExecution({
          jobId: data.jobId,
          status: "queued",
          logs: "",
          gameId: selectedGame,
        });
        setRateLimit((prev) => Math.max(0, prev - 1));

        const gameName =
          games.find((g) => g.id === selectedGame)?.name || "Unknown";
        setExecutionHistory((prev) => [
          {
            id: data.jobId,
            game: gameName,
            status: "queued",
            time: "Just now",
          },
          ...prev,
        ]);

        // Poll for status (fallback when WS not connected)
        pollIntervalRef.current = setInterval(async () => {
          const status = await api.executor.status(data.jobId);
          if (status.success && status.data) {
            const statusData = status.data as {
              jobId: string;
              status: string;
              logs: string;
              phase?: string;
              progress?: number;
            };
            updateExecution(data.jobId, {
              status: statusData.status,
              logs: statusData.logs,
            });

            if (statusData.phase) setCurrentPhase(statusData.phase);
            if (statusData.progress) setCurrentProgress(statusData.progress);

            if (
              statusData.status === "completed" ||
              statusData.status === "failed"
            ) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            }
          }
        }, 2000);
      } else {
        setIsExecuting(false);
        setCurrentPhase("failed");
        setCurrentLogs(["[ERROR] Failed to start execution."]);
      }
    } catch {
      setIsExecuting(false);
      setCurrentPhase("failed");
      setCurrentLogs(["[ERROR] Network error. Please try again."]);
    }
  };

  // ── Phase Indicator ──
  function PhaseIndicator() {
    const currentIdx = PHASES.findIndex(
      (p) => p.key === currentPhase || (currentPhase === "failed" && p.key === "injecting")
    );

    return (
      <div className="bg-[#111] border border-[#222] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-4">
          Execution Pipeline
        </h3>
        <div className="flex items-center gap-1">
          {PHASES.map((phase, idx) => {
            const isActive = idx === currentIdx;
            const isCompleted = idx < currentIdx;
            const isFailed = currentPhase === "failed" && idx === currentIdx;

            return (
              <div key={phase.key} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                      isFailed
                        ? "border-[#e74c3c]/50 bg-[#e74c3c]/15"
                        : isActive
                          ? "border-[#e74c3c]/50 bg-[#e74c3c]/15 shadow-[0_0_10px_rgba(231,76,60,0.2)]"
                          : isCompleted
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-[#333] bg-[#1a1a1a]"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : isActive && isExecuting ? (
                      <Loader2
                        className={`w-4 h-4 ${isFailed ? "text-[#e74c3c]" : "text-[#e74c3c]"} animate-spin`}
                      />
                    ) : (
                      <phase.icon
                        className={`w-4 h-4 ${isActive ? "text-[#e74c3c]" : "text-zinc-600"}`}
                      />
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-medium whitespace-nowrap ${
                      isActive
                        ? isFailed
                          ? "text-[#e74c3c]"
                          : "text-[#e74c3c]"
                        : isCompleted
                          ? "text-emerald-500"
                          : "text-zinc-600"
                    }`}
                  >
                    {phase.label}
                  </span>
                </div>
                {idx < PHASES.length - 1 && (
                  <div
                    className={`h-0.5 w-full mt-[-18px] rounded-full ${
                      idx < currentIdx ? "bg-emerald-500" : "bg-[#222]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">Progress</span>
            <span className="text-[10px] font-bold text-[#e74c3c]">
              {currentProgress}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#e74c3c] to-[#c0392b] rounded-full"
              animate={{ width: `${currentProgress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Console ──
  function LiveConsole() {
    const getLogColor = (line: string) => {
      if (line.includes("[SUCCESS]")) return "text-emerald-500";
      if (line.includes("[ERROR]")) return "text-[#e74c3c]";
      if (line.includes("[WARN]")) return "text-[#f39c12]";
      if (line.includes("[CONSOLE]")) return "text-[#3498db]";
      if (line.includes("[DEBUG]")) return "text-zinc-500";
      return "text-zinc-300";
    };

    return (
      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#222]">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[#e74c3c]" />
            <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider">
              Live Output
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isExecuting && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#e74c3c] animate-pulse" />
                <span className="text-[10px] text-[#e74c3c] font-semibold">
                  LIVE
                </span>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullConsole(!showFullConsole)}
              className="h-6 text-[10px] text-[#a0a0a0] hover:text-white px-2"
            >
              {showFullConsole ? (
                <ChevronUp className="w-3 h-3 mr-1" />
              ) : (
                <ChevronDown className="w-3 h-3 mr-1" />
              )}
              {showFullConsole ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
        <div
          className={`overflow-y-auto p-3 font-mono text-[11px] space-y-0.5 ${showFullConsole ? "h-96" : "h-52"}`}
        >
          {currentLogs.length === 0 ? (
            <p className="text-zinc-700">
              Waiting for execution output...
            </p>
          ) : (
            currentLogs.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={getLogColor(line)}
              >
                {line}
              </motion.div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-[#e74c3c]" /> Executor
        </h1>
        <p className="text-[#a0a0a0] text-sm mt-1">
          Execute scripts on your game servers with the production execution
          pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Script input + game selector + execute */}
        <div className="space-y-4">
          {/* Script input */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider">
                Script Input
              </h3>
              <span className="text-[10px] text-zinc-600">
                {script.length.toLocaleString()} / 100,000 chars
              </span>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="-- Enter your Lua script here...
-- Example:
local player = game.Players.LocalPlayer
local character = player.Character
print('Script executed successfully!')"
              className="w-full h-48 bg-[#0a0a0a] border border-[#333] rounded-lg p-3 text-sm text-white font-mono placeholder:text-zinc-700 outline-none focus:border-[#e74c3c] resize-y"
            />
            {isValid !== null && (
              <div
                className={`flex items-center gap-2 mt-2 text-xs ${isValid ? "text-emerald-500" : "text-[#e74c3c]"}`}
              >
                {isValid ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {validationMsg}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                className="border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a] text-xs"
              >
                <Shield className="w-3 h-3 mr-1" /> Validate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setScript("");
                  setIsValid(null);
                }}
                className="border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a] text-xs"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Game selector */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3">
              Select Game
            </h3>
            {gamesLoading ? (
              <div className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-zinc-600 animate-pulse">
                Loading games...
              </div>
            ) : (
              <select
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#e74c3c]"
              >
                <option value="">-- Select a game --</option>
                {games.map((g) => {
                  const accessible = canAccessServer(tier, g.playerCount);
                  return (
                    <option
                      key={g.id}
                      value={g.id}
                      disabled={!accessible}
                    >
                      {g.name} ({g.playerCount.toLocaleString()} players)
                      {!accessible ? " - Upgrade Required" : ""}
                    </option>
                  );
                })}
              </select>
            )}
            {selectedGame &&
              !canAccessServer(
                tier,
                games.find((g) => g.id === selectedGame)?.playerCount || 0
              ) && (
                <p className="text-[10px] text-[#e74c3c] mt-2">
                  Your tier does not allow access to servers with this many
                  players. Please upgrade your plan.
                </p>
              )}
          </div>

          {/* Execute button */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider">
                Execute
              </h3>
              <span className="text-[10px] text-zinc-600">
                {rateLimit}/5 remaining this minute
              </span>
            </div>
            <Button
              onClick={handleExecute}
              disabled={isExecuting || !script || !selectedGame}
              className="w-full h-12 bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold text-sm shadow-[0_0_20px_rgba(231,76,60,0.3)] disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                  EXECUTING...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" /> EXECUTE SCRIPT
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right: Pipeline status + Console + History */}
        <div className="space-y-4">
          {/* Phase indicator */}
          <PhaseIndicator />

          {/* Live console */}
          <LiveConsole />

          {/* Execution history */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3">
              Recent Executions
            </h3>
            <div className="space-y-2">
              {executionHistory.length === 0 ? (
                <p className="text-xs text-zinc-600">
                  No executions yet. Run a script to see history.
                </p>
              ) : (
                executionHistory.slice(0, 5).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = statusIcons[e.status] || Clock;
                        return (
                          <Icon
                            className={`w-3 h-3 ${statusColors[e.status]} ${e.status === "running" ? "animate-spin" : ""}`}
                          />
                        );
                      })()}
                      <span className="text-xs text-white">{e.game}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-semibold ${statusColors[e.status]}`}
                      >
                        {e.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {e.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
