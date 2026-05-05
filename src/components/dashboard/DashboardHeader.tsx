"use client";

import { useState, useEffect } from "react";
import { Bell, LogOut, Shield, Menu, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useDashboardStore } from "@/lib/dashboard-store";

interface DashboardHeaderProps {
  onMobileMenuToggle?: () => void;
}

export function DashboardHeader({ onMobileMenuToggle }: DashboardHeaderProps) {
  const router = useRouter();
  const { user, logout: storeLogout } = useAuthStore();
  const wsConnected = useDashboardStore((s) => s.wsConnected);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } finally {
      storeLogout();
      router.push("/");
    }
  };

  return (
    <header className="h-16 border-b border-[#222] bg-[#0a0a0a]/90 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onMobileMenuToggle}
          className="md:hidden text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] p-1 h-8 w-8"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <Shield className="w-5 h-5 text-[#e74c3c] hidden sm:block" />
        <h1 className="text-base font-bold text-white tracking-wide">
          BEULROCK <span className="text-[#e74c3c]">EXECUTOR</span>
        </h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* WebSocket status indicator */}
        <div className="flex items-center gap-1.5" title={wsConnected ? "WebSocket Connected" : "WebSocket Disconnected"}>
          {wsConnected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
          )}
          <span className={`text-[10px] hidden sm:inline ${wsConnected ? "text-emerald-500" : "text-zinc-500"}`}>
            {wsConnected ? "LIVE" : "OFF"}
          </span>
        </div>

        <span className="text-xs text-[#a0a0a0] font-mono hidden sm:block">
          {time.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          {time.toLocaleTimeString("en-US", { hour12: true })}
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#e74c3c] rounded-full text-[8px] text-white flex items-center justify-center">
            3
          </span>
        </Button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#e74c3c]/15 flex items-center justify-center border border-[#e74c3c]/20">
            <span className="text-xs font-bold text-[#e74c3c]">
              {user?.email?.charAt(0).toUpperCase() || "B"}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm text-white font-medium">
              @{user?.email?.split("@")[0] || "beulrock"}
            </p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-emerald-500">Online</span>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-[#a0a0a0] hover:text-[#e74c3c] hover:bg-[#e74c3c]/10"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
