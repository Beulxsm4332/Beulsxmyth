"use client";

import { useState, FormEvent } from "react";
import { Mail, ArrowRight, Shield, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EmailStepProps {
  onSubmit: (email: string) => void;
  isLoading: boolean;
  mode: "login" | "register";
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailStep({ onSubmit, isLoading, mode }: EmailStepProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email address is required");
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    onSubmit(email.trim());
  };

  const toggleText =
    mode === "register" ? (
      <>
        Already have an account?{" "}
        <span className="text-[#e74c3c] font-medium cursor-pointer hover:underline">
          Log in
        </span>
      </>
    ) : (
      <>
        Don&apos;t have an account?{" "}
        <span className="text-[#e74c3c] font-medium cursor-pointer hover:underline">
          Sign up
        </span>
      </>
    );

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#e74c3c]" />
          <h2 className="text-sm font-bold text-[#e74c3c] tracking-wider">
            ENTER YOUR EMAIL
          </h2>
        </div>
        <p className="text-zinc-400 text-sm">
          We&apos;ll send a 6-digit verification code to your email address.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              className="pl-10 h-11 bg-[#1a1a1a] border-zinc-700 text-white placeholder:text-zinc-600 focus:border-[#e74c3c] focus:ring-[#e74c3c]/50"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
          {error && (
            <p className="text-[#e74c3c] text-xs font-medium">{error}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 bg-[#e74c3c] hover:bg-[#c0392b] text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>SENDING...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>SEND VERIFICATION CODE</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#0a0a0a] px-3 text-zinc-500">OR</span>
        </div>
      </div>

      {/* Security badge */}
      <div className="flex items-start gap-3 bg-[#111] rounded-xl p-4 border border-zinc-800/50">
        <div className="w-8 h-8 rounded-lg bg-[#e74c3c]/10 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-[#e74c3c]" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-[#e74c3c]" />
            Secure &amp; Protected
          </p>
          <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
            Your data is encrypted with industry-standard AES-256 encryption.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-3 pt-2">
        <p className="text-xs text-zinc-500 text-center">
          By continuing, you agree to our{" "}
          <span className="text-[#e74c3c] cursor-pointer hover:underline">
            Terms of Service
          </span>
        </p>
        <p className="text-xs text-zinc-500 text-center">{toggleText}</p>
      </div>
    </div>
  );
}
