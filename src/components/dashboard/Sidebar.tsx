"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Gamepad2,
  Zap,
  BookOpen,
  MessageSquare,
  Shield,
  ShieldCheck,
  Users,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { getTierLabel, type TierKey } from "@/lib/tier";

const navItems = [
  { label: "Home", icon: Home, href: "/dashboard", adminOnly: false },
  { label: "Games", icon: Gamepad2, href: "/dashboard/games", adminOnly: false },
  { label: "Executor", icon: Zap, href: "/dashboard/executor", adminOnly: false },
  { label: "Script Hub", icon: BookOpen, href: "/dashboard/scripts", adminOnly: false },
  { label: "Chat", icon: MessageSquare, href: "/dashboard/chat", adminOnly: false },
  { label: "Whitelist", icon: Shield, href: "/dashboard/whitelist", adminOnly: false },
  { label: "Admin Panel", icon: ShieldCheck, href: "/dashboard/admin", adminOnly: true },
  { label: "Referral", icon: Users, href: "/dashboard/referral", adminOnly: false },
  { label: "Download", icon: Download, href: "/dashboard/download", adminOnly: false },
  { label: "Settings", icon: Settings, href: "/dashboard/settings", adminOnly: false },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { user } = useAuthStore();
  const tier = ((user as Record<string, unknown>)?.tier || "free") as TierKey;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#0a0a0a] border-r border-[#222] z-40 flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center border-b border-[#222] px-3">
        <Link href="/dashboard" className="flex items-center gap-2 w-full">
          <div className="w-9 h-9 rounded-lg bg-[#e74c3c]/15 flex items-center justify-center shrink-0 border border-[#e74c3c]/20">
            <Shield className="w-5 h-5 text-[#e74c3c]" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white leading-none">BEULROCK</p>
              <p className="text-[10px] font-bold text-[#e74c3c] tracking-widest leading-none mt-0.5">
                SERVERSIDE
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.filter((item) => !item.adminOnly || tier === "admin").map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onMouseEnter={() => setHoveredItem(item.label)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                active
                  ? "bg-[#e74c3c]/15 text-[#e74c3c] border-l-2 border-[#e74c3c]"
                  : "text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-white border-l-2 border-transparent"
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-[#e74c3c]" : ""}`} />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {collapsed && hoveredItem === item.label && (
                <div className="absolute left-14 bg-[#1a1a1a] text-white text-xs px-2 py-1 rounded shadow-lg border border-[#333] whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User tier badge + Skull logo area */}
      <div className="p-3 border-t border-[#222]">
        {!collapsed && (
          <div className="mb-3 px-2">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#e74c3c]/15 flex items-center justify-center border border-[#e74c3c]/20">
                <span className="text-xs font-bold text-[#e74c3c]">
                  {user?.email?.charAt(0).toUpperCase() || "B"}
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-white truncate">
                  @{user?.email?.split("@")[0] || "beulrock"}
                </p>
                <p className="text-[10px] text-[#e74c3c] font-semibold">{getTierLabel(tier)} Tier</p>
              </div>
            </div>
          </div>
        )}
        <div className={`flex items-center justify-center ${collapsed ? "" : "py-1"}`}>
          <div className="w-10 h-10 rounded-full bg-[#e74c3c]/10 border border-[#e74c3c]/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#e74c3c]" />
          </div>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-[#1a1a1a] border border-[#333] rounded-full flex items-center justify-center text-[#a0a0a0] hover:text-white hover:bg-[#e74c3c]/20 transition-colors z-50"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
