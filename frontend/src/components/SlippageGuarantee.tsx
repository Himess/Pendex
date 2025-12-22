"use client";

import { cn } from "@/lib/utils";
import { Gem, Shield, Info } from "lucide-react";
import { useState } from "react";

interface SlippageBand {
  maxOrderSize: number; // in USD
  maxSlippageBps: number; // basis points
}

interface SlippageGuaranteeProps {
  currentOrderSize?: number;
  showCompact?: boolean;
}

// Default slippage bands
const SLIPPAGE_BANDS: SlippageBand[] = [
  { maxOrderSize: 1000, maxSlippageBps: 10 },      // <$1K → 0.1%
  { maxOrderSize: 10000, maxSlippageBps: 30 },     // <$10K → 0.3%
  { maxOrderSize: 100000, maxSlippageBps: 50 },    // <$100K → 0.5%
  { maxOrderSize: 1000000, maxSlippageBps: 100 },  // <$1M → 1.0%
];

// Get current slippage for order size
function getCurrentSlippage(orderSize: number): { bps: number; label: string } {
  if (!orderSize || orderSize <= 0) {
    return { bps: 0, label: "0%" };
  }

  for (const band of SLIPPAGE_BANDS) {
    if (orderSize <= band.maxOrderSize) {
      return {
        bps: band.maxSlippageBps,
        label: `${(band.maxSlippageBps / 100).toFixed(1)}%`,
      };
    }
  }

  // Best effort for larger orders
  return { bps: 200, label: "Best effort" };
}

// Check if a band is highlighted (current order falls in this band)
function isBandHighlighted(band: SlippageBand, orderSize: number, bandIndex: number): boolean {
  if (!orderSize || orderSize <= 0) return false;

  if (bandIndex === 0) {
    return orderSize <= band.maxOrderSize;
  }

  const prevBand = SLIPPAGE_BANDS[bandIndex - 1];
  return orderSize > prevBand.maxOrderSize && orderSize <= band.maxOrderSize;
}

// Format number for display
function formatOrderSize(size: number): string {
  if (size >= 1000000) return `$${(size / 1000000).toFixed(0)}M`;
  if (size >= 1000) return `$${(size / 1000).toFixed(0)}K`;
  return `$${size}`;
}

// Compact preview for trade panel
export function SlippagePreview({ orderSize }: { orderSize: number }) {
  const { label } = getCurrentSlippage(orderSize);

  if (!orderSize || orderSize <= 0) return null;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted flex items-center gap-1">
        <Shield className="w-3 h-3 text-gold" />
        Max Slippage:
      </span>
      <span className="text-gold font-medium">{label}</span>
    </div>
  );
}

export function SlippageGuarantee({ currentOrderSize, showCompact = false }: SlippageGuaranteeProps) {
  const [showInfo, setShowInfo] = useState(false);
  const currentSlippage = getCurrentSlippage(currentOrderSize || 0);

  if (showCompact) {
    return (
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-gold" />
            <span className="text-xs font-medium text-gold">SLIPPAGE GUARANTEE</span>
          </div>
          <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded">LP BACKED</span>
        </div>
        {currentOrderSize && currentOrderSize > 0 && (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-text-muted">Max slippage:</span>
            <span className="text-gold font-bold">{currentSlippage.label}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Gem className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-gold">SLIPPAGE GUARANTEE</span>
          <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded">LP BACKED</span>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1 rounded hover:bg-card-hover transition-colors text-text-muted hover:text-gold"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="px-4 py-2 bg-gold/5 border-b border-gold/20 text-[11px] text-gold/80">
          Platform LP pool backs these guarantees. If execution exceeds band limits, the difference is compensated from the pool.
        </div>
      )}

      {/* Current Order Preview */}
      {currentOrderSize && currentOrderSize > 0 && (
        <div className="mx-4 mt-3 p-3 bg-success/10 border border-success/30 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-text-muted text-xs">Your order:</span>
            <span className="text-text-primary font-medium">${currentOrderSize.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs">Max slippage:</span>
            <span className="text-success font-bold text-lg">{currentSlippage.label}</span>
          </div>
        </div>
      )}

      {/* Bands Table */}
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 text-[11px] text-text-muted font-normal">Order Size</th>
              <th className="text-right py-2 text-[11px] text-text-muted font-normal">Max Slippage</th>
            </tr>
          </thead>
          <tbody>
            {SLIPPAGE_BANDS.map((band, index) => {
              const isHighlighted = isBandHighlighted(band, currentOrderSize || 0, index);
              return (
                <tr
                  key={index}
                  className={cn(
                    "transition-colors",
                    isHighlighted && "bg-success/10"
                  )}
                >
                  <td className={cn(
                    "py-2 text-sm",
                    isHighlighted ? "text-text-primary" : "text-text-secondary"
                  )}>
                    {formatOrderSize(band.maxOrderSize)}
                  </td>
                  <td className={cn(
                    "text-right py-2 text-sm",
                    isHighlighted ? "text-success font-bold" : "text-text-secondary"
                  )}>
                    {(band.maxSlippageBps / 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
            {/* Best effort row */}
            <tr>
              <td className="py-2 text-sm text-text-muted">&gt; $1M</td>
              <td className="text-right py-2 text-sm text-text-muted">Best effort</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/50 text-[10px] text-text-muted">
        * Excess slippage beyond band limits is compensated from LP pool
      </div>
    </div>
  );
}

export default SlippageGuarantee;
