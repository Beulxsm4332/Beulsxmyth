"use client";

import { useState, FormEvent, useEffect, useCallback } from "react";
import { Shield, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OtpInput } from "./OtpInput";
import { CountdownTimer } from "./CountdownTimer";

interface VerifyStepProps {
  email: string;
  onSubmit: (code: string) => void;
  onBack: () => void;
  onResend: () => void;
  isLoading: boolean;
  resendCooldown: number;
}

function useOtpExpiry(initialSeconds: number = 300) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const reset = useCallback(() => {
    setSeconds(initialSeconds);
    setIsExpired(false);
  }, [initialSeconds]);

  return { seconds, isExpired, reset };
}

export function VerifyStep({
  email,
  onSubmit,
  onBack,
  onResend,
  isLoading,
  resendCooldown,
}: VerifyStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const { seconds: otpSeconds, isExpired: otpExpired } = useOtpExpiry(300);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError("Code must be exactly 6 digits");
      return;
    }

    if (otpExpired) {
      setError("Code has expired. Please request a new one.");
      return;
    }

    onSubmit(code);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#e74c3c]" />
          <h2 className="text-sm font-bold text-[#e74c3c] tracking-wider">
            ENTER VERIFICATION CODE
          </h2>
        </div>
        <p className="text-zinc-400 text-sm">
          Check your email and enter the 6-digit code below.
        </p>
      </div>

      {/* Email display */}
      <div className="bg-[#111] rounded-lg px-4 py-3 border border-zinc-800/50">
        <p className="text-xs text-zinc-500">Code sent to</p>
        <p className="text-white font-semibold text-sm mt-0.5">{email}</p>
      </div>

      {/* OTP Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <OtpInput
            value={code}
            onChange={(val) => {
              setCode(val);
              if (error) setError("");
            }}
            disabled={isLoading}
          />
          {error && (
            <p className="text-[#e74c3c] text-xs font-medium text-center">
              {error}
            </p>
          )}
        </div>

        {/* OTP expiry countdown */}
        <CountdownTimer seconds={otpSeconds} />

        <Button
          type="submit"
          disabled={isLoading || code.length !== 6 || otpExpired}
          className="w-full h-11 bg-[#e74c3c] hover:bg-[#c0392b] text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>VERIFYING...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>VERIFY CODE</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          )}
        </Button>
      </form>

      {/* Resend */}
      <div className="text-center">
        <p className="text-xs text-zinc-500">
          Didn&apos;t receive the code?{" "}
          {resendCooldown > 0 ? (
            <span className="text-zinc-600 cursor-not-allowed">
              Resend Code ({resendCooldown}s)
            </span>
          ) : (
            <span
              className="text-[#e74c3c] font-medium cursor-pointer hover:underline"
              onClick={onResend}
            >
              Resend Code
            </span>
          )}
        </p>
      </div>

      {/* Back link */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" />
          BACK TO EMAIL
        </button>
      </div>
    </div>
  );
}
