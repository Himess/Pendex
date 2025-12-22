"use client";

import { useMemo } from "react";
import { useOracle, useOracleAsset, type LiveAsset } from "@/contexts/OracleContext";
import { type SupportedNetwork } from "@/lib/contracts/config";

// Re-export type for backward compatibility
export type { LiveAsset };

interface UseLiveOracleReturn {
  assets: LiveAsset[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  refresh: () => Promise<void>;
}

/**
 * useLiveOracle - Hook for accessing live oracle data
 *
 * This hook now uses the centralized OracleContext to prevent
 * multiple polling instances and excessive RPC calls.
 *
 * The `network` parameter is kept for backward compatibility but
 * the actual network is now controlled by the OracleProvider.
 */
export function useLiveOracle(_network: SupportedNetwork = "sepolia"): UseLiveOracleReturn {
  const { assets, isLoading, error, lastUpdate, refresh } = useOracle();

  return {
    assets,
    isLoading,
    error,
    lastUpdate,
    refresh,
  };
}

/**
 * useLiveAssetPrice - Hook to get a single asset's live price
 *
 * Uses the centralized OracleContext - no duplicate polling!
 */
export function useLiveAssetPrice(symbol: string, _network: SupportedNetwork = "sepolia") {
  const { assets, isLoading, error, lastUpdate, refresh } = useOracle();

  const asset = useMemo(() => {
    if (!symbol) return undefined;
    return assets.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
  }, [assets, symbol]);

  return {
    asset,
    isLoading,
    error,
    lastUpdate,
    refresh,
  };
}
