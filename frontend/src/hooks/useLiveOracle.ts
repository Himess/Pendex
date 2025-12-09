"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { NETWORK_CONTRACTS, type SupportedNetwork } from "@/lib/contracts/config";

// Minimal Oracle ABI for reading prices
const ORACLE_ABI = [
  "function getAllAssetIds() external view returns (bytes32[])",
  "function getAsset(bytes32 assetId) external view returns (tuple(string name, string symbol, uint64 basePrice, bool isActive, uint256 totalLongOI, uint256 totalShortOI))",
  "function getCurrentPrice(bytes32 assetId) public view returns (uint64)",
];

// RPC endpoints
const RPC_URLS: Record<SupportedNetwork, string> = {
  sepolia: "https://sepolia.infura.io/v3/84842078b09946638c03157f83405213",
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
  totalLongOI: number;
  totalShortOI: number;
  isActive: boolean;
  longRatio: number;
}

interface UseLiveOracleReturn {
  assets: LiveAsset[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  refresh: () => Promise<void>;
}

// Default polling interval (3 seconds)
const POLL_INTERVAL = 3000;

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
          const totalLongOI = Number(assetInfo.totalLongOI) / 1e6;
          const totalShortOI = Number(assetInfo.totalShortOI) / 1e6;

          // Calculate change from base price
          const change24h = basePriceNumber > 0
            ? ((priceNumber - basePriceNumber) / basePriceNumber) * 100
            : 0;

          // Calculate long ratio
          const totalOI = totalLongOI + totalShortOI;
          const longRatio = totalOI > 0 ? (totalLongOI / totalOI) * 100 : 50;

          loadedAssets.push({
            id: assetInfo.symbol.toLowerCase(),
            assetId: assetId,
            symbol: assetInfo.symbol,
            name: assetInfo.name,
            price: priceNumber,
            basePrice: basePriceNumber,
            change24h,
            totalLongOI,
            totalShortOI,
            isActive: assetInfo.isActive,
            longRatio,
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
  const { assets, isLoading, error, lastUpdate } = useLiveOracle(network);

  const asset = assets.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());

  return {
    asset,
    isLoading,
    error,
    lastUpdate,
  };
}
