"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  basePrice: number;
  volatility: number;
  sentiment: string;
  momentum: number;
  volume24h: number;
  change24h: number;
}

export interface Trade {
  id: string;
  assetId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  isEncrypted: boolean;
  timestamp: number;
  botType: string;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WhaleAlert {
  assetId: string;
  side: "BUY" | "SELL";
  size: number;
  priceImpact: number;
  timestamp: number;
}

export interface NewsEvent {
  assetId: string;
  headline: string;
  sentiment: string;
  impact: number;
  timestamp: number;
}

interface UseMarketWebSocketReturn {
  isConnected: boolean;
  assets: Asset[];
  currentAsset: Asset | null;
  candles: Candle[];
  trades: Trade[];
  whaleAlerts: WhaleAlert[];
  news: NewsEvent[];
  subscribe: (assetId: string) => void;
  reconnect: () => void;
}

export function useMarketWebSocket(initialAssetId?: string): UseMarketWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currentAssetId, setCurrentAssetId] = useState<string | null>(initialAssetId || null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [whaleAlerts, setWhaleAlerts] = useState<WhaleAlert[]>([]);
  const [news, setNews] = useState<NewsEvent[]>([]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("🟢 WebSocket bağlandı");
        setIsConnected(true);

        // Eğer asset seçiliyse abone ol
        if (currentAssetId) {
          ws.send(JSON.stringify({ type: "SUBSCRIBE", data: { assetId: currentAssetId } }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error("Message parse error:", e);
        }
      };

      ws.onclose = () => {
        console.log("🔴 WebSocket kapandı");
        setIsConnected(false);

        // 3 saniye sonra yeniden bağlan
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  }, [currentAssetId]);

  const handleMessage = useCallback((msg: { type: string; data: any }) => {
    switch (msg.type) {
      case "INITIAL_STATE":
        setAssets(msg.data.assets);
        break;

      case "ASSETS":
        setAssets(msg.data);
        break;

      case "CANDLE_HISTORY":
        if (msg.data.assetId === currentAssetId) {
          setCandles(msg.data.candles);
        }
        break;

      case "CANDLE_UPDATE":
        if (msg.data.assetId === currentAssetId) {
          setCandles((prev) => {
            if (prev.length === 0) return [msg.data.candle];

            const updated = [...prev];
            const lastIndex = updated.length - 1;

            // Aynı timestamp ise güncelle, değilse ekle
            if (updated[lastIndex].timestamp === msg.data.candle.timestamp) {
              updated[lastIndex] = msg.data.candle;
            } else {
              updated.push(msg.data.candle);
              if (updated.length > 500) updated.shift();
            }

            return updated;
          });
        }
        break;

      case "PRICE_UPDATE":
        setAssets((prev) =>
          prev.map((asset) =>
            asset.id === msg.data.assetId
              ? { ...asset, price: msg.data.price, change24h: msg.data.change24h }
              : asset
          )
        );
        break;

      case "TRADE":
        if (!currentAssetId || msg.data.assetId === currentAssetId) {
          setTrades((prev) => [...prev.slice(-99), msg.data]);
        }
        break;

      case "TRADE_HISTORY":
        if (msg.data.assetId === currentAssetId) {
          setTrades(msg.data.trades);
        }
        break;

      case "WHALE_ALERT":
        setWhaleAlerts((prev) => [...prev, msg.data]);
        // 10 saniye sonra kaldır
        setTimeout(() => {
          setWhaleAlerts((prev) => prev.filter((a) => a.timestamp !== msg.data.timestamp));
        }, 10000);
        break;

      case "NEWS":
        setNews((prev) => [...prev.slice(-9), msg.data]);
        break;
    }
  }, [currentAssetId]);

  const subscribe = useCallback((assetId: string) => {
    setCurrentAssetId(assetId);
    setCandles([]);
    setTrades([]);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "SUBSCRIBE", data: { assetId } }));
    }
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  // Bağlantıyı başlat
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Asset değiştiğinde abone ol
  useEffect(() => {
    if (initialAssetId && wsRef.current?.readyState === WebSocket.OPEN) {
      subscribe(initialAssetId);
    }
  }, [initialAssetId, subscribe]);

  const currentAsset = assets.find((a) => a.id === currentAssetId) || null;

  return {
    isConnected,
    assets,
    currentAsset,
    candles,
    trades,
    whaleAlerts,
    news,
    subscribe,
    reconnect,
  };
}
