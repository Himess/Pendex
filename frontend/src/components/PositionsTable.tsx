"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Lock, Eye, EyeOff, TrendingUp, TrendingDown, RefreshCw, Shield, Loader2, X } from "lucide-react";
import { formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useUserPositions, useClosePosition } from "@/lib/contracts/hooks";
import { CONTRACTS } from "@/lib/contracts/config";
import { SHADOW_VAULT_ABI, SHADOW_ORACLE_ABI } from "@/lib/contracts/abis";
import {
  initFheInstance,
  isFheInitialized,
  decryptValue,
  getFheInstance,
} from "@/lib/fhe/client";

// Asset ID to symbol mapping
const ASSET_ID_TO_NAME: Record<string, { name: string; symbol: string }> = {
  "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9": { name: "OpenAI", symbol: "OPENAI" },
  "0xee2176d5e35f81b98746f5f98677beb44f0167ae70b6518fbb5b5bdc65da8fdd": { name: "Anthropic", symbol: "ANTHR" },
  "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab": { name: "SpaceX", symbol: "SPACEX" },
  "0x8eddee8eb3ba76411ebdccf6d0ad00841d58a803916546a295c2b0346ea86a11": { name: "Stripe", symbol: "STRIPE" },
  "0x0bf812f25cacc694be173fe6fd2b56e3f94f71dcee99e1f1280b2ce7fba46fca": { name: "Databricks", symbol: "DTBRKS" },
  "0x7a8e8d0c5008129e8077f29f2b784b6f889f3420f121d5b70b5b3326476bbce1": { name: "ByteDance", symbol: "BYTDNC" },
};

interface Position {
  id: string;
  positionId: bigint;
  asset: string;
  symbol: string;
  assetId: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  collateral: number;
  pnl: number;
  pnlPercent: number;
  isRevealed: boolean;
  isEncrypted: boolean;
  isDecrypting: boolean;
  // Raw encrypted handles
  encryptedCollateral?: string;
  encryptedLeverage?: string;
  encryptedIsLong?: string;
  encryptedEntryPrice?: string;
}

interface RawPosition {
  owner: string;
  assetId: string;
  collateral: string;
  leverage: string;
  isLong: string;
  entryPrice: string;
  isOpen: boolean;
  openTimestamp: bigint;
}

export function PositionsTable() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { data: positionIds, isLoading: isLoadingPositions, refetch: refetchPositions } = useUserPositions(address);
  const { closePosition, isPending: isClosing, isSuccess: closeSuccess } = useClosePosition();

  const [positions, setPositions] = useState<Position[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [fheReady, setFheReady] = useState(false);
  const [closingPositionId, setClosingPositionId] = useState<bigint | null>(null);

  // Initialize FHE
  useEffect(() => {
    if (isFheInitialized()) {
      setFheReady(true);
      return;
    }

    initFheInstance().then(() => {
      setFheReady(true);
    }).catch(console.error);
  }, []);

  // Refetch when close is successful
  useEffect(() => {
    if (closeSuccess) {
      refetchPositions();
      setClosingPositionId(null);
    }
  }, [closeSuccess, refetchPositions]);

  // Fetch position data from contract
  const fetchPositionData = useCallback(async () => {
    if (!isConnected || !positionIds || !publicClient || (positionIds as bigint[]).length === 0) {
      setPositions([]);
      return;
    }

    setIsLoadingData(true);
    const fetchedPositions: Position[] = [];

    try {
      for (const posId of positionIds as bigint[]) {
        try {
          // Get position data from contract
          const rawPosition = await publicClient.readContract({
            address: CONTRACTS.shadowVault as `0x${string}`,
            abi: SHADOW_VAULT_ABI,
            functionName: "getPosition",
            args: [posId],
          }) as RawPosition;

          if (!rawPosition.isOpen) continue;

          const assetId = rawPosition.assetId as string;
          const assetInfo = ASSET_ID_TO_NAME[assetId.toLowerCase()] || { name: "Unknown", symbol: "???" };

          // Get current price from Oracle
          let currentPrice = 0;
          try {
            const price = await publicClient.readContract({
              address: CONTRACTS.shadowOracle as `0x${string}`,
              abi: SHADOW_ORACLE_ABI,
              functionName: "getCurrentPrice",
              args: [assetId as `0x${string}`],
            }) as bigint;
            currentPrice = Number(price) / 1e6; // 6 decimals
          } catch (e) {
            console.error("Error fetching price:", e);
          }

          fetchedPositions.push({
            id: `pos-${posId.toString()}`,
            positionId: posId,
            asset: assetInfo.name,
            symbol: assetInfo.symbol,
            assetId: assetId,
            side: "LONG", // Will be decrypted
            size: 0, // Will be calculated after decrypt
            entryPrice: 0, // Will be decrypted
            currentPrice,
            leverage: 0, // Will be decrypted
            collateral: 0, // Will be decrypted
            pnl: 0, // Will be calculated
            pnlPercent: 0,
            isRevealed: false,
            isEncrypted: true,
            isDecrypting: false,
            encryptedCollateral: rawPosition.collateral,
            encryptedLeverage: rawPosition.leverage,
            encryptedIsLong: rawPosition.isLong,
            encryptedEntryPrice: rawPosition.entryPrice,
          });
        } catch (e) {
          console.error(`Error fetching position ${posId}:`, e);
        }
      }

      setPositions(fetchedPositions);
    } catch (e) {
      console.error("Error fetching positions:", e);
    } finally {
      setIsLoadingData(false);
    }
  }, [isConnected, positionIds, publicClient]);

  // Fetch positions when IDs change
  useEffect(() => {
    fetchPositionData();
  }, [fetchPositionData]);

  // Decrypt position data
  const decryptPosition = useCallback(async (positionId: string) => {
    if (!walletClient || !address || !fheReady) return;

    const position = positions.find(p => p.id === positionId);
    if (!position || position.isRevealed) return;

    // Mark as decrypting
    setPositions(prev => prev.map(p =>
      p.id === positionId ? { ...p, isDecrypting: true } : p
    ));

    try {
      // Decrypt collateral
      let collateral = 0;
      if (position.encryptedCollateral && position.encryptedCollateral !== "0x" + "0".repeat(64)) {
        try {
          const decrypted = await decryptValue(
            position.encryptedCollateral as `0x${string}`,
            CONTRACTS.shadowVault,
            address,
            walletClient
          );
          collateral = Number(decrypted) / 1e6;
        } catch (e) {
          console.error("Error decrypting collateral:", e);
        }
      }

      // Decrypt leverage
      let leverage = 1;
      if (position.encryptedLeverage && position.encryptedLeverage !== "0x" + "0".repeat(64)) {
        try {
          const decrypted = await decryptValue(
            position.encryptedLeverage as `0x${string}`,
            CONTRACTS.shadowVault,
            address,
            walletClient
          );
          leverage = Number(decrypted);
        } catch (e) {
          console.error("Error decrypting leverage:", e);
        }
      }

      // Decrypt isLong
      let isLong = true;
      if (position.encryptedIsLong && position.encryptedIsLong !== "0x" + "0".repeat(64)) {
        try {
          const decrypted = await decryptValue(
            position.encryptedIsLong as `0x${string}`,
            CONTRACTS.shadowVault,
            address,
            walletClient
          );
          isLong = Number(decrypted) === 1;
        } catch (e) {
          console.error("Error decrypting isLong:", e);
        }
      }

      // Decrypt entry price
      let entryPrice = 0;
      if (position.encryptedEntryPrice && position.encryptedEntryPrice !== "0x" + "0".repeat(64)) {
        try {
          const decrypted = await decryptValue(
            position.encryptedEntryPrice as `0x${string}`,
            CONTRACTS.shadowVault,
            address,
            walletClient
          );
          entryPrice = Number(decrypted) / 1e6;
        } catch (e) {
          console.error("Error decrypting entry price:", e);
        }
      }

      // Calculate size and P&L
      const size = collateral * leverage;
      const priceDiff = position.currentPrice - entryPrice;
      const pnl = isLong
        ? (priceDiff / entryPrice) * size
        : (-priceDiff / entryPrice) * size;
      const pnlPercent = entryPrice > 0 ? (pnl / collateral) * 100 : 0;

      // Update position with decrypted data
      setPositions(prev => prev.map(p =>
        p.id === positionId ? {
          ...p,
          collateral,
          leverage,
          side: isLong ? "LONG" : "SHORT",
          entryPrice,
          size,
          pnl,
          pnlPercent,
          isRevealed: true,
          isDecrypting: false,
        } : p
      ));
    } catch (e) {
      console.error("Error decrypting position:", e);
      setPositions(prev => prev.map(p =>
        p.id === positionId ? { ...p, isDecrypting: false } : p
      ));
    }
  }, [positions, walletClient, address, fheReady]);

  const toggleReveal = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    if (position.isRevealed) {
      // Hide position
      setPositions(prev => prev.map(p =>
        p.id === positionId ? { ...p, isRevealed: false } : p
      ));
    } else {
      // Decrypt and reveal
      decryptPosition(positionId);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchPositions();
    await fetchPositionData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClosePosition = (positionId: bigint) => {
    setClosingPositionId(positionId);
    closePosition(positionId);
  };

  const EncryptedValue = ({ revealed, value, isLoading }: { revealed: boolean; value: string; isLoading?: boolean }) => (
    <span className={cn("flex items-center gap-1 text-xs", revealed ? "text-text-primary" : "text-text-muted")}>
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin text-gold" />
      ) : revealed ? (
        value
      ) : (
        <>
          <span>$0.00</span>
          <Lock className="w-2.5 h-2.5 text-gold" />
        </>
      )}
    </span>
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-gold" />
          <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Open Positions</h2>
          {positions.length > 0 && (
            <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded">
              {positions.length} FHE Encrypted
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoadingPositions || isLoadingData}
          className="p-1 rounded hover:bg-card-hover transition-colors"
        >
          <RefreshCw className={cn(
            "w-3.5 h-3.5 text-text-muted",
            (isRefreshing || isLoadingPositions || isLoadingData) && "animate-spin"
          )} />
        </button>
      </div>

      {/* Loading State */}
      {(isLoadingPositions || isLoadingData) && positions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin mb-3" />
          <p className="text-sm text-text-muted">Loading positions...</p>
        </div>
      )}

      {/* Table */}
      {positions.length > 0 && (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider">
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Leverage</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Entry</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">P&L</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {positions.map((position) => (
                <tr key={position.id} className="hover:bg-card-hover transition-colors">
                  {/* Asset */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center text-[10px] font-bold text-gold border border-border">
                        {position.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <span className="font-medium text-text-primary text-xs">{position.asset}</span>
                        <span className="text-[10px] text-text-muted ml-1">/{" "}USD</span>
                      </div>
                    </div>
                  </td>

                  {/* Side */}
                  <td className="px-3 py-2">
                    {position.isRevealed ? (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          position.side === "LONG" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                        )}
                      >
                        {position.side}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <Lock className="w-2.5 h-2.5 text-gold" />
                      </span>
                    )}
                  </td>

                  {/* Leverage */}
                  <td className="px-3 py-2">
                    {position.isRevealed ? (
                      <span className="text-gold font-medium">{position.leverage}x</span>
                    ) : (
                      <EncryptedValue revealed={false} value="" isLoading={position.isDecrypting} />
                    )}
                  </td>

                  {/* Size */}
                  <td className="px-3 py-2">
                    <EncryptedValue
                      revealed={position.isRevealed}
                      value={formatUSD(position.size)}
                      isLoading={position.isDecrypting}
                    />
                  </td>

                  {/* Entry Price */}
                  <td className="px-3 py-2">
                    <EncryptedValue
                      revealed={position.isRevealed}
                      value={formatUSD(position.entryPrice)}
                      isLoading={position.isDecrypting}
                    />
                  </td>

                  {/* Current Price */}
                  <td className="px-3 py-2">
                    <span className="text-text-primary font-medium">
                      {position.currentPrice > 0 ? formatUSD(position.currentPrice) : "-"}
                    </span>
                  </td>

                  {/* P&L */}
                  <td className="px-3 py-2">
                    {position.isRevealed ? (
                      <div className="flex items-center gap-1.5">
                        {position.pnl >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-success" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-danger" />
                        )}
                        <div className={cn(
                          "font-medium text-xs",
                          position.pnl >= 0 ? "text-success" : "text-danger"
                        )}>
                          <span>{position.pnl >= 0 ? "+" : ""}{formatUSD(position.pnl)}</span>
                          <span className="text-[10px] ml-1">({formatPercent(position.pnlPercent)})</span>
                        </div>
                      </div>
                    ) : (
                      <EncryptedValue revealed={false} value="" isLoading={position.isDecrypting} />
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {/* Reveal/Hide Button */}
                      <button
                        onClick={() => toggleReveal(position.id)}
                        disabled={position.isDecrypting || !fheReady}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all duration-200",
                          position.isRevealed
                            ? "bg-success/20 text-success border border-success/30"
                            : "bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30",
                          (position.isDecrypting || !fheReady) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {position.isDecrypting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : position.isRevealed ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            HIDE
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            REVEAL
                          </>
                        )}
                      </button>

                      {/* Close Position Button */}
                      {position.isRevealed && (
                        <button
                          onClick={() => handleClosePosition(position.positionId)}
                          disabled={isClosing && closingPositionId === position.positionId}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
                            "bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30",
                            isClosing && closingPositionId === position.positionId && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {isClosing && closingPositionId === position.positionId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          CLOSE
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingPositions && !isLoadingData && positions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-gold" />
          </div>
          <h3 className="text-sm font-semibold text-text-secondary mb-2">No open positions</h3>
          <p className="text-xs text-text-muted max-w-xs mb-6">
            Your encrypted positions will appear here. All position details are protected with FHE encryption.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-background font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Open Your First Position
          </a>
        </div>
      )}
    </div>
  );
}
