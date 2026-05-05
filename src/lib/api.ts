const API_BASE = "/api";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Admin key type
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

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    // Handle 401 — token expired
    if (response.status === 401) {
      // Try to refresh the token
      try {
        const refreshResult = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (refreshResult.ok) {
          // Retry the original request
          const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
              "Content-Type": "application/json",
              ...options.headers,
            },
            ...options,
          });
          const retryData = await retryResponse.json();
          return retryData;
        }
      } catch {
        // Refresh failed, return original error
      }
    }

    const data = await response.json();
    return data;
  } catch {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Network error. Please check your connection and try again.",
      },
    };
  }
}

export const api = {
  auth: {
    // Login with email + password (no OTP needed)
    login: (email: string, password: string) =>
      apiRequest<{ user: { id: string; email: string; createdAt: string; tier?: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    // Register with email + password, then verify via OTP
    register: (email: string, password: string) =>
      apiRequest<{ message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    sendOtp: (email: string) =>
      apiRequest<{ message: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    verifyOtp: (email: string, code: string) =>
      apiRequest<{ user: { id: string; email: string; createdAt: string; tier?: string } }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }),
    logout: () => apiRequest("/auth/logout", { method: "POST" }),
    me: () =>
      apiRequest<{ user: { id: string; email: string; createdAt: string; tier?: string } }>("/auth/me", { method: "GET" }),
    refresh: () => apiRequest("/auth/refresh", { method: "POST" }),
  },

  // Admin endpoints with auto token refresh via apiRequest
  admin: {
    listKeys: (status: string = "all") =>
      apiRequest<{ keys: AdminKey[]; total: number }>(`/admin/keys?status=${status}`),
    generateKeys: (data: { tier: string; count: number; maxUses: number; description?: string; expiresAt?: string }) =>
      apiRequest<{ keys: Array<{ id: string; key: string; tier: string; maxUses: number; description: string; expiresAt: string | null }>; count: number }>("/admin/keys/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteKey: (id: string) =>
      apiRequest(`/admin/keys/${id}`, { method: "DELETE" }),
    listWhitelist: (page: number, limit: number, search: string = "") =>
      apiRequest<{ entries: AdminWhitelistEntry[]; pagination: { total: number; totalPages: number } }>(`/admin/whitelist?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
    updateWhitelist: (id: string, data: { isActive?: boolean; tier?: string }) =>
      apiRequest(`/admin/whitelist/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  dashboard: {
    stats: () =>
      apiRequest<{ totalGames: number; activeServers: number; scriptsRunning: number; uptime: string }>("/dashboard/stats"),
    performance: () =>
      apiRequest<{ latency: number[]; frequency: number[]; timestamps: string[] }>("/dashboard/performance"),
  },

  games: {
    list: () => apiRequest<{ games: Array<{ id: string; name: string; placeId: string; playerCount: number; status: string; description: string; thumbnail: string }> }>("/games"),
    get: (id: string) => apiRequest<{ game: Record<string, unknown> }>(`/games/${id}`),
  },

  scripts: {
    list: (params?: { category?: string; search?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set("category", params.category);
      if (params?.search) searchParams.set("search", params.search);
      const query = searchParams.toString();
      return apiRequest<{ scripts: Array<{ id: string; name: string; description: string; code: string; category: string; isPublic: boolean; usageCount: number }> }>(
        `/scripts${query ? `?${query}` : ""}`
      );
    },
  },

  executor: {
    run: (data: { script_id?: string; raw_script?: string; game_id: string }) =>
      apiRequest<{ jobId: string; status: string }>("/executor/run", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    status: (jobId: string) =>
      apiRequest<{ jobId: string; status: string; logs: string }>(`/executor/status?jobId=${jobId}`),
  },

  client: {
    download: (platform: string) =>
      apiRequest<{ version: string; downloadUrl: string; changelog: string; mandatory: boolean }>(`/client/download/${platform}`),
    registerDevice: (data: { hwid: string; deviceName: string; platform: string }) =>
      apiRequest("/client/auth/device", { method: "POST", body: JSON.stringify(data) }),
    heartbeat: (data: { hwid: string; sessionToken: string }) =>
      apiRequest("/client/heartbeat", { method: "POST", body: JSON.stringify(data) }),
  },

  analytics: {
    track: (event: string, metadata?: Record<string, string>) =>
      apiRequest("/analytics/event", { method: "POST", body: JSON.stringify({ event, metadata }) }),
  },
};
