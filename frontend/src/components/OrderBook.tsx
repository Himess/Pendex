"use client";

import { useMemo, useEffect, useState } from "react";
import { Lock, RefreshCw, Shield, Eye, EyeOff, Info } from "lucide-react";
import { Asset } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAssetPrice, useAsset } from "@/lib/contracts/hooks";
import { keccak256, toHex } from "viem";

interface OrderBookProps {
  selectedAsset: Asset | null;
  currentPrice?: number;
}

interface OrderLevel {
  price: number;
  size: number;
  total: number;
  isEncrypted: boolean;
  // Simulated encrypted data
  encryptedSize: string;
  encryptedTrader: string;
}

interface OracleAsset {
  name: string;
  symbol: string;
  basePrice: bigint;
  isActive: boolean;
  totalLongOI: bigint;
  totalShortOI: bigint;
}

// Simülasyon için şifrelenmiş veri üret
function generateEncryptedHash(seed: number): string {
  const chars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < 8; i++) {
    result += chars[(seed * (i + 1) * 7) % 16];
  }
  return result + "...";
}

// Generate order book based on current price and OI data
function generateOrderBook(
  basePrice: number,
  symbol: string,
  longOI: number,
  shortOI: number
): { asks: OrderLevel[]; bids: OrderLevel[] } {
  // Seeded random for consistency per asset
  let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const asks: OrderLevel[] = [];
  const bids: OrderLevel[] = [];

  const spread = basePrice * 0.001; // 0.1% spread

  // Calculate relative weights based on OI
  const totalOI = longOI + shortOI;
  const longWeight = totalOI > 0 ? longOI / totalOI : 0.5;
  const shortWeight = totalOI > 0 ? shortOI / totalOI : 0.5;

  // Generate 12 ask levels (sell orders above current price)
  // More asks when there's more long OI (people wanting to take profit)
  let askTotal = 0;
  for (let i = 0; i < 12; i++) {
    const price = basePrice + spread + (i * basePrice * 0.0005);
    // Size influenced by long OI
    const baseSize = 0.1 + seededRandom() * 2;
    const size = baseSize * (1 + longWeight * 0.5);
    askTotal += size;
    asks.push({
      price,
      size,
      total: askTotal,
      isEncrypted: true,
      encryptedSize: generateEncryptedHash(seed + i * 100),
      encryptedTrader: generateEncryptedHash(seed + i * 200 + 50),
    });
  }

  // Generate 12 bid levels (buy orders below current price)
  // More bids when there's more short OI (shorts wanting to cover)
  let bidTotal = 0;
  for (let i = 0; i < 12; i++) {
    const price = basePrice - spread - (i * basePrice * 0.0005);
    // Size influenced by short OI
    const baseSize = 0.1 + seededRandom() * 2;
    const size = baseSize * (1 + shortWeight * 0.5);
    bidTotal += size;
    bids.push({
      price,
      size,
      total: bidTotal,
      isEncrypted: true,
      encryptedSize: generateEncryptedHash(seed + i * 300),
      encryptedTrader: generateEncryptedHash(seed + i * 400 + 50),
    });
  }

  return { asks: asks.reverse(), bids };
}

export function OrderBook({ selectedAsset, currentPrice: propPrice }: OrderBookProps) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEncrypted, setShowEncrypted] = useState(true); // FHE modunu göster/gizle
  const [showInfo, setShowInfo] = useState(false); // FHE bilgi paneli

  // Generate asset ID for oracle lookup
  const assetId = useMemo(() => {
    if (!selectedAsset) return undefined;
    return keccak256(toHex(selectedAsset.symbol.toUpperCase())) as `0x${string}`;
  }, [selectedAsset]);

  // Fetch live price from oracle
  const { data: oraclePrice, refetch: refetchPrice } = useAssetPrice(assetId);

  // Fetch asset data including OI
  const { data: assetData, refetch: refetchAsset } = useAsset(assetId);

  // Convert oracle price (6 decimals) to display price
  const livePrice = useMemo(() => {
    if (oraclePrice) {
      return Number(oraclePrice) / 1e6;
    }
    return propPrice || selectedAsset?.price || 100;
  }, [oraclePrice, propPrice, selectedAsset]);

  // Get OI data
  const { longOI, shortOI } = useMemo(() => {
    if (assetData) {
      const data = assetData as OracleAsset;
      return {
        longOI: Number(data.totalLongOI) / 1e6,
        shortOI: Number(data.totalShortOI) / 1e6,
      };
    }
    return { longOI: 0, shortOI: 0 };
  }, [assetData]);

  // Generate order book with live data
  const { asks, bids } = useMemo(() => {
    if (!selectedAsset) {
      return { asks: [], bids: [] };
    }
    return generateOrderBook(livePrice, selectedAsset.symbol, longOI, shortOI);
  }, [selectedAsset, livePrice, longOI, shortOI]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!selectedAsset) return;

    const refresh = async () => {
      setIsRefreshing(true);
      await Promise.all([refetchPrice(), refetchAsset()]);
      setLastUpdate(new Date());
      setIsRefreshing(false);
    };

    // Initial fetch
    refresh();

    // Set up interval
    const interval = setInterval(refresh, 10000);

    return () => clearInterval(interval);
  }, [selectedAsset, refetchPrice, refetchAsset]);

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
    if (p >= 1000) return p.toFixed(2);
    if (p >= 100) return p.toFixed(2);
    if (p >= 1) return p.toFixed(2);
    return p.toFixed(4);
  };

  const spreadAmount = livePrice * 0.002;
  const spreadPercent = 0.2;

  return (
    <div className="h-full bg-card border border-border rounded flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-gold" />
          <span className="text-xs font-medium text-text-primary">FHE Order Book</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Şifreleme Toggle */}
          <button
            onClick={() => setShowEncrypted(!showEncrypted)}
            className={cn(
              "p-1 rounded transition-colors",
              showEncrypted ? "bg-gold/20 text-gold" : "bg-card-hover text-text-muted"
            )}
            title={showEncrypted ? "Şifreli görünüm" : "Demo görünüm"}
          >
            {showEncrypted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          {/* Bilgi Butonu */}
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
            onClick={() => {
              refetchPrice();
              refetchAsset();
            }}
          />
          <span className="text-[10px] text-gold">Live</span>
        </div>
      </div>

      {/* FHE Bilgi Paneli */}
      {showInfo && (
        <div className="px-3 py-2 bg-gold/10 border-b border-gold/30 text-[10px] text-gold">
          <div className="flex items-start gap-2">
            <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Şifreli Order Book (FHE)</p>
              <ul className="space-y-0.5 text-gold/80">
                <li>• Fiyat seviyeleri görünür (market depth)</li>
                <li>• Miktar çubukları toplam likiditeyi gösterir</li>
                <li>• Kim koydu, tam miktar → Şifreli</li>
                <li>• Validator bile göremez!</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* OI Indicator */}
      <div className="px-3 py-1 border-b border-border/50 bg-background/30">
        <div className="flex items-center justify-between text-[9px] text-text-muted">
          <span>Long OI: ${longOI.toFixed(0)}</span>
          <span>Short OI: ${shortOI.toFixed(0)}</span>
        </div>
        <div className="mt-1 h-1 bg-background rounded-full overflow-hidden flex">
          <div
            className="h-full bg-success"
            style={{ width: `${longOI + shortOI > 0 ? (longOI / (longOI + shortOI)) * 100 : 50}%` }}
          />
          <div
            className="h-full bg-danger"
            style={{ width: `${longOI + shortOI > 0 ? (shortOI / (longOI + shortOI)) * 100 : 50}%` }}
          />
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
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-text-primary font-mono">
                ${formatPrice(livePrice)}
              </span>
              {oraclePrice && (
                <span className="text-[9px] text-success px-1 py-0.5 bg-success/10 rounded">
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

      {/* Last Update */}
      {lastUpdate && (
        <div className="px-3 py-1 border-t border-border/50 text-[9px] text-text-muted text-center">
          Last update: {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
