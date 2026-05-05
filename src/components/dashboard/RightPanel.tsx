"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Terminal,
  Copy,
  Trash2,
  Send,
  Shield,
  Clock,
  Wifi,
  Award,
  User,
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  id: number;
  timestamp: string;
  type: "SUCCESS" | "CONSOLE" | "ERROR" | "INFO" | "WARNING";
  message: string;
}

const initialLogs: LogEntry[] = [
  { id: 1, timestamp: "12:08:01", type: "SUCCESS", message: "Injected." },
  { id: 2, timestamp: "12:08:02", type: "CONSOLE", message: "Connected -> Spider-core" },
  { id: 3, timestamp: "12:08:03", type: "INFO", message: "Loading script modules..." },
  { id: 4, timestamp: "12:08:05", type: "SUCCESS", message: "Modules loaded successfully." },
  { id: 5, timestamp: "12:08:06", type: "CONSOLE", message: "Executing: init.lua" },
  { id: 6, timestamp: "12:08:07", type: "WARNING", message: "Deprecated API call detected in line 42." },
  { id: 7, timestamp: "12:08:08", type: "SUCCESS", message: "Script execution complete." },
  { id: 8, timestamp: "12:08:10", type: "INFO", message: "Heartbeat ping: 12ms" },
  { id: 9, timestamp: "12:08:12", type: "CONSOLE", message: "Session token refreshed." },
  { id: 10, timestamp: "12:08:15", type: "SUCCESS", message: "All systems operational." },
];

const typeColors: Record<string, string> = {
  SUCCESS: "text-emerald-500",
  CONSOLE: "text-[#3498db]",
  ERROR: "text-[#e74c3c]",
  INFO: "text-[#a0a0a0]",
  WARNING: "text-[#f39c12]",
};

export default function RightPanel() {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(initialLogs.length + 1);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const handleClear = () => {
    setLogs([]);
  };

  const handleCopy = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.type}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    setLogs((prev) => [
      ...prev,
      {
        id: nextId.current++,
        timestamp,
        type: "CONSOLE" as const,
        message: inputValue.trim(),
      },
    ]);
    setInputValue("");
  };

  return (
    <div className="space-y-4">
      {/* Scriptable Output Console */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-[#111] border border-[#222] rounded-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#222]">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#e74c3c]" />
            Scriptable Output
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-7 w-7 text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a]"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-7 w-7 text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="h-64 overflow-y-auto bg-[#0a0a0a] font-mono text-xs p-3 space-y-0.5"
        >
          {logs.length === 0 ? (
            <p className="text-[#555] italic">No output yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-1 leading-relaxed">
                <span className="text-[#555]">[{log.timestamp}]</span>
                <span className={typeColors[log.type] || "text-[#a0a0a0]"}>
                  [{log.type}]
                </span>
                <span className="text-[#ccc]">{log.message}</span>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-t border-[#222]">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Type your message..."
            className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-1.5 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#e74c3c]/50 font-mono"
          />
          <Button
            size="icon"
            onClick={handleSend}
            className="h-7 w-7 bg-[#e74c3c] hover:bg-[#c0392b] text-white shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>

      {/* User Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-[#111] border border-[#222] rounded-xl p-5"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <Avatar className="h-16 w-16 border-2 border-[#e74c3c]/40 shadow-[0_0_20px_rgba(231,76,60,0.3)]">
              <AvatarFallback className="bg-[#e74c3c]/15 text-[#e74c3c] text-xl font-bold">
                B
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#111]" />
          </div>

          <h3 className="text-white font-bold text-sm">@beulrock</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-emerald-500 text-xs">Online</span>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a0a0] flex items-center gap-1.5">
              <User className="w-3 h-3" />
              User ID
            </span>
            <span className="text-white font-mono">#28491</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a0a0] flex items-center gap-1.5">
              <Wifi className="w-3 h-3" />
              Server Status
            </span>
            <span className="text-emerald-500 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Connected
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a0a0] flex items-center gap-1.5">
              <Award className="w-3 h-3" />
              Membership
            </span>
            <Badge className="bg-[#e74c3c]/15 text-[#e74c3c] border-0 text-[10px] px-1.5 py-0">
              Premium
            </Badge>
          </div>
          <div className="h-px bg-[#222]" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a0a0] flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Account Created
            </span>
            <span className="text-white">Jan 15, 2025</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a0a0] flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              Last Login
            </span>
            <span className="text-white">Today</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a0a0] flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Session Uptime
            </span>
            <span className="text-white font-mono">02:34:12</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8 border-[#333] text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] hover:border-[#555]"
          >
            View Profile
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-xs h-8 text-[#e74c3c] hover:bg-[#e74c3c]/10"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
