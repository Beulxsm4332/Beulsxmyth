import { create } from "zustand";

interface DashboardState {
  stats: {
    totalGames: number;
    activeServers: number;
    scriptsRunning: number;
    uptime: string;
  };
  performance: {
    latency: number[];
    frequency: number[];
    timestamps: string[];
  };
  serverStatus: Array<{
    id: string;
    name: string;
    status: string;
    load: number;
  }>;
  executions: Array<{
    jobId: string;
    status: string;
    logs: string;
    gameId: string;
  }>;
  wsConnected: boolean;
  // Actions
  setStats: (stats: DashboardState["stats"]) => void;
  setPerformance: (perf: DashboardState["performance"]) => void;
  setServerStatus: (servers: DashboardState["serverStatus"]) => void;
  addExecution: (exec: DashboardState["executions"][0]) => void;
  updateExecution: (jobId: string, data: Partial<DashboardState["executions"][0]>) => void;
  removeExecution: (jobId: string) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: {
    totalGames: 0,
    activeServers: 0,
    scriptsRunning: 0,
    uptime: "0%",
  },
  performance: {
    latency: [],
    frequency: [],
    timestamps: [],
  },
  serverStatus: [],
  executions: [],
  wsConnected: false,
  setStats: (stats) => set({ stats }),
  setPerformance: (performance) => set({ performance }),
  setServerStatus: (serverStatus) => set({ serverStatus }),
  addExecution: (exec) =>
    set((state) => {
      // Don't add duplicates
      if (state.executions.some((e) => e.jobId === exec.jobId)) {
        return state;
      }
      return { executions: [exec, ...state.executions].slice(0, 20) };
    }),
  updateExecution: (jobId, data) =>
    set((state) => ({
      executions: state.executions.map((e) =>
        e.jobId === jobId ? { ...e, ...data } : e
      ),
    })),
  removeExecution: (jobId) =>
    set((state) => ({
      executions: state.executions.filter((e) => e.jobId !== jobId),
    })),
  setWsConnected: (wsConnected) => set({ wsConnected }),
}));
