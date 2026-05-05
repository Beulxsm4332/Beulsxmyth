"use client";

import { Users, Copy, CheckCircle, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);
  const referralCode = "BEULROCK-2024-XK9FM";
  const referralLink = `https://beulrock.com/ref/${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-[#e74c3c]" /> Referral Program
        </h1>
        <p className="text-[#a0a0a0] text-sm mt-1">Invite friends and earn rewards.</p>
      </div>

      {/* Referral code */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 mb-6">
        <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3">Your Referral Code</h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 font-mono text-white text-sm">
            {referralCode}
          </div>
          <Button onClick={handleCopy} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white">
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">Share this link: <span className="text-[#e74c3c]">{referralLink}</span></p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Referrals", value: "7", icon: Users, color: "#e74c3c" },
          { label: "Earned Credits", value: "$35", icon: Gift, color: "#2ecc71" },
          { label: "Active Referrals", value: "4", icon: CheckCircle, color: "#3498db" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">{s.label}</span>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-[#a0a0a0] tracking-wider mb-3">Referral History</h3>
        <div className="space-y-2">
          {[
            { user: "DevMaster", date: "May 20, 2024", status: "Active", reward: "$5" },
            { user: "ScriptKing", date: "May 18, 2024", status: "Active", reward: "$5" },
            { user: "NovaCoder", date: "May 15, 2024", status: "Active", reward: "$5" },
            { user: "PixelDev", date: "May 10, 2024", status: "Active", reward: "$5" },
            { user: "GhostUser", date: "May 5, 2024", status: "Inactive", reward: "$5" },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#e74c3c]/15 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[#e74c3c]">{r.user.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-xs text-white">{r.user}</p>
                  <p className="text-[10px] text-zinc-600">{r.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] ${r.status === "Active" ? "text-emerald-500" : "text-zinc-500"}`}>{r.status}</span>
                <span className="text-xs text-white font-medium">{r.reward}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
