"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  className?: string;
}

const sizeConfig = {
  small: "w-4 h-4 border-2",
  medium: "w-6 h-6 border-2",
  large: "w-10 h-10 border-3",
};

export function LoadingSpinner({ size = "medium", className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "rounded-full border-border border-t-gold animate-spin",
        sizeConfig[size],
        className
      )}
    />
  );
}

// Full page loading state
export function LoadingPage({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
      <LoadingSpinner size="large" />
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

// Inline loading with text
export function LoadingInline({ text = "Loading" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-text-muted">
      <LoadingSpinner size="small" />
      <span className="text-xs">{text}...</span>
    </span>
  );
}

// Skeleton loader for content
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-card-hover rounded",
        className
      )}
    />
  );
}

export default LoadingSpinner;
