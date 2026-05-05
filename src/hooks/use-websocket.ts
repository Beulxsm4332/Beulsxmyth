"use client";

import { useEffect, useRef, useCallback } from "react";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useAuthStore } from "@/lib/store";

interface WSMessage {
  channel: string;
  data: Record<string, unknown>;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3033";
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectFnRef = useRef<() => void>(() => {});

  const { setStats, setPerformance, setServerStatus, updateExecution, addExecution, setWsConnected } = useDashboardStore();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.channel) {
          case "system:stats": {
            const data = msg.data as {
              latency: number[];
              frequency: number[];
              timestamps: string[];
              cpu: number;
              memory: number;
              queueSize: number;
              totalGames?: number;
              activeServers?: number;
              scriptsRunning?: number;
              uptime?: number;
            };
            setPerformance({
              latency: data.latency,
              frequency: data.frequency,
              timestamps: data.timestamps,
            });
            setStats({
              totalGames: data.totalGames || useDashboardStore.getState().stats.totalGames,
              activeServers: data.activeServers || useDashboardStore.getState().stats.activeServers,
              scriptsRunning: data.scriptsRunning ?? data.queueSize ?? useDashboardStore.getState().stats.scriptsRunning,
              uptime: data.uptime ? `${data.uptime}%` : useDashboardStore.getState().stats.uptime,
            });
            break;
          }

          case "server:status": {
            const data = msg.data as {
              servers: Array<{ id: string; name: string; status: string; load: number }>;
            };
            setServerStatus(data.servers);
            break;
          }

          case "execution:update": {
            const data = msg.data as { jobId: string; status: string; logs: string };
            if (data.jobId) {
              updateExecution(data.jobId, {
                status: data.status,
                logs: data.logs,
              });
            }
            break;
          }

          default:
            // Handle user-specific execution channels (execution:userId)
            if (msg.channel?.startsWith("execution:")) {
              const data = msg.data as { jobId: string; status: string; logs: string };
              if (data?.jobId) {
                // Check if we already have this execution, add or update
                const existing = useDashboardStore.getState().executions.find(e => e.jobId === data.jobId);
                if (existing) {
                  updateExecution(data.jobId, {
                    status: data.status,
                    logs: data.logs,
                  });
                } else {
                  addExecution({
                    jobId: data.jobId,
                    status: data.status,
                    logs: data.logs,
                    gameId: "",
                  });
                }
              }
            }
            break;
        }
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    },
    [setStats, setPerformance, setServerStatus, updateExecution, addExecution]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (!useAuthStore.getState().isAuthenticated || !useAuthStore.getState().user?.id) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log("[WS] Connected to", WS_URL);
        useDashboardStore.getState().setWsConnected(true);
        reconnectAttempts.current = 0;

        // Authenticate with the WebSocket server
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          ws.send(JSON.stringify({
            type: "auth",
            userId,
          }));
        }
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        useDashboardStore.getState().setWsConnected(false);
        wsRef.current = null;

        if (useAuthStore.getState().isAuthenticated && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts.current);
          reconnectAttempts.current++;
          console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimer.current = setTimeout(() => connectFnRef.current(), delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[WS] Connection failed:", err);
    }
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnectAttempts.current = 0;
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }
    useDashboardStore.getState().setWsConnected(false);
  }, []);

  // Store connect ref for reconnect timer
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  // Connect when authenticated, disconnect when not
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, user?.id, connect, disconnect]);

  const sendMessage = useCallback((channel: string, data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ channel, data }));
    }
  }, []);

  return {
    isConnected: useDashboardStore((s) => s.wsConnected),
    connect,
    disconnect,
    sendMessage,
  };
}
