/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Lock, Shield, Wifi, WifiOff } from "lucide-react";
import { Asset, formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMarketWebSocket, Candle } from "@/hooks/useMarketWebSocket";

interface PriceChartProps {
  selectedAsset: Asset | null;
}

// Fallback: Generate realistic candlestick data if no live data
function generateCandlestickData(basePrice: number, days: number = 90) {
  const data: { time: number; open: number; high: number; low: number; close: number }[] = [];
  let currentPrice = basePrice * 0.85;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const volatility = 0.02 + Math.random() * 0.03;
    const trend = (basePrice - currentPrice) / basePrice * 0.1;
    const change = (Math.random() - 0.45 + trend) * volatility;

    const open = currentPrice;
    const close = currentPrice * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.015);

    data.push({
      time: Math.floor(date.getTime() / 1000),
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
  }

  return data;
}

// Convert WebSocket candles to chart format
function convertCandles(candles: Candle[]) {
  return candles.map((c) => ({
    time: Math.floor(c.timestamp / 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export function PriceChart({ selectedAsset }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState("1D");
  const [isChartReady, setIsChartReady] = useState(false);

  // WebSocket connection
  const { isConnected, currentAsset, candles, subscribe } = useMarketWebSocket(
    selectedAsset?.id
  );

  // Live price from WebSocket or fallback to prop
  const livePrice = currentAsset?.price ?? selectedAsset?.price ?? 0;
  const liveChange = currentAsset?.change24h ?? selectedAsset?.change24h ?? 0;

  // Subscribe to asset when it changes
  useEffect(() => {
    if (selectedAsset?.id) {
      subscribe(selectedAsset.id);
    }
  }, [selectedAsset?.id, subscribe]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || !selectedAsset) return;

    void import("lightweight-charts").then(({ createChart }) => {
      if (!chartContainerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
      }

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: "transparent" },
          textColor: "#9CA3AF",
        },
        grid: {
          vertLines: { color: "rgba(255, 255, 255, 0.05)" },
          horzLines: { color: "rgba(255, 255, 255, 0.05)" },
        },
        crosshair: {
          vertLine: {
            color: "#F7B731",
            labelBackgroundColor: "#F7B731",
          },
          horzLine: {
            color: "#F7B731",
            labelBackgroundColor: "#F7B731",
          },
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          timeVisible: true,
          secondsVisible: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
      });

      const candlestickSeries = (chart as any).addCandlestickSeries({
        upColor: "#10B981",
        downColor: "#EF4444",
        borderUpColor: "#10B981",
        borderDownColor: "#EF4444",
        wickUpColor: "#10B981",
        wickDownColor: "#EF4444",
      });

      // Initial data - use live candles if available, else generate
      if (candles.length > 0) {
        candlestickSeries.setData(convertCandles(candles) as any);
      } else {
        const data = generateCandlestickData(selectedAsset.price);
        candlestickSeries.setData(data as any);
      }

      chart.timeScale().fitContent();

      chartRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;
      setIsChartReady(true);

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        }
      };

      window.addEventListener("resize", handleResize);
      handleResize();

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        setIsChartReady(false);
      }
    };
  }, [selectedAsset?.id]);

  // Update chart with live candles from WebSocket
  useEffect(() => {
    if (!candlestickSeriesRef.current || !isChartReady || candles.length === 0) return;

    const chartData = convertCandles(candles);
    candlestickSeriesRef.current.setData(chartData as any);

    // Update last candle in realtime
    if (chartData.length > 0) {
      const lastCandle = chartData[chartData.length - 1];
      candlestickSeriesRef.current.update(lastCandle as any);
    }
  }, [candles, isChartReady]);

  // Update price line
  useEffect(() => {
    if (!candlestickSeriesRef.current || !isChartReady) return;

    // Remove old price lines and add new one
    try {
      const priceLine = candlestickSeriesRef.current.createPriceLine({
        price: livePrice,
        color: "#F7B731",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Live",
      });

      return () => {
        try {
          candlestickSeriesRef.current?.removePriceLine(priceLine);
        } catch (e) {
          // Ignore
        }
      };
    } catch (e) {
      // Ignore
    }
  }, [livePrice, isChartReady]);

  if (!selectedAsset) {
    return (
      <div className="h-full bg-card border border-border rounded-xl flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <p className="text-xl text-text-secondary">Select an asset to trade</p>
          <p className="text-sm text-text-muted mt-2">
            Choose from 17 Pre-IPO companies
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Chart Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-background flex items-center justify-center text-sm font-bold text-gold border border-border overflow-hidden">
            {selectedAsset.logo ? (
              <img
                src={selectedAsset.logo}
                alt={selectedAsset.symbol}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              selectedAsset.symbol.slice(0, 2)
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary">
                {selectedAsset.name}
              </h2>
              <span className="text-xs text-text-muted">(PRE-IPO)</span>
              {/* Live indicator */}
              {isConnected ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <WifiOff className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-text-primary">
                {formatUSD(livePrice)}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  liveChange >= 0 ? "text-success" : "text-danger"
                )}
              >
                {formatPercent(liveChange)}
              </span>
            </div>
          </div>
        </div>

        <div className="badge-gold flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Encrypted Data Stream</span>
          <span className="sm:hidden">FHE</span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative min-h-[350px]">
        <div ref={chartContainerRef} className="absolute inset-0" />
      </div>

      {/* Time Frame Selector */}
      <div className="p-3 border-t border-border flex items-center justify-between flex-shrink-0">
        <div className="flex gap-2">
          {["1M", "5M", "1H", "1D"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tf === timeframe
                  ? "bg-gold/20 text-gold"
                  : "text-text-muted hover:text-text-primary hover:bg-card-hover"
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-success" />
              <span>Real-time</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Connecting...</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
