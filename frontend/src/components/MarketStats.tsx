"use client";

import { Asset, formatUSD, formatPercent } from "@/lib/constants";
import { useLiveAssetPrice } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketStatsProps {
  selectedAsset: Asset | null;
}

export function MarketStats({ selectedAsset }: MarketStatsProps) {
  const network = useCurrentNetwork();
  const { asset: oracleAsset } = useLiveAssetPrice(
    selectedAsset?.symbol || "",
    network
  );

  const price = oracleAsset?.price ?? selectedAsset?.price ?? 0;
  const change24h = oracleAsset?.change24h ?? selectedAsset?.change24h ?? 0;
  const totalLongOI = oracleAsset?.totalLongOI ?? 0;
  const totalShortOI = oracleAsset?.totalShortOI ?? 0;

  // Simulated values (would come from contract in production)
  const indexPrice = price * (1 + (Math.random() - 0.5) * 0.001);
  const volume24h = selectedAsset ? selectedAsset.price * 1000000 * (0.5 + Math.random()) : 0;
  const openInterest = totalLongOI + totalShortOI || price * 500000;
  const fundingRate = 0.001 + (Math.random() - 0.5) * 0.002;
  const nextFunding = Math.floor(Math.random() * 60);

  if (!selectedAsset) {
    return null;
  }

  return (
    <div className="bg-card border-b border-border">
      <div className="flex items-center gap-6 px-4 py-2 overflow-x-auto">
        {/* Asset Info */}
        <div className="flex items-center gap-3 pr-4 border-r border-border">
          <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center overflow-hidden border border-border">
            {selectedAsset.logo ? (
              <img
                src={selectedAsset.logo}
                alt={selectedAsset.symbol}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-gold">
                {selectedAsset.symbol.slice(0, 2)}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary">{selectedAsset.symbol}</span>
              <span className="text-xs px-1.5 py-0.5 bg-gold/20 text-gold rounded">10x</span>
            </div>
            <span className="text-[10px] text-text-muted">Pre-IPO Perpetual</span>
          </div>
        </div>

        {/* Mark Price */}
        <div className="flex flex-col min-w-[100px]">
          <span className="text-[10px] text-text-muted">Mark Price</span>
          <span className="text-sm font-semibold text-text-primary font-mono">
            {formatUSD(price)}
          </span>
        </div>

        {/* Index Price */}
        <div className="flex flex-col min-w-[100px]">
          <span className="text-[10px] text-text-muted">Index Price</span>
          <span className="text-sm font-mono text-text-secondary">
            {formatUSD(indexPrice)}
          </span>
        </div>

        {/* 24h Change */}
        <div className="flex flex-col min-w-[80px]">
          <span className="text-[10px] text-text-muted">24h Change</span>
          <div className="flex items-center gap-1">
            {change24h >= 0 ? (
              <TrendingUp className="w-3 h-3 text-success" />
            ) : (
              <TrendingDown className="w-3 h-3 text-danger" />
            )}
            <span
              className={cn(
                "text-sm font-mono font-medium",
                change24h >= 0 ? "text-success" : "text-danger"
              )}
            >
              {formatPercent(change24h)}
            </span>
          </div>
        </div>

        {/* 24h Volume */}
        <div className="flex flex-col min-w-[120px]">
          <span className="text-[10px] text-text-muted">24h Volume</span>
          <span className="text-sm font-mono text-text-secondary">
            ${(volume24h / 1000000).toFixed(2)}M
          </span>
        </div>

        {/* Open Interest */}
        <div className="flex flex-col min-w-[120px]">
          <span className="text-[10px] text-text-muted">Open Interest</span>
          <span className="text-sm font-mono text-text-secondary">
            ${(openInterest / 1000000).toFixed(2)}M
          </span>
        </div>

        {/* Funding Rate */}
        <div className="flex flex-col min-w-[80px]">
          <span className="text-[10px] text-text-muted">1hr Funding</span>
          <span
            className={cn(
              "text-sm font-mono",
              fundingRate >= 0 ? "text-success" : "text-danger"
            )}
          >
            {(fundingRate * 100).toFixed(4)}%
          </span>
        </div>

        {/* Next Funding */}
        <div className="flex flex-col min-w-[80px]">
          <span className="text-[10px] text-text-muted">Next Funding</span>
          <span className="text-sm font-mono text-text-secondary">
            {nextFunding}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
