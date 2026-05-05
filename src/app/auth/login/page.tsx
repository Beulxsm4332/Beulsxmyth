"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Validate
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setErrorMessage("Please enter a valid email address");
      return;
    }
    if (!password) {
      setErrorMessage("Password is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.auth.login(email.trim(), password);
      if (response.success && response.data) {
        const userData = response.data as { user: { id: string; email: string; tier?: string; createdAt: string } };
        setUser({
          id: userData.user.id,
          email: userData.user.email,
          tier: userData.user.tier,
          createdAt: userData.user.createdAt,
        });
        router.push("/dashboard");
      } else {
        const errorCode = (response.error as { code?: string })?.code;
        if (errorCode === "NOT_VERIFIED") {
          setErrorMessage("Email not verified. Redirecting to verification...");
          // Redirect to register page with email pre-filled for OTP verification
          setTimeout(() => router.push(`/auth/register?email=${encodeURIComponent(email)}`), 1500);
        } else if (errorCode === "NO_PASSWORD") {
          setErrorMessage("This account needs a password. Please register again.");
        } else {
          setErrorMessage(response.error?.message || "Invalid email or password");
        }
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row">
      {/* Left: Brand panel */}
      <div className="md:w-1/2 lg:w-5/12">
        <BrandPanel mode="login" />
      </div>

      {/* Right: Form panel */}
      <div className="md:w-1/2 lg:w-7/12 flex flex-col items-center justify-center px-6 py-10 md:py-0 md:px-12 lg:px-20">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="space-y-2 mb-8">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#e74c3c]" />
              <h2 className="text-sm font-bold text-[#e74c3c] tracking-wider">
                WELCOME BACK
              </h2>
            </div>
            <h1 className="text-2xl font-bold text-white">Log in to Beulrock</h1>
            <p className="text-zinc-400 text-sm">
              Enter your email and password to access your account.
            </p>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-[#e74c3c]/10 border border-[#e74c3c]/20 text-[#e74c3c] text-sm">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  className="pl-10 h-11 bg-[#1a1a1a] border-zinc-700 text-white placeholder:text-zinc-600 focus:border-[#e74c3c] focus:ring-[#e74c3c]/50"
                  disabled={isLoading}
                  autoComplete="current-password"
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
                  <span>LOGGING IN...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>LOG IN</span>
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
                Secure Login
              </p>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                Your credentials are encrypted with industry-standard security.
              </p>
            </div>
          </div>

          {/* Toggle link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#a0a0a0]">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/register"
                className="text-[#e74c3c] font-medium hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
