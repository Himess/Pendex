"use client";

import { useState, useMemo, useEffect } from "react";
import { Lock, Eye, EyeOff, TrendingUp, TrendingDown, RefreshCw, Shield } from "lucide-react";
import { formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import { useUserPositions, useClosePosition } from "@/lib/contracts/hooks";

interface Position {
  id: string;
  positionId: bigint;
  asset: string;
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  isRevealed: boolean;
  isEncrypted: boolean;
  encryptedCollateral?: string;
  encryptedLeverage?: string;
  encryptedIsLong?: string;
  encryptedEntryPrice?: string;
}

// Demo positions data for fallback when not connected
const DEMO_POSITIONS: Position[] = [
  {
    id: "demo-1",
    positionId: BigInt(0),
    asset: "SpaceX",
    symbol: "SPACEX",
    side: "LONG",
    size: 5000,
    entryPrice: 175.2,
    currentPrice: 180.0,
    pnl: 285,
    pnlPercent: 5.7,
    isRevealed: false,
    isEncrypted: true,
  },
  {
    id: "demo-2",
    positionId: BigInt(0),
    asset: "Stripe",
    symbol: "STRIPE",
    side: "SHORT",
    size: 2500,
    entryPrice: 49.5,
    currentPrice: 48.0,
    pnl: 125,
    pnlPercent: 3.0,
    isRevealed: false,
    isEncrypted: true,
  },
];


export function PositionsTable() {
  const { address, isConnected } = useAccount();
  const { data: positionIds, isLoading: isLoadingPositions, refetch: refetchPositions } = useUserPositions(address);
  const { closePosition, isPending: _isClosing, isSuccess: closeSuccess } = useClosePosition();

  const [revealedPositions, setRevealedPositions] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refetch when close is successful
  useEffect(() => {
    if (closeSuccess) {
      refetchPositions();
    }
  }, [closeSuccess, refetchPositions]);

  // Process positions from contract - for now we'll show encrypted placeholder
  // Real implementation would use batch contract reads for each position
  const positions = useMemo(() => {
    if (!isConnected || !positionIds || (positionIds as bigint[]).length === 0) {
      return DEMO_POSITIONS;
    }

    // Convert position IDs to position objects
    // In production, this would involve reading each position from the contract
    return (positionIds as bigint[]).map((posId, index) => {
      // For now, create placeholder encrypted positions
      return {
        id: `pos-${posId.toString()}`,
        positionId: posId,
        asset: "Unknown",
        symbol: "???",
        side: "LONG" as const,
        size: 0,
        entryPrice: 0,
        currentPrice: 0,
        pnl: 0,
        pnlPercent: 0,
        isRevealed: revealedPositions.has(`pos-${posId.toString()}`),
        isEncrypted: true,
        encryptedCollateral: "0x" + "a".repeat(64),
        encryptedLeverage: "0x" + "b".repeat(64),
        encryptedIsLong: "0x" + "c".repeat(64),
        encryptedEntryPrice: "0x" + "d".repeat(64),
      } as Position;
    });
  }, [isConnected, positionIds, revealedPositions]);

  const toggleReveal = (positionId: string) => {
    setRevealedPositions(prev => {
      const next = new Set(prev);
      if (next.has(positionId)) {
        next.delete(positionId);
      } else {
        next.add(positionId);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchPositions();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClosePosition = (positionId: bigint) => {
    closePosition(positionId);
  };

  const EncryptedValue = ({ revealed, value }: { revealed: boolean; value: string }) => (
    <span className={cn("flex items-center gap-1", revealed ? "revealed-value" : "encrypted-value")}>
      {revealed ? value : "••••••••"}
      <Lock className={cn("w-3 h-3", revealed ? "text-success" : "text-gold")} />
    </span>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gold" />
          <h2 className="text-lg font-semibold text-text-primary">OPEN POSITIONS</h2>
          {!isConnected && (
            <span className="text-xs text-text-muted bg-background px-2 py-0.5 rounded">Demo</span>
          )}
          {isConnected && positions.length > 0 && (
            <span className="text-xs text-gold bg-gold/10 px-2 py-0.5 rounded">
              {positions.length} FHE Encrypted
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoadingPositions}
          className="p-1.5 rounded hover:bg-card-hover transition-colors"
        >
          <RefreshCw className={cn(
            "w-4 h-4 text-text-muted",
            (isRefreshing || isLoadingPositions) && "animate-spin"
          )} />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-text-muted uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Entry Price</th>
              <th className="px-4 py-3 font-medium">Current Price</th>
              <th className="px-4 py-3 font-medium">P&L</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {positions.map((position) => (
              <tr key={position.id} className="hover:bg-card-hover transition-colors">
                {/* Asset */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-xs font-bold text-gold border border-border">
                      {position.symbol.slice(0, 2)}
                    </div>
                    <span className="font-medium text-text-primary">{position.asset}</span>
                  </div>
                </td>

                {/* Side */}
                <td className="px-4 py-4">
                  <span
                    className={cn(
                      "badge",
                      position.side === "LONG" ? "badge-success" : "badge-danger"
                    )}
                  >
                    {position.side}
                  </span>
                </td>

                {/* Size */}
                <td className="px-4 py-4">
                  <EncryptedValue
                    revealed={position.isRevealed}
                    value={formatUSD(position.size)}
                  />
                </td>

                {/* Entry Price */}
                <td className="px-4 py-4">
                  <EncryptedValue
                    revealed={position.isRevealed}
                    value={formatUSD(position.entryPrice)}
                  />
                </td>

                {/* Current Price */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1">
                    <span className="text-text-primary">{formatUSD(position.currentPrice)}</span>
                    <Lock className="w-3 h-3 text-gold" />
                  </div>
                </td>

                {/* P&L */}
                <td className="px-4 py-4">
                  {position.isRevealed ? (
                    <div className="flex items-center gap-2">
                      {position.pnl >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-danger" />
                      )}
                      <div className={cn(
                        "font-medium",
                        position.pnl >= 0 ? "text-success" : "text-danger"
                      )}>
                        <div>{position.pnl >= 0 ? "+" : ""}{formatUSD(position.pnl)}</div>
                        <div className="text-xs">
                          {formatPercent(position.pnlPercent)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EncryptedValue revealed={false} value="" />
                  )}
                </td>

                {/* Action */}
                <td className="px-4 py-4">
                  <button
                    onClick={() => toggleReveal(position.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                      position.isRevealed
                        ? "bg-success/20 text-success border border-success/30"
                        : "bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30"
                    )}
                  >
                    {position.isRevealed ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        HIDE
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        REVEAL
                      </>
                    )}
                    <Lock className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {positions.length === 0 && (
        <div className="p-8 text-center">
          <Lock className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No open positions</p>
          <p className="text-sm text-text-muted">
            Your encrypted positions will appear here
          </p>
        </div>
      )}
    </div>
  );
}
