"use client";

import { useState, FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Shield, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { VerifyStep } from "@/components/auth/VerifyStep";
import { SuccessStep } from "@/components/auth/SuccessStep";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useResendCooldown } from "@/hooks/use-countdown";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { cooldown: resendCooldown, isOnCooldown, startCooldown } = useResendCooldown(60);

  // Pre-fill email from query params (for NOT_VERIFIED redirect)
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
      // If coming from login with NOT_VERIFIED, go straight to OTP verification
      setStep(2);
      // Resend OTP
      api.auth.sendOtp(emailParam);
      startCooldown();
    }
  }, [searchParams, startCooldown]);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Validate email
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setErrorMessage("Please enter a valid email address");
      return;
    }

    // Validate password
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.auth.register(email.trim(), password);
      if (response.success) {
        setStep(2);
        startCooldown();
      } else {
        const errorCode = (response.error as { code?: string })?.code;
        if (errorCode === "EMAIL_EXISTS") {
          setErrorMessage("An account with this email already exists. Please log in instead.");
        } else {
          setErrorMessage(response.error?.message || "Registration failed");
        }
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await api.auth.verifyOtp(email, code);
      if (response.success && response.data) {
        const userData = response.data as { user: { id: string; email: string; tier?: string; createdAt: string } };
        setUser({
          id: userData.user.id,
          email: userData.user.email,
          tier: userData.user.tier,
          createdAt: userData.user.createdAt,
        });
        setStep(3);
      } else {
        setErrorMessage(response.error?.message || "Verification failed");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (isOnCooldown) return;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await api.auth.sendOtp(email);
      if (response.success) {
        startCooldown();
      } else {
        setErrorMessage(response.error?.message || "Failed to resend code");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row">
      {/* Left: Brand panel */}
      <div className="md:w-1/2 lg:w-5/12">
        <BrandPanel mode="register" />
      </div>

      {/* Right: Form panel */}
      <div className="md:w-1/2 lg:w-7/12 flex flex-col items-center justify-center px-6 py-10 md:py-0 md:px-12 lg:px-20">
        <div className="w-full max-w-md">
          {/* Error message */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-[#e74c3c]/10 border border-[#e74c3c]/20 text-[#e74c3c] text-sm">
              {errorMessage}
            </div>
          )}

          {/* Step 1: Register form */}
          {step === 1 && (
            <>
              <div className="space-y-2 mb-8">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-[#e74c3c]" />
                  <h2 className="text-sm font-bold text-[#e74c3c] tracking-wider">
                    CREATE ACCOUNT
                  </h2>
                </div>
                <h1 className="text-2xl font-bold text-white">Sign up for Beulrock</h1>
                <p className="text-zinc-400 text-sm">
                  Create your account with email and password. We&apos;ll verify your email with a code.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      className="pl-10 h-11 bg-[#1a1a1a] border-zinc-700 text-white placeholder:text-zinc-600 focus:border-[#e74c3c] focus:ring-[#e74c3c]/50"
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-medium">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      className="pl-10 pr-10 h-11 bg-[#1a1a1a] border-zinc-700 text-white placeholder:text-zinc-600 focus:border-[#e74c3c] focus:ring-[#e74c3c]/50"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-medium">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      className="pl-10 h-11 bg-[#1a1a1a] border-zinc-700 text-white placeholder:text-zinc-600 focus:border-[#e74c3c] focus:ring-[#e74c3c]/50"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-[#e74c3c] hover:bg-[#c0392b] text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>CREATING ACCOUNT...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>CREATE ACCOUNT</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Security badge */}
              <div className="flex items-start gap-3 bg-[#111] rounded-xl p-4 border border-zinc-800/50 mt-6">
                <div className="w-8 h-8 rounded-lg bg-[#e74c3c]/10 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-[#e74c3c]" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#e74c3c]" />
                    Secure & Protected
                  </p>
                  <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                    Your password is hashed with bcrypt. We never store plain text passwords.
                  </p>
                </div>
              </div>

              {/* Toggle link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-[#a0a0a0]">
                  Already have an account?{" "}
                  <Link
                    href="/auth/login"
                    className="text-[#e74c3c] font-medium hover:underline"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <VerifyStep
              email={email}
              onSubmit={handleVerifyOtp}
              onBack={handleBack}
              onResend={handleResend}
              isLoading={isLoading}
              resendCooldown={resendCooldown}
            />
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <SuccessStep email={email} autoRedirect />
          )}
        </div>
      </div>
    </div>
  );
}
