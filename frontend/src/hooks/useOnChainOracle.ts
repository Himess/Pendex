"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ethers } from "ethers";

// Contract ABIs (minimal for reading)
const ORACLE_ABI = [
  "function getAllAssetIds() external view returns (bytes32[])",
  "function getAsset(bytes32 assetId) external view returns (tuple(string name, string symbol, uint64 basePrice, bool isActive, uint256 totalLongOI, uint256 totalShortOI))",
  "function getCurrentPrice(bytes32 assetId) public view returns (uint64)",
  "function getAssetId(string symbol) external pure returns (bytes32)",
  "event PriceUpdated(bytes32 indexed assetId, uint64 newPrice)",
];

const MARKET_MAKER_ABI = [
  "function getCandles(bytes32 assetId, uint256 count) external view returns (tuple(uint256 timestamp, uint64 open, uint64 high, uint64 low, uint64 close, uint256 volume, uint256 tradeCount)[])",
  "function getCurrentCandle(bytes32 assetId) external view returns (tuple(uint256 timestamp, uint64 open, uint64 high, uint64 low, uint64 close, uint256 volume, uint256 tradeCount))",
  "function getBotStats() external view returns (uint256 totalTrades, uint256 lastExecution, uint8 scenario)",
  "event TradeExecuted(uint256 indexed tradeId, bytes32 indexed assetId, uint64 priceAfter, uint256 timestamp)",
  "event CandleUpdated(bytes32 indexed assetId, uint256 indexed timestamp, uint64 open, uint64 high, uint64 low, uint64 close)",
];

// Configuration
const CONFIG = {
  // RPC URLs
  ZAMA_RPC: process.env.NEXT_PUBLIC_ZAMA_RPC || "https://devnet.zama.ai",
  SEPOLIA_RPC: process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://sepolia.infura.io/v3/your-key",

  // Contract addresses (set after deployment)
  ORACLE_ADDRESS: process.env.NEXT_PUBLIC_ORACLE_ADDRESS || "",
  MARKET_MAKER_ADDRESS: process.env.NEXT_PUBLIC_MARKET_MAKER_ADDRESS || "",

  // Polling interval (ms)
  POLL_INTERVAL: 3000,
};

export interface OnChainAsset {
  id: string;
  assetId: string; // bytes32
  symbol: string;
  name: string;
  price: number;
  basePrice: number;
  change24h: number;
  totalLongOI: number;
  totalShortOI: number;
  isActive: boolean;
}

export interface OnChainCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
}

export interface BotStats {
  totalTrades: number;
  lastExecution: number;
  scenario: string;
}

interface UseOnChainOracleReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  assets: OnChainAsset[];
  currentAsset: OnChainAsset | null;
  candles: OnChainCandle[];
  botStats: BotStats | null;
  selectAsset: (symbol: string) => void;
  refresh: () => Promise<void>;
  network: "zama" | "sepolia" | null;
}

const SCENARIO_NAMES = ["PUMP", "DUMP", "SIDEWAYS", "VOLATILE", "ACCUMULATION", "DISTRIBUTION"];

export function useOnChainOracle(preferredNetwork: "zama" | "sepolia" = "zama"): UseOnChainOracleReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<OnChainAsset[]>([]);
  const [currentAssetId, setCurrentAssetId] = useState<string | null>(null);
  const [candles, setCandles] = useState<OnChainCandle[]>([]);
  const [botStats, setBotStats] = useState<BotStats | null>(null);
  const [network, setNetwork] = useState<"zama" | "sepolia" | null>(null);

  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);
  const oracleRef = useRef<ethers.Contract | null>(null);
  const marketMakerRef = useRef<ethers.Contract | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize provider and contracts
  const initializeConnection = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Skip if no contract addresses configured
      if (!CONFIG.ORACLE_ADDRESS || !CONFIG.MARKET_MAKER_ADDRESS) {
        setError("Contract addresses not configured. Using fallback data.");
        setIsLoading(false);
        return;
      }

      // Try preferred network first
      const rpcUrl = preferredNetwork === "zama" ? CONFIG.ZAMA_RPC : CONFIG.SEPOLIA_RPC;

      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        await provider.getNetwork(); // Test connection

        providerRef.current = provider;
        oracleRef.current = new ethers.Contract(CONFIG.ORACLE_ADDRESS, ORACLE_ABI, provider);
        marketMakerRef.current = new ethers.Contract(CONFIG.MARKET_MAKER_ADDRESS, MARKET_MAKER_ABI, provider);

        setNetwork(preferredNetwork);
        setIsConnected(true);
        console.log(`🟢 Connected to ${preferredNetwork} network`);

        // Load initial data
        await loadAssets();
        await loadBotStats();

      } catch (_e) {
        console.warn(`⚠️ Failed to connect to ${preferredNetwork}, trying fallback...`);

        // Try fallback network
        const fallbackNetwork = preferredNetwork === "zama" ? "sepolia" : "zama";
        const fallbackRpc = fallbackNetwork === "zama" ? CONFIG.ZAMA_RPC : CONFIG.SEPOLIA_RPC;

        try {
          const provider = new ethers.JsonRpcProvider(fallbackRpc);
          await provider.getNetwork();

          providerRef.current = provider;
          oracleRef.current = new ethers.Contract(CONFIG.ORACLE_ADDRESS, ORACLE_ABI, provider);
          marketMakerRef.current = new ethers.Contract(CONFIG.MARKET_MAKER_ADDRESS, MARKET_MAKER_ABI, provider);

          setNetwork(fallbackNetwork);
          setIsConnected(true);
          console.log(`🟢 Connected to ${fallbackNetwork} network (fallback)`);

          await loadAssets();
          await loadBotStats();

        } catch (_e2) {
          throw new Error("Failed to connect to any network");
        }
      }

    } catch (e: any) {
      console.error("❌ Connection error:", e);
      setError(e.message || "Failed to connect");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [preferredNetwork]);

  // Load all assets from oracle
  const loadAssets = useCallback(async () => {
    if (!oracleRef.current) return;

    try {
      const assetIds = await oracleRef.current.getAllAssetIds();
      const loadedAssets: OnChainAsset[] = [];

      for (const assetId of assetIds) {
        const assetInfo = await oracleRef.current.getAsset(assetId);
        const currentPrice = await oracleRef.current.getCurrentPrice(assetId);

        const priceNumber = Number(currentPrice) / 1e6;
        const basePriceNumber = Number(assetInfo.basePrice) / 1e6;
        const change24h = basePriceNumber > 0 ? ((priceNumber - basePriceNumber) / basePriceNumber) * 100 : 0;

        loadedAssets.push({
          id: assetInfo.symbol.toLowerCase(),
          assetId: assetId,
          symbol: assetInfo.symbol,
          name: assetInfo.name,
          price: priceNumber,
          basePrice: basePriceNumber,
          change24h,
          totalLongOI: Number(assetInfo.totalLongOI) / 1e6,
          totalShortOI: Number(assetInfo.totalShortOI) / 1e6,
          isActive: assetInfo.isActive,
        });
      }

      setAssets(loadedAssets);

    } catch (e) {
      console.error("Error loading assets:", e);
    }
  }, []);

  // Load candles for current asset
  const loadCandles = useCallback(async () => {
    if (!marketMakerRef.current || !currentAssetId) return;

    try {
      const rawCandles = await marketMakerRef.current.getCandles(currentAssetId, 100);

      const formattedCandles: OnChainCandle[] = rawCandles.map((c: any) => ({
        timestamp: Number(c.timestamp) * 1000,
        open: Number(c.open) / 1e6,
        high: Number(c.high) / 1e6,
        low: Number(c.low) / 1e6,
        close: Number(c.close) / 1e6,
        volume: Number(c.volume) / 1e6,
        tradeCount: Number(c.tradeCount),
      }));

      setCandles(formattedCandles);

    } catch (e) {
      console.error("Error loading candles:", e);
    }
  }, [currentAssetId]);

  // Load bot stats
  const loadBotStats = useCallback(async () => {
    if (!marketMakerRef.current) return;

    try {
      const stats = await marketMakerRef.current.getBotStats();

      setBotStats({
        totalTrades: Number(stats.totalTrades),
        lastExecution: Number(stats.lastExecution) * 1000,
        scenario: SCENARIO_NAMES[stats.scenario] || "UNKNOWN",
      });

    } catch (e) {
      console.error("Error loading bot stats:", e);
    }
  }, []);

  // Select asset
  const selectAsset = useCallback((symbol: string) => {
    const asset = assets.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
    if (asset) {
      setCurrentAssetId(asset.assetId);
    }
  }, [assets]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await loadAssets();
    await loadCandles();
    await loadBotStats();
  }, [loadAssets, loadCandles, loadBotStats]);

  // Current asset
  const currentAsset = assets.find(a => a.assetId === currentAssetId) || null;

  // Initialize on mount
  useEffect(() => {
    initializeConnection();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [initializeConnection]);

  // Start polling when connected
  useEffect(() => {
    if (isConnected) {
      pollIntervalRef.current = setInterval(() => {
        loadAssets();
        loadCandles();
        loadBotStats();
      }, CONFIG.POLL_INTERVAL);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isConnected, loadAssets, loadCandles, loadBotStats]);

  // Load candles when asset changes
  useEffect(() => {
    if (currentAssetId) {
      loadCandles();
    }
  }, [currentAssetId, loadCandles]);

  return {
    isConnected,
    isLoading,
    error,
    assets,
    currentAsset,
    candles,
    botStats,
    selectAsset,
    refresh,
    network,
  };
}
