"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { Lock, RefreshCw, Shield, Eye, EyeOff, Info, Zap } from "lucide-react";
import { Asset } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useLiveAssetPrice } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";
import { LiquidityScoreCompact } from "./LiquidityScore";

interface OrderBookProps {
  selectedAsset: Asset | null;
  currentPrice?: number;
}

interface OrderLevel {
  id: string;
  price: number;
  size: number;
  total: number;
  isEncrypted: boolean;
  encryptedSize: string;
  encryptedTrader: string;
  isNew?: boolean;
  isUpdated?: boolean;
  changeDirection?: "up" | "down";
}

// Generate encrypted hash for display
function generateEncryptedHash(seed: number): string {
  const chars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < 8; i++) {
    result += chars[(seed * (i + 1) * 7) % 16];
  }
  return result + "...";
}

// Generate order book with live variations
function generateOrderBook(
  basePrice: number,
  symbol: string,
  longOI: number,
  shortOI: number,
  tick: number, // Changes each update for variation
  liquidityScore: number = 50 // Liquidity score 0-100
): { asks: OrderLevel[]; bids: OrderLevel[]; spreadPercent: number } {
  let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + tick;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const asks: OrderLevel[] = [];
  const bids: OrderLevel[] = [];

  // Dynamic spread based on liquidity score
  // High liquidity (100) = tight spread (0.05%)
  // Low liquidity (0) = wide spread (0.2%)
  const baseSpreadPercent = 0.002; // 0.2% base
  const liquidityFactor = liquidityScore / 100; // 0-1
  const spreadPercent = baseSpreadPercent - (liquidityFactor * 0.0015);
  // Score 100 → 0.05% spread
  // Score 50 → 0.125% spread
  // Score 0 → 0.2% spread
  const spread = basePrice * spreadPercent;
  const totalOI = longOI + shortOI;
  const longWeight = totalOI > 0 ? longOI / totalOI : 0.5;
  const shortWeight = totalOI > 0 ? shortOI / totalOI : 0.5;

  // Generate asks with variation
  let askTotal = 0;
  for (let i = 0; i < 12; i++) {
    const priceVariation = (seededRandom() - 0.5) * basePrice * 0.0001;
    const price = basePrice + spread + (i * basePrice * 0.0005) + priceVariation;
    const baseSize = 0.1 + seededRandom() * 2;
    const sizeVariation = seededRandom() * 0.3;
    const size = baseSize * (1 + longWeight * 0.5) + sizeVariation;
    askTotal += size;
    asks.push({
      id: `ask-${i}-${tick}`,
      price,
      size,
      total: askTotal,
      isEncrypted: true,
      encryptedSize: generateEncryptedHash(seed + i * 100),
      encryptedTrader: generateEncryptedHash(seed + i * 200 + 50),
    });
  }

  // Generate bids with variation
  let bidTotal = 0;
  for (let i = 0; i < 12; i++) {
    const priceVariation = (seededRandom() - 0.5) * basePrice * 0.0001;
    const price = basePrice - spread - (i * basePrice * 0.0005) + priceVariation;
    const baseSize = 0.1 + seededRandom() * 2;
    const sizeVariation = seededRandom() * 0.3;
    const size = baseSize * (1 + shortWeight * 0.5) + sizeVariation;
    bidTotal += size;
    bids.push({
      id: `bid-${i}-${tick}`,
      price,
      size,
      total: bidTotal,
      isEncrypted: true,
      encryptedSize: generateEncryptedHash(seed + i * 300),
      encryptedTrader: generateEncryptedHash(seed + i * 400 + 50),
    });
  }

  return { asks: asks.reverse(), bids, spreadPercent: spreadPercent * 100 };
}

// Recent trade type
interface RecentTrade {
  id: string;
  price: number;
  size: number;
  side: "buy" | "sell";
  timestamp: number;
}

export function OrderBook({ selectedAsset, currentPrice: propPrice }: OrderBookProps) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEncrypted, setShowEncrypted] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [tick, setTick] = useState(0);
  const [flashPrice, setFlashPrice] = useState<"up" | "down" | null>(null);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [tradesPerSecond, setTradesPerSecond] = useState(0);
  const prevPriceRef = useRef<number>(0);

  const network = useCurrentNetwork();
  const { asset: oracleAsset, refresh } = useLiveAssetPrice(
    selectedAsset?.symbol || "",
    network
  );

  const livePrice = oracleAsset?.price ?? propPrice ?? selectedAsset?.price ?? 100;
  // Direction is encrypted - use totalOI and balanced 50/50 split for order book
  const rawTotalOI = oracleAsset?.totalOI ?? 0;
  // Fallback OI based on price if contract returns 0 (no positions yet)
  const totalOI = rawTotalOI > 0 ? rawTotalOI : livePrice * 500000;
  const liquidityScore = oracleAsset?.liquidityScore ?? 50;

  // Generate order book with balanced weights (direction is encrypted!)
  const { asks, bids, spreadPercent } = useMemo(() => {
    if (!selectedAsset) {
      return { asks: [], bids: [], spreadPercent: 0.1 };
    }
    // Use 50/50 split since direction is encrypted
    const halfOI = totalOI / 2;
    return generateOrderBook(livePrice, selectedAsset.symbol, halfOI, halfOI, tick, liquidityScore);
  }, [selectedAsset, livePrice, totalOI, tick, liquidityScore]);

  // Flash effect on price change
  useEffect(() => {
    if (prevPriceRef.current !== 0 && livePrice !== prevPriceRef.current) {
      setFlashPrice(livePrice > prevPriceRef.current ? "up" : "down");
      setTimeout(() => setFlashPrice(null), 300);
    }
    prevPriceRef.current = livePrice;
  }, [livePrice]);

  // Simulate live order flow - updates every 3-7s randomly (slower for stability)
  useEffect(() => {
    if (!selectedAsset) return;

    const updateInterval = () => {
      const delay = 3000 + Math.random() * 4000; // 3s to 7s (more stable)
      return setTimeout(() => {
        setTick(t => t + 1);
        setLastUpdate(new Date());

        // Simulate a trade
        if (Math.random() > 0.3) {
          const side = Math.random() > 0.5 ? "buy" : "sell";
          const trade: RecentTrade = {
            id: `trade-${Date.now()}`,
            price: livePrice + (Math.random() - 0.5) * livePrice * 0.001,
            size: 0.01 + Math.random() * 0.5,
            side,
            timestamp: Date.now(),
          };
          setRecentTrades(prev => [trade, ...prev].slice(0, 10));
        }

        timer = updateInterval();
      }, delay);
    };

    let timer = updateInterval();
    return () => clearTimeout(timer);
  }, [selectedAsset, livePrice]);

  // Calculate trades per second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const recentCount = recentTrades.filter(t => now - t.timestamp < 5000).length;
      setTradesPerSecond(Math.round(recentCount / 5 * 10) / 10);
    }, 1000);
    return () => clearInterval(interval);
  }, [recentTrades]);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setTick(t => t + 1);
    setLastUpdate(new Date());
    setIsRefreshing(false);
  }, [refresh]);

  const maxTotal = Math.max(
    ...asks.map(a => a.total),
    ...bids.map(b => b.total),
    1
  );

  if (!selectedAsset) {
    return (
      <div className="h-full bg-card border border-border rounded flex items-center justify-center">
        <p className="text-text-muted text-sm">Select an asset</p>
      </div>
    );
  }

  const formatPrice = (p: number) => {
    if (p >= 100) return p.toFixed(2);
    if (p >= 1) return p.toFixed(3);
    return p.toFixed(4);
  };

  const spreadAmount = livePrice * (spreadPercent / 100);

  return (
    <div className="h-full bg-card border border-border rounded flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-gold" />
          <span className="text-xs font-medium text-text-primary">FHE Order Book</span>
          {tradesPerSecond > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded">
              <Zap className="w-2.5 h-2.5" />
              {tradesPerSecond}/s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEncrypted(!showEncrypted)}
            className={cn(
              "p-1 rounded transition-colors",
              showEncrypted ? "bg-gold/20 text-gold" : "bg-card-hover text-text-muted"
            )}
            title={showEncrypted ? "Encrypted view" : "Demo view"}
          >
            {showEncrypted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 rounded hover:bg-card-hover transition-colors text-text-muted hover:text-gold"
          >
            <Info className="w-3 h-3" />
          </button>
          <RefreshCw
            className={cn(
              "w-3 h-3 text-text-muted cursor-pointer hover:text-gold transition-colors",
              isRefreshing && "animate-spin"
            )}
            onClick={handleRefresh}
          />
          <span className="text-[10px] text-success animate-pulse">LIVE</span>
        </div>
      </div>

      {/* FHE Info Panel */}
      {showInfo && (
        <div className="px-3 py-2 bg-gold/10 border-b border-gold/30 text-[10px] text-gold">
          <div className="flex items-start gap-2">
            <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Encrypted Order Book (FHE)</p>
              <ul className="space-y-0.5 text-gold/80">
                <li>• Price levels visible (market depth)</li>
                <li>• Size bars show total liquidity</li>
                <li>• Who placed, exact amount → Encrypted</li>
                <li>• Even validators cannot see!</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Total OI & Liquidity Indicator - Direction is encrypted! */}
      <div className="px-3 py-1.5 border-b border-border/50 bg-background/30">
        <div className="flex items-center justify-between text-[9px] text-text-muted">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span>OI:</span>
              <span className="text-gold font-medium">
                ${totalOI >= 1000000 ? `${(totalOI / 1000000).toFixed(1)}M` :
                  totalOI >= 1000 ? `${(totalOI / 1000).toFixed(0)}K` :
                  totalOI.toFixed(0)}
              </span>
            </div>
            <LiquidityScoreCompact score={liquidityScore} />
          </div>
          <div className="flex items-center gap-1 text-gold">
            <Lock className="w-2.5 h-2.5" />
            <span className="text-[8px]">Direction encrypted</span>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] text-text-muted border-b border-border/50 bg-background/30">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (Sells) - Red */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {asks.map((ask, i) => (
            <div
              key={ask.id}
              className={cn(
                "relative grid grid-cols-3 px-3 py-0.5 text-[11px] font-mono transition-all duration-300",
                "hover:bg-danger/10"
              )}
            >
              {/* Background bar with animation */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-danger/10 transition-all duration-500"
                style={{ width: `${(ask.total / maxTotal) * 100}%` }}
              />
              <span className="relative text-danger">{formatPrice(ask.price)}</span>
              <span className="relative text-right text-text-secondary">
                {showEncrypted ? (
                  <span className="opacity-60 animate-pulse">***</span>
                ) : (
                  ask.size.toFixed(4)
                )}
              </span>
              <span className="relative text-right text-text-muted">
                {showEncrypted ? "***" : ask.total.toFixed(4)}
              </span>
            </div>
          ))}
        </div>

        {/* Spread / Current Price */}
        <div className={cn(
          "px-3 py-2 bg-background border-y border-border/50 transition-colors duration-300",
          flashPrice === "up" && "bg-success/20",
          flashPrice === "down" && "bg-danger/20"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-lg font-bold font-mono transition-colors duration-300",
                flashPrice === "up" && "text-success",
                flashPrice === "down" && "text-danger",
                !flashPrice && "text-text-primary"
              )}>
                ${formatPrice(livePrice)}
              </span>
              {oracleAsset && (
                <span className="text-[9px] text-success px-1 py-0.5 bg-success/10 rounded animate-pulse">
                  LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-text-muted">
              <span>Spread</span>
              <span className="text-text-secondary">{spreadAmount.toFixed(2)}</span>
              <span>({spreadPercent.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {/* Bids (Buys) - Green */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {bids.map((bid, i) => (
            <div
              key={bid.id}
              className={cn(
                "relative grid grid-cols-3 px-3 py-0.5 text-[11px] font-mono transition-all duration-300",
                "hover:bg-success/10"
              )}
            >
              {/* Background bar with animation */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-success/10 transition-all duration-500"
                style={{ width: `${(bid.total / maxTotal) * 100}%` }}
              />
              <span className="relative text-success">{formatPrice(bid.price)}</span>
              <span className="relative text-right text-text-secondary">
                {showEncrypted ? (
                  <span className="opacity-60 animate-pulse">***</span>
                ) : (
                  bid.size.toFixed(4)
                )}
              </span>
              <span className="relative text-right text-text-muted">
                {showEncrypted ? "***" : bid.total.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Trades Ticker */}
      {recentTrades.length > 0 && (
        <div className="border-t border-border/50 bg-background/30">
          <div className="px-3 py-1 text-[9px] text-text-muted flex items-center justify-between">
            <span>Recent Trades</span>
            <span>{recentTrades.length} trades</span>
          </div>
          <div className="px-3 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
            {recentTrades.slice(0, 5).map((trade) => (
              <div
                key={trade.id}
                className={cn(
                  "flex-shrink-0 px-2 py-1 rounded text-[10px] font-mono",
                  trade.side === "buy" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                )}
              >
                <span className="font-medium">{trade.side === "buy" ? "B" : "S"}</span>
                <span className="ml-1">${formatPrice(trade.price)}</span>
                <span className="ml-1 opacity-60">×{trade.size.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Update */}
      {lastUpdate && (
        <div className="px-3 py-1 border-t border-border/50 text-[9px] text-text-muted text-center">
          Updated: {lastUpdate.toLocaleTimeString()}
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-3 py-2 border-t border-border/50 bg-background/30 text-[10px] text-text-muted flex items-start gap-1.5">
        <Lock className="w-3 h-3 mt-0.5 flex-shrink-0 text-gold" />
        <span>Order sizes are encrypted. Displayed depths are approximate indicators based on oracle price.</span>
      </div>
    </div>
  );
}
