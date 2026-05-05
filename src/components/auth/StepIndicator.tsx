"use client";

import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { number: 1, label: "EMAIL" },
  { number: 2, label: "VERIFY" },
  { number: 3, label: "SUCCESS" },
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center w-full gap-0">
      {steps.map((step, index) => {
        const isActive = currentStep === step.number;
        const isCompleted = currentStep > step.number;
        const isInactive = currentStep < step.number;

        const circleClasses = isCompleted
          ? "bg-zinc-700 border-zinc-600"
          : isActive
            ? "bg-[#e74c3c] border-[#e74c3c]"
            : "bg-zinc-800 border-zinc-700";

        const textClasses = isCompleted
          ? "text-zinc-500"
          : isActive
            ? "text-[#e74c3c]"
            : "text-zinc-600";

        const numberTextClasses = isCompleted || isActive
          ? "text-white"
          : "text-zinc-500";

        const lineClasses =
          index < steps.length - 1
            ? currentStep > step.number
              ? "bg-[#e74c3c]"
              : "bg-zinc-700"
            : "";

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${circleClasses}`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <span
                    className={`text-sm font-bold ${numberTextClasses}`}
                  >
                    {step.number}
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-semibold tracking-wider ${textClasses}`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-12 sm:w-16 mx-2 mb-6 transition-all duration-300 ${lineClasses}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
