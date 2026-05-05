"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Gamepad2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  {
    title: "Execute Script",
    description: "Inject and execute your favorite scripts.",
    icon: Zap,
    iconBg: "bg-[#e74c3c]/15",
    iconColor: "text-[#e74c3c]",
    buttonLabel: "Open Executor",
    href: "/dashboard/executor",
  },
  {
    title: "Open Games",
    description: "Browse and join your favorite games.",
    icon: Gamepad2,
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-500",
    buttonLabel: "Go to Games",
    href: "/dashboard/games",
  },
  {
    title: "Script Hub",
    description: "Explore and manage your script collection.",
    icon: BookOpen,
    iconBg: "bg-[#e74c3c]/15",
    iconColor: "text-[#e74c3c]",
    buttonLabel: "Open Script Hub",
    href: "/dashboard/scripts",
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {actions.map((action, index) => (
        <motion.div
          key={action.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 * index }}
          className="bg-[#111] border border-[#222] rounded-xl p-5 hover:border-[#333] transition-colors flex flex-col"
        >
          <div
            className={`w-10 h-10 rounded-lg ${action.iconBg} flex items-center justify-center mb-3`}
          >
            <action.icon className={`w-5 h-5 ${action.iconColor}`} />
          </div>
          <h3 className="text-white font-semibold text-sm">{action.title}</h3>
          <p className="text-[#a0a0a0] text-xs mt-1 flex-1">
            {action.description}
          </p>
          <Link href={action.href} className="mt-4">
            <Button
              size="sm"
              className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white"
            >
              {action.buttonLabel}
            </Button>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
