"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, Users, Play, Lock, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { canAccessServer, getTierLimits, type TierKey } from "@/lib/tier";

interface FavoriteGamesProps {
  userTier: string;
}

export default function FavoriteGames({ userTier }: FavoriteGamesProps) {
  const tier = (userTier || "free") as TierKey;
  const tierLimits = getTierLimits(tier);

  const favoriteGames = [
    {
      name: "Adopt Me!",
      players: "85.6K",
      playerCount: 85600,
      placeId: "920587237",
      thumbnail: "https://tr.rbxcdn.com/180DAY-1c1e2c7e7c1e2c7e7c1e2c7e7c1e2c7e/150/150/Image/Webp/noFilter",
    },
    {
      name: "Blox Fruits",
      players: "328.7K",
      playerCount: 328700,
      placeId: "2753915549",
      thumbnail: "",
    },
    {
      name: "Brookhaven RP",
      players: "112.4K",
      playerCount: 112400,
      placeId: "4924922222",
      thumbnail: "",
    },
  ];

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-[#111] border border-[#222] rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-[#e74c3c]" />
          Favorite Games
        </h2>
        <Link
          href="/dashboard/games"
          className="text-xs text-[#e74c3c] hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="space-y-3">
        {favoriteGames.map((game) => {
          const canAccess = canAccessServer(tier, game.playerCount);
          const hasThumbnail = game.thumbnail?.startsWith("http");
          const robloxUrl = `https://www.roblox.com/games/${game.placeId}`;

          return (
            <div
              key={game.name}
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden hover:border-[#333] transition-colors"
            >
              <div className="flex">
                {/* Thumbnail */}
                <div className="w-16 h-16 bg-[#1a1a1a] shrink-0 overflow-hidden">
                  {hasThumbnail ? (
                    <img
                      src={game.thumbnail}
                      alt={game.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gamepad2 className="w-5 h-5 text-zinc-700" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium text-sm truncate">
                          {game.name}
                        </h3>
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-0 text-[10px] px-1.5 py-0 shrink-0">
                          Online
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {game.players}
                        </span>
                        <a
                          href={robloxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[#555] hover:text-[#e74c3c] transition-colors truncate"
                        >
                          roblox.com/games/{game.placeId}
                        </a>
                      </div>
                    </div>
                    <a
                      href={robloxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#555] hover:text-[#a0a0a0] transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    {canAccess ? (
                      <Button
                        size="sm"
                        onClick={() => handleQuickJoin(game.placeId)}
                        className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-xs h-7"
                      >
                        <Play className="w-3 h-3 mr-1" /> Quick Join
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              size="sm"
                              disabled
                              className="text-xs h-7 bg-[#333] text-[#666]"
                            >
                              <Lock className="w-3 h-3 mr-1" /> Quick Join
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="bg-[#1a1a1a] text-white border-[#333]"
                        >
                          Upgrade to access (max {tierLimits.maxPlayers === Infinity ? "∞" : tierLimits.maxPlayers.toLocaleString()} players)
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <a href={robloxUrl} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] text-xs h-7"
                      >
                        Open in Browser
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
