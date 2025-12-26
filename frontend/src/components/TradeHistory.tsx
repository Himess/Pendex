"use client";

import { useState, useEffect, useCallback } from "react";
import { History, RefreshCw, Loader2, Lock, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccount, usePublicClient } from "wagmi";
import { CONTRACTS } from "@/lib/contracts/config";
import { SHADOW_VAULT_ABI } from "@/lib/contracts/abis";
import { useSessionWallet } from "@/lib/session-wallet/hooks";
import { formatDistanceToNow } from "date-fns";

// Asset ID to symbol mapping
const ASSET_ID_TO_NAME: Record<string, { name: string; symbol: string }> = {
  "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9": { name: "OpenAI", symbol: "OPENAI" },
  "0xee2176d5e35f81b98746f5f98677beb44f0167ae70b6518fbb5b5bdc65da8fdd": { name: "Anthropic", symbol: "ANTHR" },
  "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab": { name: "SpaceX", symbol: "SPACEX" },
  "0x8eddee8eb3ba76411ebdccf6d0ad00841d58a803916546a295c2b0346ea86a11": { name: "Stripe", symbol: "STRIPE" },
  "0x0bf812f25cacc694be173fe6fd2b56e3f94f71dcee99e1f1280b2ce7fba46fca": { name: "Databricks", symbol: "DTBRKS" },
  "0x7a8e8d0c5008129e8077f29f2b784b6f889f3420f121d5b70b5b3326476bbce1": { name: "ByteDance", symbol: "BYTDNC" },
};

interface TradeHistoryItem {
  id: string;
  positionId: bigint;
  type: "OPEN" | "CLOSE";
  asset: string;
  symbol: string;
  assetId: string;
  timestamp: Date;
  blockNumber: bigint;
  txHash: string;
}

export function TradeHistory() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { mainWallet } = useSessionWallet();

  // The owner address is mainWallet if session is active, otherwise connected wallet
  const ownerAddress = (mainWallet || address) as `0x${string}` | undefined;

  const [trades, setTrades] = useState<TradeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch trade history from blockchain events
  const fetchTradeHistory = useCallback(async () => {
    if (!isConnected || !publicClient || !ownerAddress) {
      setTrades([]);
      return;
    }

    setIsLoading(true);
    console.log("📜 Fetching trade history for:", ownerAddress);

    try {
      const tradeItems: TradeHistoryItem[] = [];

      // Get PositionOpened events (last 10000 blocks ~= last few days)
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > BigInt(10000) ? currentBlock - BigInt(10000) : BigInt(0);

      // Fetch PositionOpened events
      const openedLogs = await publicClient.getLogs({
        address: CONTRACTS.shadowVault as `0x${string}`,
        event: {
          type: "event",
          name: "PositionOpened",
          inputs: [
            { indexed: true, name: "positionId", type: "uint256" },
            { indexed: true, name: "owner", type: "address" },
            { indexed: false, name: "assetId", type: "bytes32" },
          ],
        },
        args: {
          owner: ownerAddress,
        },
        fromBlock,
        toBlock: "latest",
      });

      console.log(`📊 Found ${openedLogs.length} PositionOpened events`);

      // Fetch PositionClosed events
      const closedLogs = await publicClient.getLogs({
        address: CONTRACTS.shadowVault as `0x${string}`,
        event: {
          type: "event",
          name: "PositionClosed",
          inputs: [
            { indexed: true, name: "positionId", type: "uint256" },
            { indexed: true, name: "owner", type: "address" },
          ],
        },
        args: {
          owner: ownerAddress,
        },
        fromBlock,
        toBlock: "latest",
      });

      console.log(`📊 Found ${closedLogs.length} PositionClosed events`);

      // Process PositionOpened events
      for (const log of openedLogs) {
        const positionId = log.args.positionId as bigint;
        const assetId = log.args.assetId as string;
        const assetInfo = ASSET_ID_TO_NAME[assetId.toLowerCase()] || { name: "Unknown", symbol: "???" };

        // Get block timestamp
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });

        tradeItems.push({
          id: `open-${positionId.toString()}`,
          positionId,
          type: "OPEN",
          asset: assetInfo.name,
          symbol: assetInfo.symbol,
          assetId,
          timestamp: new Date(Number(block.timestamp) * 1000),
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        });
      }

      // Process PositionClosed events
      for (const log of closedLogs) {
        const positionId = log.args.positionId as bigint;

        // Find the corresponding open event to get assetId
        const openEvent = tradeItems.find(
          (t) => t.positionId === positionId && t.type === "OPEN"
        );

        // Get block timestamp
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });

        tradeItems.push({
          id: `close-${positionId.toString()}`,
          positionId,
          type: "CLOSE",
          asset: openEvent?.asset || "Unknown",
          symbol: openEvent?.symbol || "???",
          assetId: openEvent?.assetId || "",
          timestamp: new Date(Number(block.timestamp) * 1000),
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        });
      }

      // Sort by timestamp (newest first)
      tradeItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setTrades(tradeItems);
      console.log(`✅ Loaded ${tradeItems.length} trade history items`);
    } catch (error) {
      console.error("Error fetching trade history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, publicClient, ownerAddress]);

  // Initial fetch
  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTradeHistory();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Format tx hash for display
  const formatTxHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-gold" />
          <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Trade History</h2>
          {trades.length > 0 && (
            <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded">
              {trades.length} trades
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="p-1 rounded hover:bg-card-hover transition-colors"
        >
          <RefreshCw className={cn(
            "w-3.5 h-3.5 text-text-muted",
            (isRefreshing || isLoading) && "animate-spin"
          )} />
        </button>
      </div>

      {/* Loading State */}
      {isLoading && trades.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin mb-3" />
          <p className="text-sm text-text-muted">Loading trade history...</p>
        </div>
      )}

      {/* Trade List */}
      {trades.length > 0 && (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Position ID</th>
                <th className="px-3 py-2 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-card-hover transition-colors">
                  {/* Time */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-text-primary text-xs">
                        {formatDistanceToNow(trade.timestamp, { addSuffix: true })}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {trade.timestamp.toLocaleString()}
                      </span>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 w-fit",
                        trade.type === "OPEN"
                          ? "bg-success/20 text-success"
                          : "bg-danger/20 text-danger"
                      )}
                    >
                      {trade.type === "OPEN" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {trade.type}
                    </span>
                  </td>

                  {/* Asset */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-background flex items-center justify-center text-[8px] font-bold text-gold border border-border">
                        {trade.symbol.slice(0, 2)}
                      </div>
                      <span className="text-text-primary text-xs">{trade.asset}</span>
                    </div>
                  </td>

                  {/* Position ID */}
                  <td className="px-3 py-2">
                    <span className="text-text-muted font-mono text-xs">
                      #{trade.positionId.toString()}
                    </span>
                  </td>

                  {/* Tx Hash */}
                  <td className="px-3 py-2">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${trade.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold hover:underline font-mono text-xs"
                    >
                      {formatTxHash(trade.txHash)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && trades.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
            <History className="w-8 h-8 text-gold" />
          </div>
          <h3 className="text-sm font-semibold text-text-secondary mb-2">No trade history</h3>
          <p className="text-xs text-text-muted max-w-xs">
            Your completed trades will appear here. Open a position to get started!
          </p>
        </div>
      )}
    </div>
  );
}

export default TradeHistory;
