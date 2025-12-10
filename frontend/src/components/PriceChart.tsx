/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Lock, Shield, Wifi, WifiOff, TrendingUp, Minus, Circle } from "lucide-react";
import { Asset, formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useLiveAssetPrice } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";

interface PriceChartProps {
  selectedAsset: Asset | null;
}

// Check if we're in browser environment
const isBrowser = typeof window !== "undefined";

// Timeframe configurations
const TIMEFRAMES = {
  "1M": { label: "1M", minutes: 1, bars: 60, description: "1 Minute" },
  "5M": { label: "5M", minutes: 5, bars: 60, description: "5 Minutes" },
  "1H": { label: "1H", minutes: 60, bars: 48, description: "1 Hour" },
  "1D": { label: "1D", minutes: 1440, bars: 60, description: "1 Day" },
} as const;

type TimeframeKey = keyof typeof TIMEFRAMES;

// FHE Trading launch date (2 months ago)
const FHE_LAUNCH_DATE = new Date();
FHE_LAUNCH_DATE.setMonth(FHE_LAUNCH_DATE.getMonth() - 2);

// Generate realistic candlestick data based on timeframe
function generateCandlestickData(
  basePrice: number,
  symbol: string,
  timeframe: TimeframeKey
): { time: number; open: number; high: number; low: number; close: number }[] {
  const data: { time: number; open: number; high: number; low: number; close: number }[] = [];
  const config = TIMEFRAMES[timeframe];

  // Simple seeded random based on symbol + timeframe
  let seed = (symbol + timeframe).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Start price 15% below current (showing growth over 2 months)
  let currentPrice = basePrice * 0.85;
  const now = new Date();
  const minutesPerBar = config.minutes;
  const totalBars = config.bars;

  for (let i = totalBars; i >= 0; i--) {
    const barTime = new Date(now.getTime() - i * minutesPerBar * 60 * 1000);

    // Volatility based on timeframe (higher for shorter timeframes)
    const baseVolatility = timeframe === "1M" ? 0.003 : timeframe === "5M" ? 0.005 : timeframe === "1H" ? 0.01 : 0.025;
    const volatility = baseVolatility + seededRandom() * baseVolatility;

    // Trend towards current price
    const trend = (basePrice - currentPrice) / basePrice * 0.05;
    const change = (seededRandom() - 0.45 + trend) * volatility;

    const open = currentPrice;
    const close = currentPrice * (1 + change);
    const high = Math.max(open, close) * (1 + seededRandom() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - seededRandom() * volatility * 0.5);

    data.push({
      time: Math.floor(barTime.getTime() / 1000),
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
  }

  return data;
}

// Drawing tools
type DrawingTool = "none" | "hline" | "trendline" | "range";

export function PriceChart({ selectedAsset }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1D");
  const [isChartReady, setIsChartReady] = useState(false);
  const [chartInitialized, setChartInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>("none");
  const [priceLines, setPriceLines] = useState<any[]>([]);

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
      const { createChart, CandlestickSeries } = await import("lightweight-charts");

      if (!chartContainerRef.current) return;

      const container = chartContainerRef.current;
      const rect = container.getBoundingClientRect();
      const width = Math.max(rect.width || container.clientWidth || 800, 400);
      const height = Math.max(rect.height || container.clientHeight || 400, 300);

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
          secondsVisible: timeframe === "1M",
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

      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#10B981",
        downColor: "#EF4444",
        borderUpColor: "#10B981",
        borderDownColor: "#EF4444",
        wickUpColor: "#10B981",
        wickDownColor: "#EF4444",
      });

      // Generate chart data for selected timeframe
      const chartData = generateCandlestickData(selectedAsset.price, selectedAsset.symbol, timeframe);
      candlestickSeries.setData(chartData as any);
      chart.timeScale().fitContent();

      // Add FHE launch marker (vertical line at launch date)
      if (timeframe === "1D") {
        const launchTime = Math.floor(FHE_LAUNCH_DATE.getTime() / 1000);
        // Add a price line at a notable point
        const launchPriceLine = candlestickSeries.createPriceLine({
          price: selectedAsset.price * 0.88,
          color: "#F7B731",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "FHE Launch",
        });
      }

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

      // Click handler for drawing tools
      chart.subscribeClick((param: any) => {
        if (activeTool === "hline" && param.point && candlestickSeriesRef.current) {
          const price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
          if (price) {
            const line = candlestickSeriesRef.current.createPriceLine({
              price,
              color: "#3B82F6",
              lineWidth: 1,
              lineStyle: 0,
              axisLabelVisible: true,
              title: `$${price.toFixed(2)}`,
            });
            setPriceLines(prev => [...prev, line]);
          }
        }
      });

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
  }, [mounted, selectedAsset?.id, selectedAsset?.symbol, selectedAsset?.price, timeframe, activeTool]);

  // Initialize chart when mounted, asset, or timeframe changes
  useEffect(() => {
    if (!mounted || !selectedAsset) return;

    setIsChartReady(false);
    setChartInitialized(false);

    // Multiple attempts with increasing delays
    let attempts = 0;
    const maxAttempts = 5;
    let timer: NodeJS.Timeout;

    const tryInit = () => {
      attempts++;
      if (chartContainerRef.current && chartContainerRef.current.clientWidth > 0) {
        initChart();
      } else if (attempts < maxAttempts) {
        timer = setTimeout(tryInit, 100 * attempts);
      } else {
        initChart();
      }
    };

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
  }, [mounted, selectedAsset?.id, timeframe, initChart]);

  // Update last candle with live price
  useEffect(() => {
    if (!candlestickSeriesRef.current || !isChartReady || !livePrice || !chartInitialized) return;

    const now = Math.floor(Date.now() / 1000);
    const config = TIMEFRAMES[timeframe];
    const barTime = now - (now % (config.minutes * 60));

    try {
      candlestickSeriesRef.current.update({
        time: barTime,
        open: livePrice * 0.998,
        high: livePrice * 1.002,
        low: livePrice * 0.997,
        close: livePrice,
      } as any);
    } catch {
      // Ignore update errors
    }
  }, [livePrice, isChartReady, chartInitialized, timeframe]);

  // Clear all drawings
  const clearDrawings = () => {
    priceLines.forEach(line => {
      try {
        candlestickSeriesRef.current?.removePriceLine(line);
      } catch (e) {
        // Ignore
      }
    });
    setPriceLines([]);
  };

  if (!selectedAsset) {
    return (
      <div className="h-full bg-card border border-border rounded-xl flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <p className="text-xl text-text-secondary">Select an asset to trade</p>
          <p className="text-sm text-text-muted mt-2">
            Choose from 6 Pre-IPO companies
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

        <div className="flex items-center gap-2">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1 mr-2 border-r border-border pr-2">
            <button
              onClick={() => setActiveTool(activeTool === "hline" ? "none" : "hline")}
              className={cn(
                "p-1.5 rounded text-xs transition-colors",
                activeTool === "hline" ? "bg-gold/20 text-gold" : "text-text-muted hover:text-text-primary hover:bg-card-hover"
              )}
              title="Horizontal Line"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTool(activeTool === "trendline" ? "none" : "trendline")}
              className={cn(
                "p-1.5 rounded text-xs transition-colors",
                activeTool === "trendline" ? "bg-gold/20 text-gold" : "text-text-muted hover:text-text-primary hover:bg-card-hover"
              )}
              title="Trend Line"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            {priceLines.length > 0 && (
              <button
                onClick={clearDrawings}
                className="p-1.5 rounded text-xs text-danger hover:bg-danger/10 transition-colors"
                title="Clear Drawings"
              >
                <Circle className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="badge-gold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Encrypted Data Stream</span>
            <span className="sm:hidden">FHE</span>
          </div>
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

        {/* FHE Trading Badge */}
        {isChartReady && timeframe === "1D" && (
          <div className="absolute top-2 left-2 bg-gold/10 border border-gold/30 rounded px-2 py-1 text-xs text-gold flex items-center gap-1">
            <Shield className="w-3 h-3" />
            FHE Trading since {FHE_LAUNCH_DATE.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>

      {/* Time Frame Selector */}
      <div className="p-3 border-t border-border flex items-center justify-between flex-shrink-0">
        <div className="flex gap-2">
          {(Object.keys(TIMEFRAMES) as TimeframeKey[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tf === timeframe
                  ? "bg-gold/20 text-gold"
                  : "text-text-muted hover:text-text-primary hover:bg-card-hover"
              )}
              title={TIMEFRAMES[tf].description}
            >
              {TIMEFRAMES[tf].label}
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
