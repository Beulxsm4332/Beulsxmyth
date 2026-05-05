"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";

interface DataPoint {
  time: string;
  value: number;
}

interface PerformanceMonitorProps {
  latencyData?: DataPoint[];
  frequencyData?: DataPoint[];
}

function generateSampleLatency(): DataPoint[] {
  const data: DataPoint[] = [];
  const now = Date.now();
  for (let i = 59; i >= 0; i--) {
    const t = new Date(now - i * 1000);
    data.push({
      time: t.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
      value: Math.floor(20 + Math.random() * 40 + Math.sin(i / 5) * 15),
    });
  }
  return data;
}

function generateSampleFrequency(): DataPoint[] {
  const data: DataPoint[] = [];
  const now = Date.now();
  for (let i = 59; i >= 0; i--) {
    const t = new Date(now - i * 1000);
    data.push({
      time: t.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
      value: Math.floor(200 + Math.random() * 150 + Math.cos(i / 8) * 80),
    });
  }
  return data;
}

const CustomTooltipLatency = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs">
        <p className="text-[#a0a0a0]">{label}</p>
        <p className="text-[#e74c3c] font-semibold">{payload[0].value}ms</p>
      </div>
    );
  }
  return null;
};

const CustomTooltipFrequency = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs">
        <p className="text-[#a0a0a0]">{label}</p>
        <p className="text-[#3498db] font-semibold">
          {payload[0].value} req/s
        </p>
      </div>
    );
  }
  return null;
};

export default function PerformanceMonitor({
  latencyData,
  frequencyData,
}: PerformanceMonitorProps) {
  const latency = useMemo(
    () => latencyData && latencyData.length > 0 ? latencyData : generateSampleLatency(),
    [latencyData]
  );
  const frequency = useMemo(
    () => frequencyData && frequencyData.length > 0 ? frequencyData : generateSampleFrequency(),
    [frequencyData]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-[#111] border border-[#222] rounded-xl p-5"
    >
      <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-[#e74c3c]" />
        Performance Monitor
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latency chart */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-4">
          <h3 className="text-xs text-[#a0a0a0] font-medium mb-3">
            Script Execution Latency (ms)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={latency}>
              <XAxis
                dataKey="time"
                stroke="#555"
                tick={{ fontSize: 9, fill: "#666" }}
                tickLine={false}
                axisLine={{ stroke: "#333" }}
                interval={14}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#555"
                tick={{ fontSize: 9, fill: "#666" }}
                tickLine={false}
                axisLine={{ stroke: "#333" }}
                width={30}
              />
              <Tooltip content={<CustomTooltipLatency />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#e74c3c"
                strokeWidth={2}
                dot={false}
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Frequency chart */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-4">
          <h3 className="text-xs text-[#a0a0a0] font-medium mb-3">
            Script Frequency (req/s)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={frequency}>
              <XAxis
                dataKey="time"
                stroke="#555"
                tick={{ fontSize: 9, fill: "#666" }}
                tickLine={false}
                axisLine={{ stroke: "#333" }}
                interval={14}
              />
              <YAxis
                domain={[0, 500]}
                stroke="#555"
                tick={{ fontSize: 9, fill: "#666" }}
                tickLine={false}
                axisLine={{ stroke: "#333" }}
                width={30}
              />
              <Tooltip content={<CustomTooltipFrequency />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3498db"
                strokeWidth={2}
                dot={false}
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
