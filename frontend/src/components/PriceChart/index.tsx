"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import { Lock, Shield, Wifi, WifiOff } from 'lucide-react';
import { TimeframeKey, TIMEFRAMES } from './types';
import { useChartInstance } from './useChartInstance';
import { useChartData } from './useChartData';
import { ChartToolbar } from './ChartToolbar';
import { Asset, formatUSD, formatPercent } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useLiveAssetPrice } from '@/hooks/useLiveOracle';
import { useCurrentNetwork } from '@/lib/contracts/hooks';

interface PriceChartProps {
  selectedAsset: Asset | null;
}

// FHE Trading launch date (2 months ago)
const FHE_LAUNCH_DATE = new Date();
FHE_LAUNCH_DATE.setMonth(FHE_LAUNCH_DATE.getMonth() - 2);

export function PriceChart({ selectedAsset }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1D');
  const [hoverInfo, setHoverInfo] = useState<{ price: number; time: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const lastPriceLineAddedRef = useRef<TimeframeKey | null>(null);

  // On-chain oracle price
  const network = useCurrentNetwork();
  const { asset: oracleAsset } = useLiveAssetPrice(
    selectedAsset?.symbol || "",
    network
  );

  const livePrice = oracleAsset?.price ?? selectedAsset?.price ?? 0;
  const liveChange = oracleAsset?.change24h ?? selectedAsset?.change24h ?? 0;
  const isConnected = !!oracleAsset;

  // Crosshair move handler
  const handleCrosshairMove = useCallback((price: number | null, time: string | null) => {
    if (price && time) {
      setHoverInfo({ price, time });
    } else {
      setHoverInfo(null);
    }
  }, []);

  // Chart instance (BİR KEZ oluşturulur)
  const {
    initializeChart,
    updateData,
    updateLastCandle,
    addPriceLine,
    clearPriceLines,
  } = useChartInstance({
    containerRef,
    onCrosshairMove: handleCrosshairMove,
  });

  // Chart data (timeframe değişince güncellenir)
  // Oracle fiyatını kullan - static price değil!
  const { data, loading } = useChartData({
    symbol: selectedAsset?.symbol || 'ASSET',
    basePrice: livePrice > 0 ? livePrice : (selectedAsset?.price || 100),
    timeframe,
  });

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Chart'ı initialize et (sadece BİR KEZ, mount sonrası)
  useEffect(() => {
    if (!mounted || !selectedAsset || !containerRef.current) return;

    const timer = setTimeout(async () => {
      await initializeChart();
      setChartReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [mounted, selectedAsset?.id, initializeChart]);

  // Data değişince güncelle (chart'ı yeniden oluşturmadan!)
  useEffect(() => {
    if (chartReady && data.length > 0) {
      updateData(data);

      // FHE Launch marker (sadece 1D timeframe'de, bir kez)
      if (timeframe === '1D' && lastPriceLineAddedRef.current !== '1D') {
        clearPriceLines();
        const launchPrice = (selectedAsset?.price || 100) * 0.88;
        addPriceLine(launchPrice, 'FHE Launch', '#F7B731');
        lastPriceLineAddedRef.current = '1D';
      } else if (timeframe !== '1D' && lastPriceLineAddedRef.current === '1D') {
        clearPriceLines();
        lastPriceLineAddedRef.current = null;
      }
    }
  }, [chartReady, data, updateData, timeframe, selectedAsset?.price, addPriceLine, clearPriceLines]);

  // Live price güncellemesi - only if chart has data
  useEffect(() => {
    // Don't update if chart not ready or no data
    if (!chartReady || !livePrice || livePrice <= 0 || data.length === 0) return;

    const config = TIMEFRAMES[timeframe];
    const now = Math.floor(Date.now() / 1000);
    const barTime = now - (now % (config.minutes * 60));

    // Ensure barTime is after or equal to the last data point
    const lastDataTime = data[data.length - 1]?.time || 0;
    if (barTime < lastDataTime) return;

    try {
      updateLastCandle({
        time: barTime,
        open: livePrice * 0.999,
        high: livePrice * 1.001,
        low: livePrice * 0.998,
        close: livePrice,
      });
    } catch (e) {
      // Chart update error - ignore silently
      console.debug('Chart update skipped:', e);
    }
  }, [chartReady, livePrice, timeframe, updateLastCandle, data]);

  // Timeframe değişikliği
  const handleTimeframeChange = useCallback((tf: TimeframeKey) => {
    setTimeframe(tf);
    // Data hook otomatik olarak yeni data üretecek
    // Chart yeniden oluşturulmayacak, sadece setData çağrılacak
  }, []);

  // No asset selected
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
                {formatUSD(hoverInfo?.price ?? livePrice)}
              </span>
              <span className={cn("text-sm font-medium", liveChange >= 0 ? "text-success" : "text-danger")}>
                {formatPercent(liveChange)}
              </span>
              {hoverInfo && (
                <span className="text-xs text-text-muted ml-2">
                  {hoverInfo.time}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="badge-gold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Encrypted</span>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 relative min-h-[350px]">
        {/* Loading state */}
        {(!mounted || loading || !chartReady) && (
          <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-text-muted">
                {!mounted ? 'Loading...' : loading ? 'Updating data...' : 'Initializing chart...'}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ visibility: mounted && chartReady ? 'visible' : 'hidden' }}
        />

        {/* FHE Trading Badge */}
        {chartReady && timeframe === '1D' && (
          <div className="absolute top-2 left-2 bg-gold/10 border border-gold/30 rounded px-2 py-1 text-xs text-gold flex items-center gap-1">
            <Shield className="w-3 h-3" />
            FHE Trading since {FHE_LAUNCH_DATE.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}

        {/* Timeframe indicator */}
        {chartReady && (
          <div className="absolute bottom-2 left-2 bg-card/90 border border-border rounded px-2 py-1 text-xs text-text-muted">
            {TIMEFRAMES[timeframe].description} chart
          </div>
        )}
      </div>

      {/* Timeframe Selector */}
      <ChartToolbar
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        isConnected={isConnected}
      />
    </div>
  );
}

export default PriceChart;

// Re-export types
export * from './types';
