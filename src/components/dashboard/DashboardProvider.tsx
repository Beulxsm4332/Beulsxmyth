"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useDashboardStore } from "@/lib/dashboard-store";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/use-websocket";

export function DashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser } = useAuthStore();
  const { setStats } = useDashboardStore();

  // Initialize WebSocket
  useWebSocket();

  // Auth check — redirect to login if not authenticated
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await api.auth.me();
        if (response.success && response.data) {
          const userData = response.data.user as {
            id: string;
            email: string;
            createdAt: string;
            tier?: string;
          };
          setUser(userData);
        } else {
          setUser(null);
          router.push("/auth/login");
        }
      } catch {
        setUser(null);
        router.push("/auth/login");
      }
    }

    if (!user && isLoading) {
      checkAuth();
    }
  }, [user, isLoading, setUser, router]);

  // Load initial dashboard data
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadDashboardData() {
      try {
        const [statsRes] = await Promise.all([
          api.dashboard.stats(),
        ]);

        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data as {
            totalGames: number;
            activeServers: number;
            scriptsRunning: number;
            uptime: string;
          });
        }
      } catch (err) {
        console.error("[Dashboard] Failed to load initial data:", err);
      }
    }

    loadDashboardData();
  }, [isAuthenticated, setStats]);

  // Loading state
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#e74c3c]/15 flex items-center justify-center border border-[#e74c3c]/20 mx-auto mb-4 animate-pulse-red">
            <svg className="w-6 h-6 text-[#e74c3c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-[#a0a0a0] text-sm">Loading Beulrock...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return <>{children}</>;
}
