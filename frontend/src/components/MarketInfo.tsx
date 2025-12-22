"use client";

import { Asset, formatUSD } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, DollarSign, Users, Clock, Lock, BarChart3, Shield, Zap } from "lucide-react";

interface MarketInfoProps {
  selectedAsset: Asset | null;
}

// Liquidity Score categories
type LiquidityCategory = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

function getLiquidityCategory(score: number): { category: LiquidityCategory; color: string } {
  if (score >= 90) return { category: "VERY_HIGH", color: "text-success" };
  if (score >= 70) return { category: "HIGH", color: "text-success" };
  if (score >= 50) return { category: "MEDIUM", color: "text-yellow-500" };
  if (score >= 30) return { category: "LOW", color: "text-orange-500" };
  return { category: "VERY_LOW", color: "text-danger" };
}

// Simulated market data with seeded randomness
function generateMarketData(asset: Asset) {
  const seed = asset.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const baseVolume = asset.price * 1000000 * (0.5 + random(1));
  const baseLiquidity = asset.price * 5000000 * (0.3 + random(4) * 0.7);

  // Calculate Liquidity Score (0-100)
  // Based on: LP Pool (40%), Volume (30%), OI (20%), Activity (10%)
  const lpScore = Math.min(40, (baseLiquidity / 10000000) * 40);
  const volScore = Math.min(30, (baseVolume / 5000000) * 30);
  const oiScore = Math.min(20, ((baseVolume * 0.4) / 20000000) * 20);
  const activityScore = Math.min(10, (random(8) > 0.3 ? 10 : 5));
  const liquidityScore = Math.round(lpScore + volScore + oiScore + activityScore);

  return {
    volume24h: baseVolume,
    volumeChange: (random(5) - 0.3) * 30,
    totalOI: baseVolume * 0.4, // Total OI only - no direction info!
    fundingRate: (random(2) - 0.5) * 0.02,
    liquidity: baseLiquidity,
    trades24h: Math.floor(500 + random(6) * 2000),
    liquidityScore: Math.min(100, liquidityScore),
    nextFunding: Math.floor(random(7) * 8 * 60), // minutes
  };
}

export function MarketInfo({ selectedAsset }: MarketInfoProps) {
  if (!selectedAsset) {
    return null;
  }

  const marketData = generateMarketData(selectedAsset);

  return (
    <div className="bg-card border border-border rounded-xl p-3 flex-shrink-0">
      {/* Compact horizontal layout */}
      <div className="flex items-center gap-6 overflow-x-auto">
        {/* Volume */}
        <div className="flex items-center gap-2 min-w-fit">
          <BarChart3 className="w-4 h-4 text-text-muted" />
          <div>
            <span className="text-xs text-text-muted">24h Vol</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-text-primary">
                {formatUSD(marketData.volume24h)}
              </span>
              <span
                className={cn(
                  "text-xs flex items-center",
                  marketData.volumeChange >= 0 ? "text-success" : "text-danger"
                )}
              >
                {marketData.volumeChange >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Total Open Interest - Direction is encrypted! */}
        <div className="flex items-center gap-2 min-w-fit">
          <Activity className="w-4 h-4 text-text-muted" />
          <div>
            <span className="text-xs text-text-muted">Total OI</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-text-primary">
                {formatUSD(marketData.totalOI)}
              </span>
              <span title="Direction encrypted"><Lock className="w-3 h-3 text-gold" /></span>
            </div>
          </div>
        </div>

        {/* Funding Rate */}
        <div className="flex items-center gap-2 min-w-fit">
          <DollarSign className="w-4 h-4 text-text-muted" />
          <div>
            <span className="text-xs text-text-muted">Funding</span>
            <span
              className={cn(
                "text-sm font-semibold block",
                marketData.fundingRate >= 0 ? "text-success" : "text-danger"
              )}
            >
              {marketData.fundingRate >= 0 ? "+" : ""}
              {(marketData.fundingRate * 100).toFixed(4)}%
            </span>
          </div>
        </div>

        {/* Next Funding */}
        <div className="flex items-center gap-2 min-w-fit">
          <Clock className="w-4 h-4 text-text-muted" />
          <div>
            <span className="text-xs text-text-muted">Next Funding</span>
            <span className="text-sm font-semibold text-text-primary block">
              {Math.floor(marketData.nextFunding / 60)}h {marketData.nextFunding % 60}m
            </span>
          </div>
        </div>

        {/* 24h Trades */}
        <div className="flex items-center gap-2 min-w-fit">
          <Users className="w-4 h-4 text-text-muted" />
          <div>
            <span className="text-xs text-text-muted">24h Trades</span>
            <span className="text-sm font-semibold text-text-primary block">
              {marketData.trades24h.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Liquidity */}
        <div className="flex items-center gap-2 min-w-fit">
          <DollarSign className="w-4 h-4 text-text-muted" />
          <div>
            <span className="text-xs text-text-muted">Liquidity</span>
            <span className="text-sm font-semibold text-text-primary block">
              {formatUSD(marketData.liquidity)}
            </span>
          </div>
        </div>

        {/* Liquidity Score - Visual bar */}
        <div className="flex items-center gap-2 min-w-fit ml-auto">
          <Shield className="w-4 h-4 text-gold" />
          <div>
            <span className="text-xs text-text-muted">Liquidity</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-background rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    marketData.liquidityScore >= 70 ? "bg-success" :
                    marketData.liquidityScore >= 50 ? "bg-yellow-500" :
                    marketData.liquidityScore >= 30 ? "bg-orange-500" : "bg-danger"
                  )}
                  style={{ width: `${marketData.liquidityScore}%` }}
                />
              </div>
              <span className={cn(
                "text-xs font-medium",
                getLiquidityCategory(marketData.liquidityScore).color
              )}>
                {marketData.liquidityScore}/100
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
