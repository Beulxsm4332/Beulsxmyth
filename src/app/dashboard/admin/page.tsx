"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Users,
  Key,
  CheckCircle2,
  Trash2,
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { WHITELIST_TIERS, getTierLabel, type TierKey } from "@/lib/tier";

// ─── Types ────────────────────────────────────────────────────────────────

interface AdminKey {
  id: string;
  key: string;
  tier: string;
  description: string;
  maxUses: number;
  currentUses: number;
  remainingUses: number;
  createdBy: string;
  isExpired: boolean;
  expiresAt: string | null;
  redemptionCount: number;
  createdAt: string;
}

interface AdminWhitelistEntry {
  id: string;
  userId: string;
  userEmail: string;
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

// ─── Access Denied ────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-6">
        <AlertTriangle className="w-10 h-10 text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
      <p className="text-[#a0a0a0] text-sm max-w-md">
        You don&apos;t have permission to access the Admin Panel. This area is restricted to administrators only.
      </p>
    </div>
  );
}

// ─── Stats Overview ───────────────────────────────────────────────────────

function StatsOverview({ stats }: { stats: { totalWhitelisted: number; activeKeys: number; redeemedKeys: number; tierBreakdown: Record<string, number> } }) {
  const cards = [
    { label: "Total Whitelisted", value: stats.totalWhitelisted, icon: Users, color: "#e74c3c" },
    { label: "Active Keys", value: stats.activeKeys, icon: Key, color: "#2ecc71" },
    { label: "Redeemed Keys", value: stats.redeemedKeys, icon: CheckCircle2, color: "#3498db" },
    { label: "Unique Tiers", value: Object.keys(stats.tierBreakdown).length, icon: ShieldCheck, color: "#f39c12" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((c) => (
        <div key={c.label} className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#333] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-[#a0a0a0] font-semibold uppercase tracking-wider">{c.label}</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${c.color}15` }}>
              <c.icon className="w-3.5 h-3.5" style={{ color: c.color }} />
            </div>
          </div>
          <p className="text-xl font-bold text-white">{c.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Key Management ───────────────────────────────────────────────────────

function KeyManagement() {
  const [keys, setKeys] = useState<AdminKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");
  const [showGenerate, setShowGenerate] = useState(false);

  // Generate form state
  const [genTier, setGenTier] = useState<TierKey>("basic");
  const [genCount, setGenCount] = useState("1");
  const [genMaxUses, setGenMaxUses] = useState("1");
  const [genDescription, setGenDescription] = useState("");
  const [genExpiresAt, setGenExpiresAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);

  const [fetchError, setFetchError] = useState("");

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const data = await api.admin.listKeys(statusFilter);
      if (data.success && data.data) {
        setKeys((data.data as { keys: AdminKey[] }).keys);
      } else {
        setFetchError(data.error?.message || "Failed to load keys");
      }
    } catch {
      setFetchError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedKeys([]);
    setFetchError("");
    try {
      const data = await api.admin.generateKeys({
        tier: genTier,
        count: parseInt(genCount) || 1,
        maxUses: parseInt(genMaxUses) || 1,
        description: genDescription || undefined,
        expiresAt: genExpiresAt || undefined,
      });
      if (data.success && data.data) {
        const keysData = (data.data as { keys: Array<{ key: string }> });
        setGeneratedKeys(keysData.keys.map((k) => k.key));
        fetchKeys();
        setGenCount("1");
        setGenMaxUses("1");
        setGenDescription("");
        setGenExpiresAt("");
      } else {
        setFetchError(data.error?.message || "Failed to generate keys");
      }
    } catch {
      setFetchError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this key?")) return;
    try {
      const data = await api.admin.deleteKey(id);
      if (data.success) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      } else {
        setFetchError(data.error?.message || "Failed to delete key");
      }
    } catch {
      setFetchError("Network error. Please try again.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filterButtons: Array<{ value: "all" | "active" | "expired"; label: string }> = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "expired", label: "Expired" },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Key className="w-5 h-5 text-[#e74c3c]" /> Key Management
        </h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowGenerate(!showGenerate)}
            className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Generate Keys
          </Button>
          <Button
            onClick={fetchKeys}
            variant="outline"
            size="sm"
            className="border-[#333] text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] h-8 w-8 p-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Generate Keys Form */}
      {showGenerate && (
        <div className="bg-[#111] border border-[#e74c3c]/30 rounded-xl p-5 mb-4 shadow-[0_0_15px_rgba(231,76,60,0.08)]">
          <h3 className="text-sm font-bold text-white mb-4">Generate New Keys</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1.5">Tier</label>
              <select
                value={genTier}
                onChange={(e) => setGenTier(e.target.value as TierKey)}
                className="w-full bg-[#1a1a1a] border border-[#333] text-white rounded-md px-3 py-2 text-sm focus:border-[#e74c3c] focus:outline-none"
              >
                {Object.keys(WHITELIST_TIERS).map((t) => (
                  <option key={t} value={t}>{getTierLabel(t as TierKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1.5">Count (1-100)</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={genCount}
                onChange={(e) => setGenCount(e.target.value)}
                className="bg-[#1a1a1a] border-[#333] text-white h-9 focus:border-[#e74c3c]"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1.5">Max Uses</label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={genMaxUses}
                onChange={(e) => setGenMaxUses(e.target.value)}
                className="bg-[#1a1a1a] border-[#333] text-white h-9 focus:border-[#e74c3c]"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1.5">Description (optional)</label>
              <Input
                value={genDescription}
                onChange={(e) => setGenDescription(e.target.value)}
                placeholder="Batch note..."
                className="bg-[#1a1a1a] border-[#333] text-white h-9 focus:border-[#e74c3c] placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1.5">Expires At (optional)</label>
              <Input
                type="datetime-local"
                value={genExpiresAt}
                onChange={(e) => setGenExpiresAt(e.target.value)}
                className="bg-[#1a1a1a] border-[#333] text-white h-9 focus:border-[#e74c3c] [color-scheme:dark]"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white h-9"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {generating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>

          {generatedKeys.length > 0 && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 font-semibold mb-2">
                Successfully generated {generatedKeys.length} key{generatedKeys.length > 1 ? "s" : ""}:
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {generatedKeys.map((k, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <code className="text-xs text-emerald-300 font-mono flex-1">{k}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(k)}
                      className="h-6 w-6 p-0 text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(generatedKeys.join("\n"))}
                className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy All Keys
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {fetchError && (
        <div className="mb-3 p-3 rounded-lg bg-[#e74c3c]/10 border border-[#e74c3c]/20 text-[#e74c3c] text-xs">
          {fetchError}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-3">
        {filterButtons.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-[#e74c3c]/15 text-[#e74c3c] border border-[#e74c3c]/30"
                : "bg-[#1a1a1a] text-[#a0a0a0] border border-[#222] hover:bg-[#222] hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-[10px] text-zinc-600 ml-2">{keys.length} key{keys.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Keys Table */}
      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#e74c3c] animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Key className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">No keys found</p>
            <p className="text-xs text-zinc-600 mt-1">Generate some keys to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0d0d0d] border-b border-[#222]">
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Key</th>
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Tier</th>
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Uses</th>
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Created</th>
                  <th className="text-right px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-white">{k.key}</code>
                        <button
                          onClick={() => copyToClipboard(k.key)}
                          className="p-0.5 text-zinc-600 hover:text-white transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      {k.description && <p className="text-[10px] text-zinc-600 mt-0.5">{k.description}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className="bg-[#e74c3c]/15 text-[#e74c3c] border-0 text-[10px] px-1.5 py-0">
                        {getTierLabel(k.tier as TierKey)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[#a0a0a0]">
                      <span className="text-white">{k.currentUses}</span>
                      <span className="text-zinc-600">/{k.maxUses}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {k.isExpired ? (
                        <Badge className="bg-red-500/15 text-red-400 border border-red-500/20 text-[10px] px-1.5 py-0 rounded-md">
                          Expired
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] px-1.5 py-0 rounded-md">
                          Active
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {new Date(k.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDeleteKey(k.id)}
                        className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Whitelist Management ─────────────────────────────────────────────────

function WhitelistManagement() {
  const [entries, setEntries] = useState<AdminWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const limit = 10;

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.listWhitelist(page, limit, search);
      if (data.success && data.data) {
        const wlData = data.data as { entries: AdminWhitelistEntry[]; pagination: { total: number; totalPages: number } };
        setEntries(wlData.entries);
        setTotalPages(wlData.pagination.totalPages);
        setTotal(wlData.pagination.total);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleToggleActive = async (entry: AdminWhitelistEntry) => {
    setUpdatingId(entry.id);
    try {
      const data = await api.admin.updateWhitelist(entry.id, { isActive: !entry.isActive });
      if (data.success) {
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, isActive: !e.isActive } : e))
        );
      }
    } catch {
      // Silently fail
    } finally {
      setUpdatingId(null);
    }
  };

  const handleChangeTier = async (entry: AdminWhitelistEntry, newTier: string) => {
    if (newTier === entry.tier) return;
    setUpdatingId(entry.id);
    try {
      const data = await api.admin.updateWhitelist(entry.id, { tier: newTier });
      if (data.success) {
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, tier: newTier } : e))
        );
      }
    } catch {
      // Silently fail
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const sourceLabels: Record<string, string> = {
    key: "Key",
    manual: "Manual",
    admin: "Admin",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[#e74c3c]" /> Whitelist Management
        </h2>
        <Button
          onClick={fetchEntries}
          variant="outline"
          size="sm"
          className="border-[#333] text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] h-8 w-8 p-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by Roblox username or email..."
          className="bg-[#1a1a1a] border-[#333] text-white pl-10 h-10 focus:border-[#e74c3c] placeholder:text-zinc-600"
        />
      </div>

      {/* Table */}
      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#e74c3c] animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">No whitelist entries found</p>
            <p className="text-xs text-zinc-600 mt-1">
              {search ? "Try a different search term" : "Users will appear here once whitelisted"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0d0d0d] border-b border-[#222]">
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Roblox ID</th>
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Tier</th>
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Source</th>
                  <th className="text-left px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Active</th>
                  <th className="text-right px-4 py-3 text-[#a0a0a0] font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {e.robloxAvatar ? (
                          <img src={e.robloxAvatar} alt={e.robloxUsername} className="w-7 h-7 rounded-md object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-md bg-[#1a1a1a] flex items-center justify-center">
                            <Users className="w-3.5 h-3.5 text-zinc-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{e.robloxUsername}</p>
                          <p className="text-[10px] text-zinc-600">{e.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 font-mono">{e.robloxId || "—"}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={e.tier}
                        onChange={(ev) => handleChangeTier(e, ev.target.value)}
                        disabled={updatingId === e.id}
                        className="bg-[#1a1a1a] border border-[#333] text-white rounded px-1.5 py-0.5 text-[10px] focus:border-[#e74c3c] focus:outline-none disabled:opacity-50"
                      >
                        {Object.keys(WHITELIST_TIERS).map((t) => (
                          <option key={t} value={t}>{getTierLabel(t as TierKey)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className="bg-[#222] text-[#a0a0a0] border-0 text-[10px] px-1.5 py-0">
                        {sourceLabels[e.source] || e.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleToggleActive(e)}
                        disabled={updatingId === e.id}
                        className="transition-colors disabled:opacity-50"
                        title={e.isActive ? "Click to deactivate" : "Click to activate"}
                      >
                        {e.isActive ? (
                          <ToggleRight className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-zinc-500" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {updatingId === e.id && (
                        <Loader2 className="w-3.5 h-3.5 text-[#e74c3c] animate-spin inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-[10px] text-zinc-600">
            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} entries
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-7 w-7 p-0 border-[#333] text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className={`h-7 w-7 p-0 text-xs ${
                    page === pageNum
                      ? "bg-[#e74c3c] hover:bg-[#c0392b] text-white border-0"
                      : "border-[#333] text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-7 w-7 p-0 border-[#333] text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuthStore();
  const tier = ((user as unknown as Record<string, unknown>)?.tier || "free") as string;

  const [stats, setStats] = useState({
    totalWhitelisted: 0,
    activeKeys: 0,
    redeemedKeys: 0,
    tierBreakdown: {} as Record<string, number>,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (tier !== "admin") return;

    async function loadStats() {
      try {
        // Fetch keys for stats via api client (auto token refresh)
        const keysData = await api.admin.listKeys("all");

        // Fetch whitelist entries for stats
        const wlData = await api.admin.listWhitelist(1, 1);

        if (keysData.success && wlData.success && keysData.data && wlData.data) {
          const allKeys = (keysData.data as { keys: AdminKey[] }).keys;
          const activeKeys = allKeys.filter((k) => !k.isExpired);
          const redeemedKeys = allKeys.filter((k) => k.currentUses > 0);

          // Tier breakdown from whitelist
          const tierBreakdown: Record<string, number> = {};
          const wlFullData = await api.admin.listWhitelist(1, 100);
          if (wlFullData.success && wlFullData.data) {
            const wlFull = wlFullData.data as { entries: AdminWhitelistEntry[] };
            wlFull.entries.forEach((e) => {
              tierBreakdown[e.tier] = (tierBreakdown[e.tier] || 0) + 1;
            });
          }

          const wlPagination = (wlData.data as { pagination: { total: number; totalPages: number } }).pagination;
          setStats({
            totalWhitelisted: wlPagination.total,
            activeKeys: activeKeys.length,
            redeemedKeys: redeemedKeys.length,
            tierBreakdown,
          });
        }
      } catch {
        // Silently fail
      } finally {
        setStatsLoading(false);
      }
    }

    loadStats();
  }, [tier]);

  // Admin guard
  if (tier !== "admin") {
    return <AccessDenied />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#e74c3c]" /> Admin Panel
        </h1>
        <p className="text-[#a0a0a0] text-sm mt-1">
          Manage whitelist entries, generate keys, and monitor system activity.
        </p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-[#1a1a1a] rounded w-1/2 mb-3" />
              <div className="h-7 bg-[#1a1a1a] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <StatsOverview stats={stats} />
      )}

      <KeyManagement />
      <WhitelistManagement />
    </div>
  );
}
