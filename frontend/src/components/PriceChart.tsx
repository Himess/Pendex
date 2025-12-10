/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Lock, Shield, Wifi, WifiOff, TrendingUp, Minus,
  MousePointer2, Crosshair, RulerIcon, Trash2,
  Target, ArrowUpRight, Square, Type
} from "lucide-react";
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

// Drawing tools configuration
const DRAWING_TOOLS = [
  { id: "cursor", icon: MousePointer2, label: "Cursor", shortcut: "V" },
  { id: "crosshair", icon: Crosshair, label: "Crosshair", shortcut: "C" },
  { id: "hline", icon: Minus, label: "Horizontal Line", shortcut: "H" },
  { id: "trendline", icon: TrendingUp, label: "Trend Line", shortcut: "T" },
  { id: "ray", icon: ArrowUpRight, label: "Ray", shortcut: "R" },
  { id: "rectangle", icon: Square, label: "Rectangle", shortcut: "G" },
  { id: "fibonacciRetracement", icon: RulerIcon, label: "Fib Retracement", shortcut: "F" },
  { id: "priceRange", icon: Target, label: "Price Range", shortcut: "P" },
  { id: "text", icon: Type, label: "Text Note", shortcut: "N" },
] as const;

type DrawingToolId = typeof DRAWING_TOOLS[number]["id"];

// Drawing state for multi-click tools
interface DrawingState {
  tool: DrawingToolId;
  startPoint?: { time: number; price: number };
  endPoint?: { time: number; price: number };
}

// Stored drawing
interface Drawing {
  id: string;
  type: DrawingToolId;
  color: string;
  points: { time: number; price: number }[];
  text?: string;
  priceLine?: any;
  lineSeries?: any;
}

// Generate realistic candlestick data based on timeframe
function generateCandlestickData(
  basePrice: number,
  symbol: string,
  timeframe: TimeframeKey
): { time: number; open: number; high: number; low: number; close: number }[] {
  const data: { time: number; open: number; high: number; low: number; close: number }[] = [];
  const config = TIMEFRAMES[timeframe];

  let seed = (symbol + timeframe).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  let currentPrice = basePrice * 0.85;
  const now = new Date();
  const minutesPerBar = config.minutes;
  const totalBars = config.bars;

  for (let i = totalBars; i >= 0; i--) {
    const barTime = new Date(now.getTime() - i * minutesPerBar * 60 * 1000);
    const baseVolatility = timeframe === "1M" ? 0.003 : timeframe === "5M" ? 0.005 : timeframe === "1H" ? 0.01 : 0.025;
    const volatility = baseVolatility + seededRandom() * baseVolatility;
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

// Color palette for drawings
const DRAWING_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F7B731", // Gold
];

export function PriceChart({ selectedAsset }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1D");
  const [isChartReady, setIsChartReady] = useState(false);
  const [chartInitialized, setChartInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Drawing state
  const [activeTool, setActiveTool] = useState<DrawingToolId>("cursor");
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedColor, setSelectedColor] = useState(DRAWING_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [cursorInfo, setCursorInfo] = useState<{ price: number; time: string } | null>(null);

  // On-chain oracle price
  const network = useCurrentNetwork();
  const { asset: oracleAsset } = useLiveAssetPrice(
    selectedAsset?.symbol || "",
    network
  );

  const livePrice = oracleAsset?.price ?? selectedAsset?.price ?? 0;
  const liveChange = oracleAsset?.change24h ?? selectedAsset?.change24h ?? 0;
  const isConnected = !!oracleAsset;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toUpperCase();
      const tool = DRAWING_TOOLS.find(t => t.shortcut === key);
      if (tool) {
        setActiveTool(tool.id);
        setDrawingState(null);
      }
      if (e.key === "Escape") {
        setActiveTool("cursor");
        setDrawingState(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        // Delete last drawing
        if (drawings.length > 0) {
          const lastDrawing = drawings[drawings.length - 1];
          removeDrawing(lastDrawing.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawings]);

  // Remove a drawing
  const removeDrawing = useCallback((id: string) => {
    setDrawings(prev => {
      const drawing = prev.find(d => d.id === id);
      if (drawing) {
        // Remove from chart
        if (drawing.priceLine && candlestickSeriesRef.current) {
          try {
            candlestickSeriesRef.current.removePriceLine(drawing.priceLine);
          } catch (e) { /* ignore */ }
        }
        if (drawing.lineSeries && chartRef.current) {
          try {
            chartRef.current.removeSeries(drawing.lineSeries);
          } catch (e) { /* ignore */ }
        }
      }
      return prev.filter(d => d.id !== id);
    });
  }, []);

  // Clear all drawings
  const clearAllDrawings = useCallback(() => {
    drawings.forEach(d => {
      if (d.priceLine && candlestickSeriesRef.current) {
        try {
          candlestickSeriesRef.current.removePriceLine(d.priceLine);
        } catch (e) { /* ignore */ }
      }
      if (d.lineSeries && chartRef.current) {
        try {
          chartRef.current.removeSeries(d.lineSeries);
        } catch (e) { /* ignore */ }
      }
    });
    setDrawings([]);
    setDrawingState(null);
  }, [drawings]);

  // Create drawing on chart
  const createDrawingOnChart = useCallback(async (drawing: Drawing) => {
    if (!chartRef.current || !candlestickSeriesRef.current) return drawing;

    const { LineSeries } = await import("lightweight-charts");

    switch (drawing.type) {
      case "hline": {
        const price = drawing.points[0]?.price;
        if (price) {
          const priceLine = candlestickSeriesRef.current.createPriceLine({
            price,
            color: drawing.color,
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `$${price.toFixed(2)}`,
          });
          return { ...drawing, priceLine };
        }
        break;
      }

      case "trendline":
      case "ray": {
        if (drawing.points.length >= 2) {
          const lineSeries = chartRef.current.addSeries(LineSeries, {
            color: drawing.color,
            lineWidth: 2,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });

          const data = drawing.points.map(p => ({ time: p.time, value: p.price }));

          // For ray, extend the line
          if (drawing.type === "ray" && data.length >= 2) {
            const dx = data[1].time - data[0].time;
            const dy = data[1].value - data[0].value;
            const slope = dy / dx;
            const extendedTime = data[1].time + dx * 10;
            const extendedValue = data[1].value + slope * dx * 10;
            data.push({ time: extendedTime as any, value: extendedValue });
          }

          lineSeries.setData(data as any);
          return { ...drawing, lineSeries };
        }
        break;
      }

      case "fibonacciRetracement": {
        if (drawing.points.length >= 2) {
          const [p1, p2] = drawing.points;
          const diff = p2.price - p1.price;
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const colors = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

          levels.forEach((level, i) => {
            const price = p2.price - diff * level;
            candlestickSeriesRef.current.createPriceLine({
              price,
              color: colors[i],
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `${(level * 100).toFixed(1)}%`,
            });
          });
        }
        break;
      }

      case "priceRange": {
        if (drawing.points.length >= 2) {
          const [p1, p2] = drawing.points;
          const highPrice = Math.max(p1.price, p2.price);
          const lowPrice = Math.min(p1.price, p2.price);
          const diff = highPrice - lowPrice;
          const pctChange = ((highPrice - lowPrice) / lowPrice * 100).toFixed(2);

          candlestickSeriesRef.current.createPriceLine({
            price: highPrice,
            color: "#10B981",
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `High: $${highPrice.toFixed(2)}`,
          });
          candlestickSeriesRef.current.createPriceLine({
            price: lowPrice,
            color: "#EF4444",
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `Low: $${lowPrice.toFixed(2)}`,
          });
          candlestickSeriesRef.current.createPriceLine({
            price: (highPrice + lowPrice) / 2,
            color: "#F7B731",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `Range: $${diff.toFixed(2)} (${pctChange}%)`,
          });
        }
        break;
      }
    }

    return drawing;
  }, []);

  // Handle chart click for drawings
  const handleChartClick = useCallback(async (param: any) => {
    if (!param.point || !candlestickSeriesRef.current || activeTool === "cursor" || activeTool === "crosshair") return;

    const price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
    const time = param.time as number;

    if (!price || !time) return;

    const point = { time, price };

    // Single-click tools
    if (activeTool === "hline") {
      const newDrawing: Drawing = {
        id: `drawing-${Date.now()}`,
        type: "hline",
        color: selectedColor,
        points: [point],
      };
      const createdDrawing = await createDrawingOnChart(newDrawing);
      setDrawings(prev => [...prev, createdDrawing]);
      return;
    }

    // Two-click tools
    if (["trendline", "ray", "fibonacciRetracement", "priceRange", "rectangle"].includes(activeTool)) {
      if (!drawingState || drawingState.tool !== activeTool) {
        // First click
        setDrawingState({ tool: activeTool, startPoint: point });
      } else {
        // Second click - complete drawing
        const newDrawing: Drawing = {
          id: `drawing-${Date.now()}`,
          type: activeTool,
          color: selectedColor,
          points: [drawingState.startPoint!, point],
        };
        const createdDrawing = await createDrawingOnChart(newDrawing);
        setDrawings(prev => [...prev, createdDrawing]);
        setDrawingState(null);
      }
    }
  }, [activeTool, drawingState, selectedColor, createDrawingOnChart]);

  // Initialize chart
  const initChart = useCallback(async () => {
    if (!isBrowser || !mounted || !chartContainerRef.current || !selectedAsset) {
      return;
    }

    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) { /* ignore */ }
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    }

    try {
      const { createChart, CandlestickSeries, CrosshairMode } = await import("lightweight-charts");

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
          mode: activeTool === "crosshair" ? CrosshairMode.Normal : CrosshairMode.Magnet,
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
          scaleMargins: { top: 0.1, bottom: 0.1 },
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

      const chartData = generateCandlestickData(selectedAsset.price, selectedAsset.symbol, timeframe);
      candlestickSeries.setData(chartData as any);
      chart.timeScale().fitContent();

      // Add FHE launch marker on daily chart
      if (timeframe === "1D") {
        candlestickSeries.createPriceLine({
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

      // Resize observer
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (chartRef.current && width > 0 && height > 0) {
            chartRef.current.applyOptions({ width, height });
          }
        }
      });
      resizeObserver.observe(container);

      // Click handler
      chart.subscribeClick(handleChartClick);

      // Crosshair move for cursor info
      chart.subscribeCrosshairMove((param: any) => {
        if (param.point && candlestickSeriesRef.current) {
          const price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
          if (price && param.time) {
            const date = new Date(param.time * 1000);
            setCursorInfo({
              price,
              time: date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            });
          }
        } else {
          setCursorInfo(null);
        }
      });

      return () => {
        resizeObserver.disconnect();
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (e) { /* ignore */ }
        }
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      };
    } catch (error) {
      console.error("Failed to initialize chart:", error);
    }
  }, [mounted, selectedAsset?.id, selectedAsset?.symbol, selectedAsset?.price, timeframe, activeTool, handleChartClick]);

  // Initialize chart
  useEffect(() => {
    if (!mounted || !selectedAsset) return;

    setIsChartReady(false);
    setChartInitialized(false);

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
        } catch (e) { /* ignore */ }
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        setIsChartReady(false);
        setChartInitialized(false);
      }
    };
  }, [mounted, selectedAsset?.id, timeframe, initChart]);

  // Update live price
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
    } catch { /* ignore */ }
  }, [livePrice, isChartReady, chartInitialized, timeframe]);

  if (!selectedAsset) {
    return (
      <div className="h-full bg-card border border-border rounded-xl flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <p className="text-xl text-text-secondary">Select an asset to trade</p>
          <p className="text-sm text-text-muted mt-2">Choose from 6 Pre-IPO companies</p>
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
              <span className={cn("text-sm font-medium", liveChange >= 0 ? "text-success" : "text-danger")}>
                {formatPercent(liveChange)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Cursor info */}
          {cursorInfo && (
            <div className="text-xs text-text-muted mr-2 hidden sm:block">
              <span className="text-text-secondary">${cursorInfo.price.toFixed(2)}</span>
              <span className="mx-1">|</span>
              <span>{cursorInfo.time}</span>
            </div>
          )}

          {/* Drawing status */}
          {drawingState && (
            <div className="text-xs text-gold mr-2 animate-pulse">
              Click to set {drawingState.startPoint ? "end point" : "start point"}
            </div>
          )}

          {/* Color picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-6 h-6 rounded border border-border"
              style={{ backgroundColor: selectedColor }}
              title="Drawing Color"
            />
            {showColorPicker && (
              <div className="absolute right-0 top-8 bg-card border border-border rounded-lg p-2 shadow-lg z-50 grid grid-cols-4 gap-1">
                {DRAWING_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      setShowColorPicker(false);
                    }}
                    className={cn(
                      "w-6 h-6 rounded border",
                      selectedColor === color ? "border-white" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Clear drawings */}
          {drawings.length > 0 && (
            <button
              onClick={clearAllDrawings}
              className="p-1.5 rounded text-danger hover:bg-danger/10 transition-colors"
              title={`Clear All (${drawings.length})`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <div className="badge-gold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Encrypted</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area with Toolbar */}
      <div className="flex-1 flex min-h-[350px]">
        {/* Left Toolbar - TradingView style */}
        <div className="w-10 border-r border-border flex flex-col py-2 bg-background/50">
          {DRAWING_TOOLS.map((tool, index) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            const isInProgress = drawingState?.tool === tool.id;

            return (
              <div key={tool.id}>
                {index === 2 && <div className="h-px bg-border my-1 mx-2" />}
                {index === 6 && <div className="h-px bg-border my-1 mx-2" />}
                <button
                  onClick={() => {
                    setActiveTool(tool.id);
                    if (tool.id !== drawingState?.tool) {
                      setDrawingState(null);
                    }
                  }}
                  className={cn(
                    "w-full p-2 flex items-center justify-center transition-colors relative group",
                    isActive ? "bg-gold/20 text-gold" : "text-text-muted hover:text-text-primary hover:bg-card-hover",
                    isInProgress && "ring-1 ring-gold ring-inset"
                  )}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  <Icon className="w-4 h-4" />
                  {/* Tooltip */}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-card border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {tool.label}
                    <span className="ml-1 text-text-muted">({tool.shortcut})</span>
                  </div>
                </button>
              </div>
            );
          })}

          <div className="flex-1" />

          {/* Drawing count */}
          {drawings.length > 0 && (
            <div className="text-center text-xs text-text-muted py-2 border-t border-border mx-2">
              {drawings.length}
            </div>
          )}
        </div>

        {/* Chart Container */}
        <div className="flex-1 relative">
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
            className={cn(
              "absolute inset-0",
              activeTool !== "cursor" && activeTool !== "crosshair" && "cursor-crosshair"
            )}
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

          {/* Active tool indicator */}
          {activeTool !== "cursor" && isChartReady && (
            <div className="absolute bottom-2 left-2 bg-card/90 border border-border rounded px-2 py-1 text-xs text-text-secondary flex items-center gap-1">
              {(() => {
                const tool = DRAWING_TOOLS.find(t => t.id === activeTool);
                if (tool) {
                  const Icon = tool.icon;
                  return (
                    <>
                      <Icon className="w-3 h-3" />
                      {tool.label}
                    </>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
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
