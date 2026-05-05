"use client";

import { useState, useEffect, useCallback } from "react";

export function useCountdown(initialSeconds: number = 300) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);

  const start = useCallback((secs?: number) => {
    setSeconds(secs ?? initialSeconds);
    setIsRunning(true);
  }, [initialSeconds]);

  const reset = useCallback(() => {
    setSeconds(initialSeconds);
    setIsRunning(false);
  }, [initialSeconds]);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = useCallback((totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    seconds,
    formatted: formatTime(seconds),
    isRunning,
    isExpired: seconds <= 0,
    start,
    reset,
    stop,
  };
}

export function useResendCooldown(initialCooldown: number = 60) {
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = useCallback(() => {
    setCooldown(initialCooldown);
  }, [initialCooldown]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  return {
    cooldown,
    isOnCooldown: cooldown > 0,
    startCooldown,
  };
}
