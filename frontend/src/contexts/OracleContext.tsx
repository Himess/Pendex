"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
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
  totalOI: number;
  volume24h: number;
  liquidityScore: number;
  liquidityCategory: string;
  isActive: boolean;
}

interface OracleContextType {
  assets: LiveAsset[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  refresh: () => Promise<void>;
  getAssetBySymbol: (symbol: string) => LiveAsset | undefined;
}

const OracleContext = createContext<OracleContextType | null>(null);

// Polling interval - 15 seconds to avoid rate limiting
const POLL_INTERVAL = 15000;

export function OracleProvider({
  children,
  network = "sepolia"
}: {
  children: ReactNode;
  network?: SupportedNetwork;
}) {
  const [assets, setAssets] = useState<LiveAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  // Ref to track if fetch is in progress (prevent duplicate calls)
  const isFetchingRef = useRef(false);
  const contracts = NETWORK_CONTRACTS[network];

  const fetchAssets = useCallback(async () => {
    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      console.log("⏭️ Oracle fetch already in progress, skipping...");
      return;
    }

    // Skip if no oracle address configured
    if (!contracts.shadowOracle || contracts.shadowOracle === "0x...") {
      setError("Oracle address not configured for this network");
      setIsLoading(false);
      return;
    }

    isFetchingRef.current = true;
    console.log("📡 Fetching oracle data...");

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
      const oracle = new ethers.Contract(contracts.shadowOracle, ORACLE_ABI, provider);

      const assetIds = await oracle.getAllAssetIds();
      const loadedAssets: LiveAsset[] = [];

      // Batch RPC calls using Promise.all for efficiency
      const assetPromises = assetIds.map(async (assetId: string) => {
        try {
          const [assetInfo, currentPrice] = await Promise.all([
            oracle.getAsset(assetId),
            oracle.getCurrentPrice(assetId),
          ]);

          const priceNumber = Number(currentPrice) / 1e6;
          const basePriceNumber = Number(assetInfo.basePrice) / 1e6;

          const change24h = basePriceNumber > 0
            ? ((priceNumber - basePriceNumber) / basePriceNumber) * 100
            : 0;

          // Try to get market data
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
            try {
              totalOI = Number(await oracle.getTotalOI(assetId)) / 1e6;
            } catch {
              totalOI = priceNumber * 500000;
            }
            volume24h = priceNumber * 1000000 * 0.5;
          }

          return {
            id: assetInfo.symbol.toLowerCase(),
            assetId: assetId,
            symbol: assetInfo.symbol,
            name: assetInfo.name,
            price: priceNumber,
            basePrice: basePriceNumber,
            change24h,
            totalOI,
            volume24h,
            liquidityScore,
            liquidityCategory,
            isActive: assetInfo.isActive,
          };
        } catch (assetError) {
          console.warn(`Failed to load asset ${assetId}:`, assetError);
          return null;
        }
      });

      const results = await Promise.all(assetPromises);
      const validAssets = results.filter((a): a is LiveAsset => a !== null);

      setAssets(validAssets);
      setLastUpdate(Date.now());
      setError(null);
      console.log(`✅ Oracle data loaded: ${validAssets.length} assets`);
    } catch (e) {
      console.error("Failed to fetch oracle data:", e);
      setError("Failed to connect to oracle");
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [network, contracts.shadowOracle]);

  // Initial fetch
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Polling with single interval
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAssets();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchAssets]);

  // Memoized asset lookup
  const getAssetBySymbol = useCallback((symbol: string) => {
    return assets.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
  }, [assets]);

  const value = useMemo(() => ({
    assets,
    isLoading,
    error,
    lastUpdate,
    refresh: fetchAssets,
    getAssetBySymbol,
  }), [assets, isLoading, error, lastUpdate, fetchAssets, getAssetBySymbol]);

  return (
    <OracleContext.Provider value={value}>
      {children}
    </OracleContext.Provider>
  );
}

// Hook to use oracle context
export function useOracle() {
  const context = useContext(OracleContext);
  if (!context) {
    throw new Error("useOracle must be used within an OracleProvider");
  }
  return context;
}

// Hook to get a single asset's live price (replaces useLiveAssetPrice)
export function useOracleAsset(symbol: string) {
  const { assets, isLoading, error, lastUpdate, refresh } = useOracle();

  const asset = useMemo(() => {
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
