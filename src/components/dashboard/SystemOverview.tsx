"use client";

import { motion } from "framer-motion";
import { Gamepad2, Server, Terminal, Clock } from "lucide-react";

interface SystemMetric {
  label: string;
  value: string;
  change: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const defaultMetrics: SystemMetric[] = [
  {
    label: "Total Games",
    value: "142",
    change: "+12 this week",
    icon: Gamepad2,
    iconColor: "text-[#e74c3c]",
    iconBg: "bg-[#e74c3c]/15",
  },
  {
    label: "Active Servers",
    value: "28",
    change: "+3 online",
    icon: Server,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/15",
  },
  {
    label: "Scripts Running",
    value: "16",
    change: "+2 active",
    icon: Terminal,
    iconColor: "text-[#f39c12]",
    iconBg: "bg-[#f39c12]/15",
  },
  {
    label: "System Uptime",
    value: "99.8%",
    change: "Excellent",
    icon: Clock,
    iconColor: "text-[#3498db]",
    iconBg: "bg-[#3498db]/15",
  },
];

interface SystemOverviewProps {
  metrics?: SystemMetric[];
}

export default function SystemOverview({ metrics }: SystemOverviewProps) {
  const data = metrics || defaultMetrics;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {data.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 * index }}
          className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#333] transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#a0a0a0] font-medium uppercase tracking-wider">
              {metric.label}
            </span>
            <div
              className={`w-8 h-8 rounded-lg ${metric.iconBg} flex items-center justify-center`}
            >
              <metric.icon className={`w-4 h-4 ${metric.iconColor}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{metric.value}</p>
          <p className="text-xs text-emerald-500 mt-1">{metric.change}</p>
        </motion.div>
      ))}
    </div>
  );
}
