"use client";

interface CountdownTimerProps {
  seconds: number;
}

export function CountdownTimer({ seconds }: CountdownTimerProps) {
  const isExpired = seconds <= 0;
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  const formatted = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  if (isExpired) {
    return (
      <p className="text-sm text-center animate-pulse">
        <span className="text-[#e74c3c] font-medium">Code expired</span>
      </p>
    );
  }

  return (
    <p className="text-sm text-center text-zinc-500">
      Code expires in{" "}
      <span className="text-[#e74c3c] font-mono font-bold">{formatted}</span>
    </p>
  );
}
