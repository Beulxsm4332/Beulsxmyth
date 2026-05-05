"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, Copy, Play, CheckCircle, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const categories = ["All", "Farming", "Movement", "Visual", "Utility", "General"];

interface Script {
  id: string;
  name: string;
  description: string;
  code: string;
  category: string;
  isPublic: boolean;
  usageCount: number;
}

export default function ScriptsPage() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);

  // Load scripts from API
  useEffect(() => {
    async function loadScripts() {
      setLoading(true);
      try {
        const params: { category?: string; search?: string } = {};
        if (category !== "All") params.category = category;
        if (search) params.search = search;

        const result = await api.scripts.list(params);
        if (result.success && result.data) {
          setScripts((result.data as { scripts: Script[] }).scripts || []);
        }
      } catch (err) {
        console.error("[Scripts] Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }

    // Debounce search
    const timer = setTimeout(loadScripts, 300);
    return () => clearTimeout(timer);
  }, [category, search]);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      farming: "#2ecc71",
      movement: "#3498db",
      visual: "#9b59b6",
      utility: "#f39c12",
      general: "#a0a0a0",
    };
    return colors[cat.toLowerCase()] || "#a0a0a0";
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#e74c3c]" /> Script Hub
          </h1>
          <p className="text-[#a0a0a0] text-sm mt-1">Explore and manage your script collection.</p>
        </div>
        <span className="text-xs text-[#a0a0a0]">{scripts.length} scripts available</span>
      </div>

      {/* Category tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1.5 overflow-x-auto">
          {categories.map((c) => (
            <Button key={c} variant={category === c ? "default" : "outline"} size="sm"
              onClick={() => setCategory(c)}
              className={category === c ? "bg-[#e74c3c] text-white text-xs whitespace-nowrap" : "border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a] text-xs whitespace-nowrap"}>
              {c}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input type="text" placeholder="Search scripts..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 h-9 bg-[#111] border border-[#333] rounded-lg px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#e74c3c]" />
        </div>
      </div>

      {/* Scripts grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-[#1a1a1a] rounded w-2/3 mb-3" />
              <div className="h-3 bg-[#1a1a1a] rounded w-full mb-2" />
              <div className="h-3 bg-[#1a1a1a] rounded w-1/3 mb-4" />
              <div className="flex gap-2">
                <div className="h-7 bg-[#1a1a1a] rounded w-16" />
                <div className="h-7 bg-[#1a1a1a] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No scripts found</p>
          <p className="text-zinc-600 text-xs mt-1">Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script, i) => (
            <motion.div key={script.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#333] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">{script.name}</h3>
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: `${getCategoryColor(script.category)}15`, color: getCategoryColor(script.category) }}>
                  <Tag className="w-2.5 h-2.5" /> {script.category}
                </span>
              </div>
              <p className="text-xs text-[#a0a0a0] mb-3 line-clamp-2">{script.description}</p>
              <p className="text-[10px] text-zinc-600 mb-3">{script.usageCount.toLocaleString()} uses</p>
              <div className="flex gap-2">
                <a href={`/dashboard/executor?script=${script.id}`}>
                  <Button size="sm" className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-xs h-7">
                    <Play className="w-3 h-3 mr-1" /> Use
                  </Button>
                </a>
                <Button size="sm" variant="outline" onClick={() => handleCopy(script.id, script.code)}
                  className="border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a] text-xs h-7">
                  {copiedId === script.id ? <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedId === script.id ? "Copied!" : "Copy"}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
