"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Gamepad2, Search, Lock, Users, ExternalLink, Play, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canAccessServer, getTierLimits, getTierLabel, type TierKey } from "@/lib/tier";

interface Game {
  id: string;
  name: string;
  placeId: string;
  playerCount: number;
  status: string;
  description: string;
  thumbnail: string;
}

export default function GamesPage() {
  const { user } = useAuthStore();
  const tier = ((user as any)?.tier || "free") as TierKey;
  const tierLimits = getTierLimits(tier);
  const [games, setGames] = useState<Game[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.games.list();
      if (r.success && r.data) {
        setGames((r.data as any).games || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Auto-sync thumbnails on first load
  useEffect(() => {
    const syncThumbnails = async () => {
      try {
        const res = await fetch("/api/roblox/thumbnails", { method: "POST" });
        const data = await res.json();
        if (data.success && data.data?.synced > 0) {
          // Refresh games to get updated thumbnails
          fetchGames();
        }
      } catch {
        // silently fail
      }
    };
    syncThumbnails();
  }, []);

  const handleSyncThumbnails = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/roblox/thumbnails", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchGames();
      }
    } catch {
      // silently fail
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickJoin = (placeId: string) => {
    // Try Roblox deeplink first, fallback to web URL
    const deeplink = `roblox://placeId=${placeId}`;
    const webUrl = `https://www.roblox.com/games/${placeId}`;

    // Create a hidden iframe to attempt deeplink
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = deeplink;
    document.body.appendChild(iframe);

    // Fallback: open web URL after a short delay
    setTimeout(() => {
      document.body.removeChild(iframe);
      window.open(webUrl, "_blank");
    }, 1500);
  };

  const filtered = games
    .filter((g) => {
      if (filter === "online") return g.status === "online";
      if (filter === "offline") return g.status !== "online";
      return true;
    })
    .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "players") return b.playerCount - a.playerCount;
      return a.name.localeCompare(b.name);
    });

  const gamesUsed = games.filter((g) => canAccessServer(tier, g.playerCount)).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-[#e74c3c]" /> Games
          </h1>
          <p className="text-[#a0a0a0] text-sm mt-1">Browse and join your favorite games.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-[#e74c3c]/15 text-[#e74c3c] font-semibold">
            {getTierLabel(tier)} Tier
          </span>
          <Button
            onClick={handleSyncThumbnails}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="border-[#333] text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Images"}
          </Button>
        </div>
      </div>

      {/* Tier usage bar */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#a0a0a0]">Games Accessible</span>
          <span className="text-xs text-white font-medium">
            {gamesUsed}/{tierLimits.maxGames === Infinity ? "∞" : tierLimits.maxGames}
          </span>
        </div>
        <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#e74c3c] rounded-full transition-all"
            style={{ width: `${tierLimits.maxGames === Infinity ? 5 : (gamesUsed / tierLimits.maxGames) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">
          Player limit per server: {tierLimits.minPlayers} - {tierLimits.maxPlayers === Infinity ? "∞" : tierLimits.maxPlayers.toLocaleString()}
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 h-10 bg-[#111] border border-[#333] rounded-lg px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#e74c3c]"
          />
        </div>
        <div className="flex gap-2">
          {["all", "online", "offline"].map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}
              className={filter === f ? "bg-[#e74c3c] text-white" : "border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a]"}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Games grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden animate-pulse">
              <div className="h-32 bg-[#1a1a1a]" />
              <div className="p-4">
                <div className="h-4 bg-[#1a1a1a] rounded w-2/3 mb-3" />
                <div className="h-3 bg-[#1a1a1a] rounded w-1/3 mb-4" />
                <div className="h-8 bg-[#1a1a1a] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((game) => {
            const accessible = canAccessServer(tier, game.playerCount);
            const hasThumbnail = game.thumbnail?.startsWith("http");
            const robloxUrl = `https://www.roblox.com/games/${game.placeId}`;

            return (
              <motion.div key={game.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] border border-[#222] rounded-xl overflow-hidden hover:border-[#333] transition-colors group">
                {/* Thumbnail */}
                <div className="relative h-32 bg-[#1a1a1a] overflow-hidden">
                  {hasThumbnail ? (
                    <img
                      src={game.thumbnail}
                      alt={game.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gamepad2 className="w-10 h-10 text-zinc-700" />
                    </div>
                  )}
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
                  {/* Status badge */}
                  <span className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm ${
                    game.status === "online"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${game.status === "online" ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    {game.status}
                  </span>
                  {/* Player count overlay */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] text-white/80 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md">
                    <Users className="w-3 h-3" />
                    {game.playerCount.toLocaleString()} players
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white truncate">{game.name}</h3>
                  </div>

                  {game.description && (
                    <p className="text-[10px] text-zinc-500 mb-2 line-clamp-1">{game.description}</p>
                  )}

                  <a
                    href={robloxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-zinc-600 font-mono hover:text-[#e74c3c] transition-colors flex items-center gap-1 mb-3"
                  >
                    <Globe className="w-3 h-3" />
                    roblox.com/games/{game.placeId}
                  </a>

                  <div className="flex gap-2">
                    {accessible ? (
                      <Button
                        size="sm"
                        onClick={() => handleQuickJoin(game.placeId)}
                        className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-xs h-8 flex-1"
                      >
                        <Play className="w-3 h-3 mr-1" /> Quick Join
                      </Button>
                    ) : (
                      <Button size="sm" disabled className="bg-[#333] text-[#666] text-xs h-8 flex-1 cursor-not-allowed">
                        <Lock className="w-3 h-3 mr-1" /> Upgrade Required
                      </Button>
                    )}
                    <a href={robloxUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-[#333] text-[#a0a0a0] text-xs h-8 hover:bg-[#1a1a1a]">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                  {!accessible && (
                    <p className="text-[10px] text-[#e74c3c] mt-2">
                      Requires tier with {game.playerCount.toLocaleString()}+ player limit
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
