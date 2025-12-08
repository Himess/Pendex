"use client";

import { useState } from "react";
import { Lock, ArrowUp, ArrowDown, Info } from "lucide-react";
import { Asset } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TradingPanelProps {
  selectedAsset: Asset | null;
}

export function TradingPanel({ selectedAsset }: TradingPanelProps) {
  const [isLong, setIsLong] = useState(true);
  const [leverage, setLeverage] = useState(5);
  const [collateral, setCollateral] = useState("");

  const handlePlaceOrder = () => {
    if (!selectedAsset || !collateral) return;
    console.log("Placing encrypted order:", {
      asset: selectedAsset.symbol,
      isLong,
      leverage,
      collateral: parseFloat(collateral),
    });
    // TODO: Implement FHE encryption and contract call
  };

  return (
    <div className="w-80 bg-card border border-border rounded-xl overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary">TRADING</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Long/Short Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setIsLong(true)}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all duration-200",
              isLong
                ? "bg-success text-white shadow-success-glow"
                : "bg-success/20 text-success border border-success/30 hover:bg-success/30"
            )}
          >
            <ArrowUp className="w-4 h-4" />
            LONG
          </button>
          <button
            onClick={() => setIsLong(false)}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all duration-200",
              !isLong
                ? "bg-danger text-white shadow-danger-glow"
                : "bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30"
            )}
          >
            <ArrowDown className="w-4 h-4" />
            SHORT
          </button>
        </div>

        {/* Leverage Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">LEVERAGE</label>
            <span className="text-lg font-bold text-gold">{leverage}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-gold"
          />
          <div className="flex justify-between text-xs text-text-muted">
            <span>1x</span>
            <span>5x</span>
            <span>10x</span>
          </div>
        </div>

        {/* Collateral Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">
            COLLATERAL (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="0.00"
              className="input-field pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">
              USDC
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gold">
            <Lock className="w-3 h-3" />
            <span>Encrypted</span>
          </div>
        </div>

        {/* Position Preview */}
        <div className="bg-background rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">POSITION PREVIEW</h3>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">SIZE</span>
              <span className="encrypted-value flex items-center gap-1">
                ••••••••
                <Lock className="w-3 h-3 text-gold" />
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">LIQ. PRICE</span>
              <span className="encrypted-value flex items-center gap-1">
                ••••••••
                <Lock className="w-3 h-3 text-gold" />
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">FEES</span>
              <span className="encrypted-value flex items-center gap-1">
                ••••••••
                <Lock className="w-3 h-3 text-gold" />
              </span>
            </div>
          </div>
        </div>

        {/* Place Order Button */}
        <button
          onClick={handlePlaceOrder}
          disabled={!selectedAsset || !collateral}
          className={cn(
            "w-full py-4 rounded-lg font-bold text-background transition-all duration-200 flex items-center justify-center gap-2",
            selectedAsset && collateral
              ? "bg-gold hover:shadow-gold-glow active:scale-[0.98]"
              : "bg-gold/50 cursor-not-allowed"
          )}
        >
          <Lock className="w-4 h-4" />
          PLACE ENCRYPTED ORDER
        </button>

        {/* Info */}
        <div className="flex items-start gap-2 text-xs text-text-muted">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            Your position details are encrypted with FHE. Nobody can see your
            collateral, leverage, or direction - not even validators.
          </p>
        </div>
      </div>
    </div>
  );
}
