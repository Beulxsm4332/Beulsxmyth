"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Check,
  Zap,
  Crown,
  Infinity as Inf,
  Search,
  Key,
  UserCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import { WHITELIST_TIERS, getTierLabel, type TierKey } from "@/lib/tier";

// ─── Types ────────────────────────────────────────────────────────────────

interface RobloxProfile {
  robloxId: string;
  robloxUsername: string;
  robloxDisplay: string;
  robloxAvatar: string | null;
}

interface WhitelistEntry {
  id: string;
  robloxUsername: string;
  robloxId: string | null;
  robloxAvatar: string | null;
  robloxDisplay: string | null;
  tier: string;
  source: string;
  isActive: boolean;
  redeemedKeyId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WhitelistCheckResult {
  whitelisted: boolean;
  tier: string | null;
  robloxUsername: string | null;
  robloxId: string | null;
}

// ─── Tier data ────────────────────────────────────────────────────────────

const tiers: Array<{ key: TierKey; price: string; icon: any; popular: boolean }> = [
  { key: "free", price: "$0", icon: Zap, popular: false },
  { key: "basic", price: "$7", icon: Shield, popular: true },
  { key: "premium", price: "$15", icon: Crown, popular: false },
  { key: "ultimate", price: "$30", icon: Inf, popular: false },
];

// ─── Section A: Roblox Profile Scanner ────────────────────────────────────

function RobloxScanner() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<RobloxProfile | null>(null);
  const [whitelistCheck, setWhitelistCheck] = useState<WhitelistCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    setWhitelistCheck(null);

    try {
      // Fetch Roblox profile
      const profileRes = await fetch("/api/roblox/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const profileData = await profileRes.json();

      if (!profileData.success) {
        setError(profileData.error || "Failed to fetch Roblox profile");
        return;
      }

      setProfile(profileData.data);

      // Check whitelist status
      const checkRes = await fetch("/api/whitelist/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ robloxUsername: profileData.data.robloxUsername }),
      });
      const checkData = await checkRes.json();

      if (checkData.success) {
        setWhitelistCheck(checkData.data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [username]);

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-[#e74c3c]/15 flex items-center justify-center border border-[#e74c3c]/20">
          <UserCircle className="w-5 h-5 text-[#e74c3c]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Roblox Profile Scanner</h2>
          <p className="text-[11px] text-[#a0a0a0]">Look up a Roblox user and check their whitelist status</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Enter Roblox username..."
            className="bg-[#1a1a1a] border-[#333] text-white pl-10 h-10 focus:border-[#e74c3c] placeholder:text-zinc-600"
          />
        </div>
        <Button
          onClick={handleScan}
          disabled={loading || !username.trim()}
          className="bg-[#e74c3c] hover:bg-[#c0392b] text-white h-10 px-5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
          {loading ? "Scanning..." : "Scan Profile"}
        </Button>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {profile && (
        <div className="mt-5 p-4 rounded-xl bg-[#0d0d0d] border border-[#222]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#1a1a1a] border border-[#333] shrink-0">
              {profile.robloxAvatar ? (
                <img
                  src={profile.robloxAvatar}
                  alt={profile.robloxUsername}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserCircle className="w-8 h-8 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">{profile.robloxUsername}</h3>
                {whitelistCheck && (
                  whitelistCheck.whitelisted ? (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Whitelisted — {getTierLabel(whitelistCheck.tier as TierKey)}
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/15 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-md">
                      <XCircle className="w-3 h-3 mr-1" /> Not Whitelisted
                    </Badge>
                  )
                )}
              </div>
              <p className="text-xs text-[#a0a0a0] mt-0.5">Display: {profile.robloxDisplay}</p>
              <p className="text-xs text-zinc-600 font-mono mt-0.5">ID: {profile.robloxId}</p>
            </div>
            <a
              href={`https://www.roblox.com/users/${profile.robloxId}/profile`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#a0a0a0] hover:text-white hover:border-[#555] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section B: Redeem Key ────────────────────────────────────────────────

function RedeemKey() {
  const [key, setKey] = useState("");
  const [robloxUsername, setRobloxUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; tier?: string } | null>(null);

  const handleRedeem = useCallback(async () => {
    if (!key.trim() || !robloxUsername.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/whitelist/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), robloxUsername: robloxUsername.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Key redeemed successfully! You've been granted ${getTierLabel(data.data.tier as TierKey)} access.`,
          tier: data.data.tier,
        });
        setKey("");
        setRobloxUsername("");
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to redeem key. Please check and try again.",
        });
      }
    } catch {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }, [key, robloxUsername]);

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-[#f39c12]/15 flex items-center justify-center border border-[#f39c12]/20">
          <Key className="w-5 h-5 text-[#f39c12]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Redeem Key</h2>
          <p className="text-[11px] text-[#a0a0a0]">Enter your redeem key and Roblox username to activate</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1.5">
            Redeem Key
          </label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="BEUL-XXXXXXXX-XXXXXXXX"
            className="bg-[#1a1a1a] border-[#333] text-white h-10 font-mono tracking-wider focus:border-[#e74c3c] placeholder:text-zinc-600 placeholder:font-sans placeholder:tracking-normal"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1.5">
            Roblox Username
          </label>
          <Input
            value={robloxUsername}
            onChange={(e) => setRobloxUsername(e.target.value)}
            placeholder="Your Roblox username"
            className="bg-[#1a1a1a] border-[#333] text-white h-10 focus:border-[#e74c3c] placeholder:text-zinc-600"
          />
        </div>
        <Button
          onClick={handleRedeem}
          disabled={loading || !key.trim() || !robloxUsername.trim()}
          className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white h-10"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
          ) : (
            <Key className="w-4 h-4 mr-1.5" />
          )}
          {loading ? "Redeeming..." : "Redeem Key"}
        </Button>
      </div>

      {result && (
        <div className={`mt-4 flex items-start gap-2 p-3 rounded-lg border ${
          result.success
            ? "bg-emerald-500/10 border-emerald-500/20"
            : "bg-red-500/10 border-red-500/20"
        }`}>
          {result.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${result.success ? "text-emerald-400" : "text-red-400"}`}>
              {result.success ? "Success!" : "Error"}
            </p>
            <p className={`text-xs mt-0.5 ${result.success ? "text-emerald-400/80" : "text-red-400/80"}`}>
              {result.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section C: Current Whitelist Status ──────────────────────────────────

function WhitelistStatus() {
  const [entry, setEntry] = useState<WhitelistEntry | null>(null);
  const [whitelisted, setWhitelisted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whitelist/me");
      const data = await res.json();
      if (data.success) {
        setWhitelisted(data.data.whitelisted);
        setEntry(data.data.entry);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#e74c3c]/15 flex items-center justify-center border border-[#e74c3c]/20 animate-pulse">
            <Shield className="w-5 h-5 text-[#e74c3c]/50" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Whitelist Status</h2>
            <p className="text-[11px] text-[#a0a0a0]">Loading your status...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-[#1a1a1a] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!whitelisted || !entry) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center border border-red-500/20">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Whitelist Status</h2>
            <p className="text-[11px] text-red-400">Not whitelisted yet</p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10">
          <p className="text-sm text-[#a0a0a0]">
            You don&apos;t have an active whitelist entry. Redeem a key above to get access.
          </p>
          <a href="#redeem-section" className="inline-flex items-center gap-1 text-xs text-[#e74c3c] hover:underline mt-2">
            Redeem Key <Key className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  const sourceLabels: Record<string, string> = {
    key: "Key Redemption",
    manual: "Manual Assignment",
    admin: "Admin Assignment",
  };

  return (
    <div className="bg-[#111] border border-[#e74c3c]/30 rounded-xl p-6 shadow-[0_0_20px_rgba(231,76,60,0.08)]">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Whitelist Status</h2>
          <p className="text-[11px] text-emerald-400">Active — {getTierLabel(entry.tier as TierKey)} Tier</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-[#1a1a1a]">
          {entry.robloxAvatar ? (
            <img src={entry.robloxAvatar} alt={entry.robloxUsername} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-zinc-500" />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-white">{entry.robloxUsername}</p>
            {entry.robloxDisplay && entry.robloxDisplay !== entry.robloxUsername && (
              <p className="text-[10px] text-[#a0a0a0]">{entry.robloxDisplay}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-lg bg-[#0d0d0d] border border-[#1a1a1a]">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Roblox ID</p>
            <p className="text-xs text-white font-mono">{entry.robloxId || "N/A"}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0d0d0d] border border-[#1a1a1a]">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Tier</p>
            <Badge className="bg-[#e74c3c]/15 text-[#e74c3c] border-0 text-[10px] px-1.5 py-0">
              {getTierLabel(entry.tier as TierKey)}
            </Badge>
          </div>
          <div className="p-3 rounded-lg bg-[#0d0d0d] border border-[#1a1a1a]">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Source</p>
            <p className="text-xs text-white">{sourceLabels[entry.source] || entry.source}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0d0d0d] border border-[#1a1a1a]">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Status</p>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${entry.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
              <span className={`text-xs ${entry.isActive ? "text-emerald-400" : "text-red-400"}`}>
                {entry.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section D: Tier Plans ────────────────────────────────────────────────

function TierPlans() {
  const { user } = useAuthStore();
  const currentTier = ((user as any)?.tier || "free") as TierKey;

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">Available Plans</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {tiers.map((t) => {
          const tLimits = WHITELIST_TIERS[t.key];
          const isCurrent = t.key === currentTier;
          return (
            <div
              key={t.key}
              className={`relative rounded-xl border p-5 transition-all ${
                isCurrent
                  ? "border-[#e74c3c] bg-[#111] shadow-[0_0_20px_rgba(231,76,60,0.15)]"
                  : "border-[#222] bg-[#111] hover:border-[#333]"
              }`}
            >
              {t.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#e74c3c] text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                    POPULAR
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <t.icon className="w-5 h-5 text-[#e74c3c]" />
                <h3 className="text-sm font-bold text-white">{getTierLabel(t.key)}</h3>
              </div>
              <p className="text-2xl font-extrabold text-white mb-1">
                {t.price}
                <span className="text-xs text-[#a0a0a0] font-normal">/mo</span>
              </p>
              <div className="border-t border-[#222] my-3" />
              <ul className="space-y-2 text-xs text-[#a0a0a0]">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#e74c3c]" />{" "}
                  {tLimits.maxGames === Infinity ? "Unlimited" : tLimits.maxGames.toLocaleString()} games
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#e74c3c]" /> Up to{" "}
                  {tLimits.maxPlayers === Infinity ? "∞" : tLimits.maxPlayers.toLocaleString()} players
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#e74c3c]" />{" "}
                  {t.key === "free" ? "Community support" : "Priority support"}
                </li>
                {t.key !== "free" && (
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#e74c3c]" /> Custom scripts
                  </li>
                )}
                {t.key === "ultimate" && (
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-[#e74c3c]" /> SLA guarantee
                  </li>
                )}
              </ul>
              <Button
                className={`w-full mt-4 h-9 text-xs ${
                  isCurrent
                    ? "bg-[#333] text-[#a0a0a0] cursor-default"
                    : "bg-[#e74c3c] hover:bg-[#c0392b] text-white"
                }`}
                disabled={isCurrent}
              >
                {isCurrent ? "Current Plan" : "Upgrade"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function WhitelistPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#e74c3c]" /> Whitelist
        </h1>
        <p className="text-[#a0a0a0] text-sm mt-1">
          Manage your access tier, redeem keys, and check whitelist status.
        </p>
      </div>

      {/* Section C: Current Whitelist Status — show at top */}
      <div className="mb-6">
        <WhitelistStatus />
      </div>

      {/* Section A & B side by side on larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" id="redeem-section">
        <RobloxScanner />
        <RedeemKey />
      </div>

      {/* Section D: Tier Plans */}
      <TierPlans />
    </div>
  );
}
