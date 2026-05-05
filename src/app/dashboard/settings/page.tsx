"use client";

import { useState } from "react";
import { Settings, Shield, Bell, Trash2, Mail, LogOut, Key, Smartphone, Monitor, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { getTierLabel, type TierKey } from "@/lib/tier";

export default function SettingsPage() {
  const { user, logout: storeLogout } = useAuthStore();
  const router = useRouter();
  const tier = ((user as Record<string, unknown>)?.tier || "free") as TierKey;

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.auth.logout();
    } finally {
      storeLogout();
      router.push("/");
    }
  };

  const handleRevokeAllSessions = async () => {
    // For now just logout current session
    await handleLogout();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#e74c3c]" /> Settings
        </h1>
        <p className="text-[#a0a0a0] text-sm mt-1">Manage your account preferences.</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Profile */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#e74c3c]" /> Profile
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-[#e74c3c]/15 flex items-center justify-center border-2 border-[#e74c3c]/30">
              <span className="text-xl font-bold text-[#e74c3c]">
                {user?.email?.charAt(0).toUpperCase() || "B"}
              </span>
            </div>
            <div>
              <p className="text-base font-bold text-white">@{user?.email?.split("@")[0] || "beulrock"}</p>
              <span className="text-xs px-2 py-0.5 rounded bg-[#e74c3c]/15 text-[#e74c3c] font-semibold">{getTierLabel(tier)} Tier</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#a0a0a0] block mb-1">Email Address</label>
              <input type="email" value={user?.email || ""} readOnly
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-xs text-[#a0a0a0] block mb-1">Account Created</label>
              <p className="text-sm text-white">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-[#a0a0a0] block mb-1">User ID</label>
              <p className="text-sm text-white font-mono">{user?.id || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#e74c3c]" /> Security
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a]">
              <div>
                <p className="text-sm text-white">Active Sessions</p>
                <p className="text-xs text-zinc-600">1 active session on this device</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRevokeAllSessions} className="border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a] text-xs">Revoke All</Button>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a]">
              <div>
                <p className="text-sm text-white">Two-Factor Authentication</p>
                <p className="text-xs text-zinc-600">Add an extra layer of security via email verification</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-semibold">OTP Based</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a]">
              <div>
                <p className="text-sm text-white">HWID Binding</p>
                <p className="text-xs text-zinc-600">Lock your account to this device</p>
              </div>
              <Button variant="outline" size="sm" className="border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a] text-xs">Configure</Button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-white">Authentication Method</p>
                <p className="text-xs text-zinc-600">Passwordless OTP via email</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Key className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] text-emerald-500">Secure</span>
              </div>
            </div>
          </div>
        </div>

        {/* Connected Devices */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#e74c3c]" /> Connected Devices
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <Monitor className="w-4 h-4 text-[#a0a0a0]" />
                <div>
                  <p className="text-sm text-white">Current Device</p>
                  <p className="text-[10px] text-zinc-600">Web Browser • Active Now</p>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#e74c3c]" /> Notifications
          </h3>
          <div className="space-y-3">
            {[
              { label: "Email Notifications", desc: "Receive updates via email", default: true },
              { label: "Push Notifications", desc: "Browser push notifications", default: true },
              { label: "Chat Messages", desc: "Notify on new chat messages", default: false },
              { label: "Execution Alerts", desc: "Notify on script completion", default: true },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                <div>
                  <p className="text-sm text-white">{n.label}</p>
                  <p className="text-xs text-zinc-600">{n.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={n.default} className="sr-only peer" />
                  <div className="w-9 h-5 bg-[#333] peer-checked:bg-[#e74c3c] rounded-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#e74c3c]" /> Quick Actions
          </h3>
          <div className="space-y-3">
            <Button onClick={handleLogout} disabled={isLoggingOut} className="w-full bg-[#1a1a1a] hover:bg-[#222] text-white text-sm h-10 border border-[#333]">
              <LogOut className="w-4 h-4 mr-2" />
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-[#111] border border-[#e74c3c]/30 rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#e74c3c] mb-4 flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Danger Zone
          </h3>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Delete Account</p>
                <p className="text-xs text-zinc-600">Permanently delete your account and all data</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} className="border-[#e74c3c]/30 text-[#e74c3c] hover:bg-[#e74c3c]/10 text-xs">Delete Account</Button>
            </div>
          ) : (
            <div className="bg-[#e74c3c]/5 border border-[#e74c3c]/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#e74c3c]" />
                <p className="text-sm text-[#e74c3c] font-semibold">Are you absolutely sure?</p>
              </div>
              <p className="text-xs text-zinc-400 mb-3">This action cannot be undone. All your data, sessions, and executions will be permanently deleted.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} className="border-[#333] text-[#a0a0a0] hover:bg-[#1a1a1a] text-xs">Cancel</Button>
                <Button size="sm" className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-xs">Confirm Deletion</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
