"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, logout: storeLogout } = useAuthStore();

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await api.auth.me();
        if (response.success && response.data) {
          setUser(response.data.user as { id: string; email: string; createdAt: string });
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    }
    checkAuth();
  }, [setUser]);

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      storeLogout();
      router.push("/");
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
  };
}
