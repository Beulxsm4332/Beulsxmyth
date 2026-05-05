"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, LogOut, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/dashboard/Sidebar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/games": "Games",
  "/dashboard/executor": "Executor",
  "/dashboard/scripts": "Script Hub",
  "/dashboard/chat": "Chat",
  "/dashboard/whitelist": "Whitelist",
  "/dashboard/referral": "Referral",
  "/dashboard/download": "Download",
  "/dashboard/settings": "Settings",
};

function RealTimeClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-[#a0a0a0] text-sm font-mono">
      <Clock className="w-3.5 h-3.5" />
      <span>{time}</span>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { user, setUser, logout: storeLogout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationCount] = useState(3);

  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await api.auth.me();
        if (response.success && response.data) {
          setUser(response.data.user as {
            id: string;
            email: string;
            createdAt: string;
          });
        } else {
          setUser(null);
          router.push("/auth/login");
        }
      } catch {
        setUser(null);
        router.push("/auth/login");
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, [router, setUser]);

  const handleLogout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      storeLogout();
      router.push("/");
    }
  }, [storeLogout, router]);

  const pageTitle = pageTitles[pathname] || "Dashboard";

  const sidebarWidth = collapsed ? 64 : 240;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#e74c3c]/30 border-t-[#e74c3c] rounded-full animate-spin" />
          <p className="text-[#a0a0a0] text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      {/* Main area */}
      <motion.div
        initial={false}
        animate={{ marginLeft: isMobile ? 0 : sidebarWidth }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex flex-col min-h-screen"
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
      >
        {/* Top header bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-[#222] bg-[#0a0a0a]/90 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-4">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] -ml-2"
                onClick={() => setCollapsed(!collapsed)}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-current">
                  <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </Button>
            )}
            <h1 className="text-white font-semibold text-lg tracking-tight">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <RealTimeClock />
            <div className="h-5 w-px bg-[#333] hidden sm:block" />

            {/* Notification bell */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a]"
            >
              <Bell className="h-4 w-4" />
              {notificationCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-[#e74c3c] text-white text-[10px] border-0 rounded-full">
                  {notificationCount}
                </Badge>
              )}
            </Button>

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Avatar className="h-8 w-8 border border-[#e74c3c]/30">
                  <AvatarFallback className="bg-[#e74c3c]/15 text-[#e74c3c] text-xs font-bold">
                    {user.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a0a0a]" />
              </div>
              <span className="hidden sm:inline text-sm text-white font-medium max-w-[120px] truncate">
                {user.email.split("@")[0]}
              </span>
            </div>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-[#a0a0a0] hover:text-[#e74c3c] hover:bg-[#e74c3c]/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </motion.div>

      {/* Mobile sidebar overlay */}
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/60"
          onClick={() => setCollapsed(true)}
        />
      )}
    </div>
  );
}
