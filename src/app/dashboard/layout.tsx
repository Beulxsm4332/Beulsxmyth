"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardProvider } from "@/components/dashboard/DashboardProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <DashboardProvider>
      <div className="min-h-screen bg-[#0a0a0a]">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-50 w-56">
              <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div
          className={`transition-all duration-300 ${
            collapsed ? "md:ml-16" : "md:ml-56"
          }`}
        >
          <DashboardHeader onMobileMenuToggle={() => setMobileOpen(!mobileOpen)} />
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}
