import { create } from "zustand";

interface User {
  id: string;
  email: string;
  tier?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // OTP flow state
  otpEmail: string;
  otpStep: "email" | "verify" | "success";
  resendCooldown: number;
  // Actions
  setUser: (user: User | null) => void;
  setOtpEmail: (email: string) => void;
  setOtpStep: (step: "email" | "verify" | "success") => void;
  setResendCooldown: (seconds: number) => void;
  logout: () => void;
  resetOtpFlow: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  otpEmail: "",
  otpStep: "email",
  resendCooldown: 0,
  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),
  setOtpEmail: (email) => set({ otpEmail: email }),
  setOtpStep: (step) => set({ otpStep: step }),
  setResendCooldown: (seconds) => set({ resendCooldown: seconds }),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      otpEmail: "",
      otpStep: "email",
      resendCooldown: 0,
    }),
  resetOtpFlow: () =>
    set({
      otpEmail: "",
      otpStep: "email",
      resendCooldown: 0,
    }),
}));
