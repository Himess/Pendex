"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { NETWORK_CONTRACTS, type SupportedNetwork } from "@/lib/contracts/config";

// Minimal Oracle ABI for reading prices and market data
const ORACLE_ABI = [
  "function getAllAssetIds() external view returns (bytes32[])",
  "function getAsset(bytes32 assetId) external view returns (tuple(string name, string symbol, uint64 basePrice, bool isActive))",
  "function getCurrentPrice(bytes32 assetId) public view returns (uint64)",
  "function getMarketData(bytes32 assetId) external view returns (uint64 lastPrice, uint256 volume24h, uint256 totalOI, uint8 liquidityScore, string liquidityCategory)",
  "function getTotalOI(bytes32 assetId) external view returns (uint256)",
];

// RPC endpoints
const RPC_URLS: Record<SupportedNetwork, string> = {
  sepolia: "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a",
  hardhat: "http://127.0.0.1:8545",
};

export interface LiveAsset {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  price: number;
  basePrice: number;
  change24h: number;
  totalOI: number;           // Total OI only - direction is encrypted!
  volume24h: number;         // 24h trading volume
  liquidityScore: number;    // 0-100 liquidity score
  liquidityCategory: string; // VERY_HIGH, HIGH, MEDIUM, LOW, VERY_LOW
  isActive: boolean;
  // REMOVED: totalLongOI, totalShortOI, longRatio - direction is now encrypted!
}

interface UseLiveOracleReturn {
  assets: LiveAsset[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  refresh: () => Promise<void>;
}

// Default polling interval (10 seconds to avoid rate limiting)
const POLL_INTERVAL = 10000;

export function useLiveOracle(network: SupportedNetwork = "sepolia"): UseLiveOracleReturn {
  const [assets, setAssets] = useState<LiveAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  const contracts = NETWORK_CONTRACTS[network];

  const fetchAssets = useCallback(async () => {
    // Skip if no oracle address configured
    if (!contracts.shadowOracle || contracts.shadowOracle === "0x...") {
      setError("Oracle address not configured for this network");
      setIsLoading(false);
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
      const oracle = new ethers.Contract(contracts.shadowOracle, ORACLE_ABI, provider);

      const assetIds = await oracle.getAllAssetIds();
      const loadedAssets: LiveAsset[] = [];

      for (const assetId of assetIds) {
        try {
          const assetInfo = await oracle.getAsset(assetId);
          const currentPrice = await oracle.getCurrentPrice(assetId);

          const priceNumber = Number(currentPrice) / 1e6;
          const basePriceNumber = Number(assetInfo.basePrice) / 1e6;

          // Calculate change from base price
          const change24h = basePriceNumber > 0
            ? ((priceNumber - basePriceNumber) / basePriceNumber) * 100
            : 0;

          // Try to get market data (may fail on old contracts)
          let totalOI = 0;
          let volume24h = 0;
          let liquidityScore = 50;
          let liquidityCategory = "MEDIUM";

          try {
            const marketData = await oracle.getMarketData(assetId);
            totalOI = Number(marketData.totalOI) / 1e6;
            volume24h = Number(marketData.volume24h) / 1e6;
            liquidityScore = Number(marketData.liquidityScore);
            liquidityCategory = marketData.liquidityCategory;
          } catch {
            // Fallback for contracts without getMarketData
            try {
              totalOI = Number(await oracle.getTotalOI(assetId)) / 1e6;
            } catch {
              totalOI = priceNumber * 500000; // Fallback estimate
            }
            volume24h = priceNumber * 1000000 * 0.5; // Fallback estimate
          }

          loadedAssets.push({
            id: assetInfo.symbol.toLowerCase(),
            assetId: assetId,
            symbol: assetInfo.symbol,
            name: assetInfo.name,
            price: priceNumber,
            basePrice: basePriceNumber,
            change24h,
            totalOI,          // Total OI only - direction encrypted!
            volume24h,
            liquidityScore,
            liquidityCategory,
            isActive: assetInfo.isActive,
          });
        } catch (assetError) {
          console.warn(`Failed to load asset ${assetId}:`, assetError);
        }
      }

      setAssets(loadedAssets);
      setLastUpdate(Date.now());
      setError(null);
    } catch (e) {
      console.error("Failed to fetch oracle data:", e);
      setError("Failed to connect to oracle");
    } finally {
      setIsLoading(false);
    }
  }, [network, contracts.shadowOracle]);

  // Initial fetch
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAssets();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchAssets]);

  return {
    assets,
    isLoading,
    error,
    lastUpdate,
    refresh: fetchAssets,
  };
}

// Hook to get a single asset's live price
export function useLiveAssetPrice(symbol: string, network: SupportedNetwork = "sepolia") {
  const { assets, isLoading, error, lastUpdate, refresh } = useLiveOracle(network);

  const asset = assets.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());

  return {
    asset,
    isLoading,
    error,
    lastUpdate,
    refresh,
  };
}
