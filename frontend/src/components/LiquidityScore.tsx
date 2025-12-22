"use client";

import { cn } from "@/lib/utils";

interface LiquidityScoreProps {
  score: number;  // 0-100
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

// Kategori belirleme
function getCategory(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 90) return { label: "VERY HIGH", color: "text-emerald-400", bgColor: "bg-emerald-400" };
  if (score >= 70) return { label: "HIGH", color: "text-green-400", bgColor: "bg-green-400" };
  if (score >= 50) return { label: "MEDIUM", color: "text-yellow-400", bgColor: "bg-yellow-400" };
  if (score >= 30) return { label: "LOW", color: "text-orange-400", bgColor: "bg-orange-400" };
  return { label: "VERY LOW", color: "text-red-400", bgColor: "bg-red-400" };
}

// Size variants
const sizeConfig = {
  small: {
    text: "text-[10px]",
    bar: "h-1 w-12",
    gap: "gap-1.5",
    score: "text-[9px]",
  },
  medium: {
    text: "text-xs",
    bar: "h-1.5 w-20",
    gap: "gap-2",
    score: "text-[10px]",
  },
  large: {
    text: "text-sm",
    bar: "h-2 w-28",
    gap: "gap-3",
    score: "text-xs",
  },
};

export function LiquidityScore({ score, size = "medium", showLabel = true }: LiquidityScoreProps) {
  const { label, color, bgColor } = getCategory(score);
  const config = sizeConfig[size];

  return (
    <div className={cn("flex items-center", config.gap)}>
      {showLabel && (
        <span className={cn("text-text-muted", config.text)}>Liquidity:</span>
      )}

      <span className={cn("font-semibold", color, config.text)}>{label}</span>

      {/* Progress Bar */}
      <div className={cn("bg-background rounded-full overflow-hidden", config.bar)}>
        <div
          className={cn("h-full transition-all duration-300", bgColor)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>

      <span className={cn("text-text-muted font-mono", config.score)}>
        {score}/100
      </span>
    </div>
  );
}

// Compact version for tight spaces
export function LiquidityScoreCompact({ score }: { score: number }) {
  const { color, bgColor } = getCategory(score);

  return (
    <div className="flex items-center gap-1">
      <div className="w-8 h-1 bg-background rounded-full overflow-hidden">
        <div
          className={cn("h-full", bgColor)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("text-[9px] font-medium", color)}>{score}</span>
    </div>
  );
}

export default LiquidityScore;
