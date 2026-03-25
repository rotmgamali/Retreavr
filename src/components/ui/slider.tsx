"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue = 0, min = 0, max = 100, step = 1, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const currentValue = value ?? internalValue;
    const percentage = ((currentValue - min) / (max - min)) * 100;

    return (
      <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            setInternalValue(newValue);
            onValueChange?.(newValue);
          }}
          className="sr-only"
          {...props}
        />
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute h-full rounded-full gradient-primary"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className="absolute h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
          style={{ left: `calc(${percentage}% - 10px)` }}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              const newValue = Math.min(currentValue + step, max);
              setInternalValue(newValue);
              onValueChange?.(newValue);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              const newValue = Math.max(currentValue - step, min);
              setInternalValue(newValue);
              onValueChange?.(newValue);
            }
          }}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
