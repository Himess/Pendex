/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Lock, Shield, Wifi, WifiOff } from "lucide-react";
import { Asset, formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useLiveAssetPrice } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";

interface PriceChartProps {
  selectedAsset: Asset | null;
}

// Check if we're in browser environment
const isBrowser = typeof window !== "undefined";

// Generate realistic candlestick data based on current price
// Uses seeded random for consistent chart per asset
function generateCandlestickData(basePrice: number, symbol: string, days: number = 90) {
  const data: { time: number; open: number; high: number; low: number; close: number }[] = [];

  // Simple seeded random based on symbol
  let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  let currentPrice = basePrice * 0.85;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const volatility = 0.02 + seededRandom() * 0.03;
    const trend = (basePrice - currentPrice) / basePrice * 0.1;
    const change = (seededRandom() - 0.45 + trend) * volatility;

    const open = currentPrice;
    const close = currentPrice * (1 + change);
    const high = Math.max(open, close) * (1 + seededRandom() * 0.015);
    const low = Math.min(open, close) * (1 - seededRandom() * 0.015);

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

export function PriceChart({ selectedAsset }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState("1D");
  const [isChartReady, setIsChartReady] = useState(false);
  const [chartInitialized, setChartInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);

  // On-chain oracle price (primary source)
  const network = useCurrentNetwork();
  const { asset: oracleAsset } = useLiveAssetPrice(
    selectedAsset?.symbol || "",
    network
  );

  // Use oracle data if available, else props
  const livePrice = oracleAsset?.price ?? selectedAsset?.price ?? 0;
  const liveChange = oracleAsset?.change24h ?? selectedAsset?.change24h ?? 0;
  const isConnected = !!oracleAsset;

  // Set mounted state on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize chart - only runs on client side
  const initChart = useCallback(async () => {
    if (!isBrowser || !mounted || !chartContainerRef.current || !selectedAsset) {
      console.log("Chart init skipped:", { isBrowser, mounted, hasContainer: !!chartContainerRef.current, hasAsset: !!selectedAsset });
      return;
    }

    // Cleanup previous chart
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        // Ignore cleanup errors
      }
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    }

    try {
      const { createChart } = await import("lightweight-charts");

      if (!chartContainerRef.current) return;

      // Get container dimensions - use fallback values for SSR/hydration
      const container = chartContainerRef.current;
      const rect = container.getBoundingClientRect();
      // Ensure minimum dimensions
      const width = Math.max(rect.width || container.clientWidth || 800, 400);
      const height = Math.max(rect.height || container.clientHeight || 400, 300);

      console.log("Chart dimensions:", { width, height });

      const chart = createChart(container, {
        width,
        height,
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
          secondsVisible: false,
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

      // lightweight-charts v5 API: use addSeries with CandlestickSeries
      const { CandlestickSeries } = await import("lightweight-charts");
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#10B981",
        downColor: "#EF4444",
        borderUpColor: "#10B981",
        borderDownColor: "#EF4444",
        wickUpColor: "#10B981",
        wickDownColor: "#EF4444",
      });

      // Generate and set chart data immediately
      const chartData = generateCandlestickData(selectedAsset.price, selectedAsset.symbol);
      candlestickSeries.setData(chartData as any);
      chart.timeScale().fitContent();

      chartRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;
      setIsChartReady(true);
      setChartInitialized(true);

      // Handle resize
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (chartRef.current && width > 0 && height > 0) {
            chartRef.current.applyOptions({ width, height });
          }
        }
      });

      resizeObserver.observe(container);

      // Cleanup function
      return () => {
        resizeObserver.disconnect();
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (e) {
            // Ignore
          }
        }
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      };
    } catch (error) {
      console.error("Failed to initialize chart:", error);
    }
  }, [mounted, selectedAsset?.id, selectedAsset?.symbol, selectedAsset?.price]);

  // Initialize chart when mounted and asset changes
  useEffect(() => {
    if (!mounted || !selectedAsset) return;

    setIsChartReady(false);
    setChartInitialized(false);

    // Multiple attempts with increasing delays to handle hydration issues
    let attempts = 0;
    const maxAttempts = 5;
    let timer: NodeJS.Timeout;

    const tryInit = () => {
      attempts++;
      console.log(`Chart init attempt ${attempts}/${maxAttempts}`);

      if (chartContainerRef.current && chartContainerRef.current.clientWidth > 0) {
        initChart();
      } else if (attempts < maxAttempts) {
        // Retry with exponential backoff
        timer = setTimeout(tryInit, 100 * attempts);
      } else {
        console.warn("Chart container not ready after max attempts, forcing init");
        initChart();
      }
    };

    // Start first attempt after a short delay
    timer = setTimeout(tryInit, 150);

    return () => {
      clearTimeout(timer);
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          // Ignore
        }
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        setIsChartReady(false);
        setChartInitialized(false);
      }
    };
  }, [mounted, selectedAsset?.id, initChart]);

  // Update last candle with live price from oracle
  useEffect(() => {
    if (!candlestickSeriesRef.current || !isChartReady || !livePrice || !chartInitialized) return;

    // Update the last candle's close price with live data
    const now = Math.floor(Date.now() / 1000);
    const today = now - (now % 86400); // Start of today

    try {
      candlestickSeriesRef.current.update({
        time: today,
        open: livePrice * 0.998,
        high: livePrice * 1.005,
        low: livePrice * 0.995,
        close: livePrice,
      } as any);
    } catch {
      // Ignore update errors
    }
  }, [livePrice, isChartReady, chartInitialized]);

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
        {!mounted && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-text-muted">Loading chart...</p>
            </div>
          </div>
        )}
        <div
          ref={chartContainerRef}
          className="absolute inset-0"
          style={{ visibility: mounted && isChartReady ? 'visible' : 'hidden' }}
        />
        {mounted && !isChartReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-text-muted">Initializing chart...</p>
            </div>
          </div>
        )}
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
