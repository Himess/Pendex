"use client";

import { useMemo } from "react";
import { Lock } from "lucide-react";
import { Asset } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface OrderBookProps {
  selectedAsset: Asset | null;
  currentPrice?: number;
}

interface OrderLevel {
  price: number;
  size: number;
  total: number;
  isEncrypted: boolean;
}

// Generate simulated encrypted order book based on current price
function generateOrderBook(basePrice: number, symbol: string): { asks: OrderLevel[]; bids: OrderLevel[] } {
  // Seeded random for consistency
  let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const asks: OrderLevel[] = [];
  const bids: OrderLevel[] = [];

  const spread = basePrice * 0.001; // 0.1% spread

  // Generate 12 ask levels (sell orders above current price)
  let askTotal = 0;
  for (let i = 0; i < 12; i++) {
    const price = basePrice + spread + (i * basePrice * 0.0005);
    const size = 0.1 + seededRandom() * 2;
    askTotal += size;
    asks.push({
      price,
      size,
      total: askTotal,
      isEncrypted: true,
    });
  }

  // Generate 12 bid levels (buy orders below current price)
  let bidTotal = 0;
  for (let i = 0; i < 12; i++) {
    const price = basePrice - spread - (i * basePrice * 0.0005);
    const size = 0.1 + seededRandom() * 2;
    bidTotal += size;
    bids.push({
      price,
      size,
      total: bidTotal,
      isEncrypted: true,
    });
  }

  return { asks: asks.reverse(), bids };
}

export function OrderBook({ selectedAsset, currentPrice }: OrderBookProps) {
  const price = currentPrice || selectedAsset?.price || 100;

  const { asks, bids } = useMemo(() => {
    if (!selectedAsset) {
      return { asks: [], bids: [] };
    }
    return generateOrderBook(price, selectedAsset.symbol);
  }, [selectedAsset?.symbol, price]);

  const maxTotal = Math.max(
    ...asks.map(a => a.total),
    ...bids.map(b => b.total)
  );

  if (!selectedAsset) {
    return (
      <div className="h-full bg-card border border-border rounded flex items-center justify-center">
        <p className="text-text-muted text-sm">Select an asset</p>
      </div>
    );
  }

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toFixed(2);
    if (p >= 100) return p.toFixed(2);
    if (p >= 1) return p.toFixed(2);
    return p.toFixed(4);
  };

  return (
    <div className="h-full bg-card border border-border rounded flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">Order Book</span>
          <Lock className="w-3 h-3 text-gold" />
        </div>
        <span className="text-[10px] text-gold">Encrypted</span>
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
              key={`ask-${i}`}
              className="relative grid grid-cols-3 px-3 py-0.5 text-[11px] font-mono hover:bg-danger/5"
            >
              {/* Background bar */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-danger/10"
                style={{ width: `${(ask.total / maxTotal) * 100}%` }}
              />
              <span className="relative text-danger">{formatPrice(ask.price)}</span>
              <span className="relative text-right text-text-secondary">
                {ask.isEncrypted ? (
                  <span className="flex items-center justify-end gap-1">
                    <span className="opacity-60">***</span>
                  </span>
                ) : (
                  ask.size.toFixed(4)
                )}
              </span>
              <span className="relative text-right text-text-muted">
                {ask.isEncrypted ? "***" : ask.total.toFixed(4)}
              </span>
            </div>
          ))}
        </div>

        {/* Spread / Current Price */}
        <div className="px-3 py-2 bg-background border-y border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-text-primary font-mono">
              ${formatPrice(price)}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-text-muted">
              <span>Spread</span>
              <span className="text-text-secondary">{(price * 0.002).toFixed(2)}</span>
              <span>({((0.002) * 100).toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {/* Bids (Buys) - Green */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {bids.map((bid, i) => (
            <div
              key={`bid-${i}`}
              className="relative grid grid-cols-3 px-3 py-0.5 text-[11px] font-mono hover:bg-success/5"
            >
              {/* Background bar */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-success/10"
                style={{ width: `${(bid.total / maxTotal) * 100}%` }}
              />
              <span className="relative text-success">{formatPrice(bid.price)}</span>
              <span className="relative text-right text-text-secondary">
                {bid.isEncrypted ? (
                  <span className="flex items-center justify-end gap-1">
                    <span className="opacity-60">***</span>
                  </span>
                ) : (
                  bid.size.toFixed(4)
                )}
              </span>
              <span className="relative text-right text-text-muted">
                {bid.isEncrypted ? "***" : bid.total.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
