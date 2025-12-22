"use client";

import { AlertTriangle, XCircle, RefreshCw, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ErrorType = "error" | "warning" | "info";

interface ErrorMessageProps {
  type?: ErrorType;
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const typeConfig = {
  error: {
    icon: XCircle,
    bg: "bg-danger/10",
    border: "border-danger/30",
    iconColor: "text-danger",
    titleColor: "text-danger",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    iconColor: "text-yellow-500",
    titleColor: "text-yellow-500",
  },
  info: {
    icon: Info,
    bg: "bg-gold/10",
    border: "border-gold/30",
    iconColor: "text-gold",
    titleColor: "text-gold",
  },
};

export function ErrorMessage({
  type = "error",
  title,
  message,
  onRetry,
  onDismiss,
  className,
}: ErrorMessageProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        config.bg,
        config.border,
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.iconColor)} />
        <div className="flex-1 min-w-0">
          {title && (
            <p className={cn("text-sm font-medium mb-1", config.titleColor)}>
              {title}
            </p>
          )}
          <p className="text-xs text-text-secondary">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            "mt-2 w-full flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition-colors",
            type === "error" && "bg-danger/20 hover:bg-danger/30 text-danger",
            type === "warning" && "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500",
            type === "info" && "bg-gold/20 hover:bg-gold/30 text-gold"
          )}
        >
          <RefreshCw className="w-3 h-3" />
          Try Again
        </button>
      )}
    </div>
  );
}

// Compact inline error
export function ErrorInline({ message }: { message: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-danger">
      <XCircle className="w-3 h-3" />
      {message}
    </span>
  );
}

// Empty state with error
export function ErrorState({
  title = "Something went wrong",
  message = "Please try again later",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4">
        <XCircle className="w-8 h-8 text-danger" />
      </div>
      <h3 className="text-sm font-semibold text-text-secondary mb-2">{title}</h3>
      <p className="text-xs text-text-muted max-w-xs mb-6">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-danger text-white font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
