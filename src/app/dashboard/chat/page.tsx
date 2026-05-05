"use client";

import { useState } from "react";
import { MessageSquare, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const sampleMessages = [
  { id: "1", user: "Beulrock", message: "Welcome to Beulrock Chat! Connect with other developers.", time: "12:00 PM", isSystem: true },
  { id: "2", user: "DevMaster", message: "Hey everyone! Just got my Premium tier upgrade.", time: "12:05 PM", isSystem: false },
  { id: "3", user: "ScriptKing", message: "Nice! The extra whitelist slots are worth it alone.", time: "12:06 PM", isSystem: false },
  { id: "4", user: "RobloxDev", message: "Anyone tried the new Auto Farm script? It's amazing.", time: "12:10 PM", isSystem: false },
  { id: "5", user: "ProGamer99", message: "Yes! Works perfectly on Blox Fruits.", time: "12:11 PM", isSystem: false },
  { id: "6", user: "Beulrock", message: "Reminder: Keep discussions respectful and on-topic.", time: "12:15 PM", isSystem: true },
];

const onlineUsers = ["DevMaster", "ScriptKing", "RobloxDev", "ProGamer99", "NovaCoder", "PixelDev"];

export default function ChatPage() {
  const [messages, setMessages] = useState(sampleMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), user: "You", message: input, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isSystem: false }]);
    setInput("");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[#e74c3c]" /> Chat
        </h1>
        <p className="text-[#a0a0a0] text-sm mt-1">Communicate with other developers.</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Chat area */}
        <div className="flex-1 bg-[#111] border border-[#222] rounded-xl flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.isSystem ? "justify-center" : ""}`}>
                {m.isSystem ? (
                  <span className="text-[10px] text-[#f39c12] bg-[#f39c12]/10 px-3 py-1 rounded-full">{m.message}</span>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-full bg-[#e74c3c]/15 flex items-center justify-center shrink-0 border border-[#e74c3c]/20">
                      <span className="text-[10px] font-bold text-[#e74c3c]">{m.user.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{m.user}</span>
                        <span className="text-[10px] text-zinc-600">{m.time}</span>
                      </div>
                      <p className="text-sm text-[#a0a0a0] mt-0.5">{m.message}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-[#222] p-3 flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your message..." className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#e74c3c]" />
            <Button onClick={handleSend} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white h-9 px-4">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Online users */}
        <div className="hidden lg:block w-56 bg-[#111] border border-[#222] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3 flex items-center gap-1">
            <Users className="w-3 h-3" /> Online ({onlineUsers.length})
          </h3>
          <div className="space-y-2">
            {onlineUsers.map((u) => (
              <div key={u} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-white">{u}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
