"use client";

import { useRef, useCallback, KeyboardEvent, ClipboardEvent } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const length = 6;

  const digits = value.padEnd(length, " ").split("").slice(0, length);

  const setRef = useCallback(
    (index: number) => (el: HTMLInputElement | null) => {
      inputRefs.current[index] = el;
    },
    []
  );

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus();
    }
  }, []);

  const handleChange = useCallback(
    (index: number, inputValue: string) => {
      const digit = inputValue.replace(/[^0-9]/g, "").slice(-1);
      if (!digit && inputValue !== "") return;

      const newDigits = [...digits.map((d) => (d === " " ? "" : d))];
      newDigits[index] = digit;

      const newValue = newDigits.join("").trim();
      onChange(newValue);

      if (digit) {
        focusInput(index + 1);
      }
    },
    [digits, onChange, focusInput]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        const currentDigit = digits[index] === " " ? "" : digits[index];
        if (!currentDigit && index > 0) {
          const newDigits = [...digits.map((d) => (d === " " ? "" : d))];
          newDigits[index - 1] = "";
          onChange(newDigits.join("").trim());
          focusInput(index - 1);
        } else {
          const newDigits = [...digits.map((d) => (d === " " ? "" : d))];
          newDigits[index] = "";
          onChange(newDigits.join("").trim());
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        focusInput(index - 1);
      } else if (e.key === "ArrowRight" && index < length - 1) {
        e.preventDefault();
        focusInput(index + 1);
      }
    },
    [digits, onChange, focusInput]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedData = e.clipboardData
        .getData("text/plain")
        .replace(/[^0-9]/g, "")
        .slice(0, length);

      if (pastedData.length > 0) {
        onChange(pastedData);
        const nextIndex = Math.min(pastedData.length, length - 1);
        focusInput(nextIndex);
      }
    },
    [onChange, focusInput]
  );

  const handleFocus = useCallback(
    (index: number) => {
      inputRefs.current[index]?.select();
    },
    []
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {Array.from({ length }, (_, index) => {
        const digit = digits[index] === " " ? "" : digits[index];
        return (
          <input
            key={index}
            ref={setRef(index)}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            disabled={disabled}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-[#1a1a1a] border-2 border-zinc-700 text-white text-center text-lg font-bold outline-none transition-all duration-200 focus:border-[#e74c3c] focus:ring-1 focus:ring-[#e74c3c]/50 disabled:opacity-50 disabled:cursor-not-allowed caret-[#e74c3c]"
            aria-label={`Digit ${index + 1} of ${length}`}
          />
        );
      })}
    </div>
  );
}
