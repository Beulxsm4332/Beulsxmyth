"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

interface SuccessStepProps {
  email: string;
  autoRedirect?: boolean;
}

export function SuccessStep({ email, autoRedirect = true }: SuccessStepProps) {
  const router = useRouter();

  useEffect(() => {
    if (!autoRedirect) return;

    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 2000);

    return () => clearTimeout(timer);
  }, [autoRedirect, router]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center space-y-5 animate-in fade-in duration-500">
      {/* Animated checkmark */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center border-2 border-emerald-500/30 animate-in zoom-in duration-500">
          <CheckCircle className="w-10 h-10 text-emerald-500 animate-in fade-in zoom-in duration-700 delay-300" />
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
      </div>

      {/* Success message */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white tracking-wide">
          VERIFICATION SUCCESSFUL
        </h2>
        <p className="text-zinc-400 text-sm">
          Your email{" "}
          <span className="text-white font-medium">{email}</span>{" "}
          has been verified.
        </p>
        <p className="text-zinc-500 text-sm">
          Redirecting to dashboard...
        </p>
      </div>

      {/* Manual redirect */}
      <p className="text-xs text-zinc-500">
        If you are not redirected automatically,{" "}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="text-[#e74c3c] font-medium hover:underline"
        >
          click here
        </button>
      </p>
    </div>
  );
}
