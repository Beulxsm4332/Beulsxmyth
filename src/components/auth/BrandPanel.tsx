"use client";

import { Shield } from "lucide-react";

interface BrandPanelProps {
  mode: "login" | "register";
}

export function BrandPanel({ mode }: BrandPanelProps) {
  return (
    <>
      {/* Mobile: Compact header */}
      <div className="flex md:hidden flex-col items-center gap-3 py-6 px-4">
        <div className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-[#e74c3c]" />
          <span className="text-xl font-bold text-white tracking-tight">
            BEULROCK
          </span>
          <span className="text-xl font-bold text-[#e74c3c] tracking-tight">
            SERVERSIDE
          </span>
        </div>
        <p className="text-sm text-zinc-400 text-center">
          {mode === "register"
            ? "Join thousands of developers running better events"
            : "Login or register with your email to continue"}
        </p>
      </div>

      {/* Desktop: Full side panel */}
      <div className="hidden md:flex relative flex-col justify-between h-full bg-[#0a0a0a] p-10 lg:p-14 overflow-hidden">
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Red glow effects */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#e74c3c]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-10 w-56 h-56 bg-[#e74c3c]/8 rounded-full blur-[80px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-[#e74c3c]/5 rounded-full blur-[120px]" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl bg-[#e74c3c]/15 flex items-center justify-center border border-[#e74c3c]/20">
              <Shield className="w-7 h-7 text-[#e74c3c]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight leading-none">
                BEULROCK
              </h2>
              <p className="text-sm font-bold text-[#e74c3c] tracking-[0.2em] leading-none mt-1">
                SERVERSIDE
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {mode === "register" ? (
              <>
                <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
                  CREATE YOUR{" "}
                  <span className="text-[#e74c3c]">ACCOUNT</span>
                </h1>
                <p className="text-zinc-400 text-base max-w-xs">
                  Join thousands of developers running better events
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
                  WELCOME{" "}
                  <span className="text-[#e74c3c]">BACK</span>
                </h1>
                <p className="text-zinc-400 text-base max-w-xs">
                  Login or register with your email to continue
                </p>
              </>
            )}
          </div>
        </div>

        {/* Security notice */}
        <div className="relative z-10">
          <div className="flex items-start gap-3 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50 backdrop-blur-sm">
            <Shield className="w-5 h-5 text-[#e74c3c] shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-semibold">
                Secure &amp; Protected
              </p>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                We use industry-standard encryption to keep your account safe
                and secure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
