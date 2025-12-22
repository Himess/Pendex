"use client";

import { useState, useMemo } from "react";
import { Asset, ASSETS, formatUSD, formatPercent } from "@/lib/constants";
import { useLiveAssetPrice } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketStatsProps {
  selectedAsset: Asset | null;
  onSelectAsset?: (asset: Asset) => void;
}

// Deterministic pseudo-random based on asset id (stable across renders)
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}

export function MarketStats({ selectedAsset, onSelectAsset }: MarketStatsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const network = useCurrentNetwork();
  const { asset: oracleAsset } = useLiveAssetPrice(
    selectedAsset?.symbol || "",
    network
  );

  const price = oracleAsset?.price ?? selectedAsset?.price ?? 0;
  const change24h = oracleAsset?.change24h ?? selectedAsset?.change24h ?? 0;
  // Total OI only - direction is encrypted on-chain!
  const totalOI = oracleAsset?.totalOI ?? 0;

  // Stable simulated values based on asset (no random jumps)
  const stableValues = useMemo(() => {
    if (!selectedAsset) return { indexPrice: 0, volume24h: 0, fundingRate: 0, nextFunding: 0 };

    const seed = selectedAsset.id;
    const r1 = seededRandom(seed + "index");
    const r2 = seededRandom(seed + "volume");
    const r3 = seededRandom(seed + "funding");
    const r4 = seededRandom(seed + "next");

    return {
      indexPrice: price * (1 + (r1 - 0.5) * 0.001),
      volume24h: selectedAsset.price * 1000000 * (0.5 + r2),
      fundingRate: 0.001 + (r3 - 0.5) * 0.002,
      nextFunding: Math.floor(r4 * 60),
    };
  }, [selectedAsset?.id, price]);

  const { indexPrice, volume24h, fundingRate, nextFunding } = stableValues;
  const openInterest = totalOI || price * 500000;

  if (!selectedAsset) {
    return null;
  }

  return (
    <div className="bg-card border-b border-border">
      <div className="flex items-center gap-6 px-4 py-2 overflow-x-auto">
        {/* Asset Info with Dropdown */}
        <div className="relative flex items-center gap-3 pr-4 border-r border-border">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onSelectAsset) {
                setIsDropdownOpen(!isDropdownOpen);
              }
            }}
            className={cn(
              "flex items-center gap-3 select-none",
              onSelectAsset && "cursor-pointer hover:opacity-80 transition-opacity"
            )}
          >
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
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary">{selectedAsset.symbol}</span>
                <span className="text-xs px-1.5 py-0.5 bg-gold/20 text-gold rounded">10x</span>
                {onSelectAsset && (
                  <ChevronDown className={cn(
                    "w-4 h-4 text-text-muted transition-transform",
                    isDropdownOpen && "rotate-180"
                  )} />
                )}
              </div>
              <span className="text-[10px] text-text-muted">Pre-IPO Perpetual</span>
            </div>
          </button>

          {/* Dropdown */}
          {isDropdownOpen && onSelectAsset && (
            <>
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-72 max-h-96 overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-[70]">
                {ASSETS.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => {
                      onSelectAsset(asset);
                      setIsDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-card-hover transition-colors",
                      selectedAsset?.id === asset.id && "bg-gold/10"
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center overflow-hidden border border-border flex-shrink-0">
                      {asset.logo ? (
                        <img
                          src={asset.logo}
                          alt={asset.symbol}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-gold">
                          {asset.symbol.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{asset.symbol}</div>
                      <div className="text-xs text-text-muted truncate">{asset.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono text-text-primary">{formatUSD(asset.price)}</div>
                      <div className={cn(
                        "text-xs font-mono",
                        asset.change24h >= 0 ? "text-success" : "text-danger"
                      )}>
                        {formatPercent(asset.change24h)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
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
            {nextFunding}:{String(Math.floor(seededRandom((selectedAsset?.id || "") + "seconds") * 60)).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
