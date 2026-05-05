"use client";

import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface WelcomeHeaderProps {
  username: string;
}

export default function WelcomeHeader({ username }: WelcomeHeaderProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const injectionProgress = 86;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[#111] border border-[#222] rounded-xl p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome back,{" "}
            <span className="text-gradient-red">@{username}</span>
          </h1>
          <p className="text-[#a0a0a0] mt-1 text-sm">
            Here&apos;s an overview of your system.
          </p>
          <div className="flex items-center gap-2 mt-2 text-[#a0a0a0] text-xs">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateStr}</span>
          </div>
        </div>

        <div className="w-full sm:w-64 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a0a0]">Injection Progress</span>
            <span className="text-[#e74c3c] font-semibold">
              {injectionProgress}%
            </span>
          </div>
          <Progress
            value={injectionProgress}
            className="h-2 bg-[#1a1a1a]"
          />
        </div>
      </div>
    </motion.div>
  );
}
