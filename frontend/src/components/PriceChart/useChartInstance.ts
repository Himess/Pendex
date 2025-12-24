"use client";

import { useRef, useEffect, useCallback } from 'react';
import type { IChartApi, ISeriesApi, IPriceLine } from 'lightweight-charts';
import type { CandleData } from './types';

interface UseChartInstanceProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onCrosshairMove?: (price: number | null, time: string | null) => void;
}

export const useChartInstance = ({ containerRef, onCrosshairMove }: UseChartInstanceProps) => {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const isInitializedRef = useRef(false);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Chart'ı BİR KEZ oluştur
  const initializeChart = useCallback(async () => {
    if (!containerRef.current || isInitializedRef.current) return;

    try {
      const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight || 400,
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#F7B731',
            width: 1,
            style: 2,
            labelBackgroundColor: '#F7B731',
          },
          horzLine: {
            color: '#F7B731',
            width: 1,
            style: 2,
            labelBackgroundColor: '#F7B731',
          },
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 10,
          minBarSpacing: 5,
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        handleScale: {
          axisPressedMouseMove: { time: true, price: true },
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
      });

      // Candlestick series
      const { CandlestickSeries } = await import('lightweight-charts');
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10B981',
        downColor: '#EF4444',
        borderDownColor: '#EF4444',
        borderUpColor: '#10B981',
        wickDownColor: '#EF4444',
        wickUpColor: '#10B981',
      });

      // Crosshair move event
      if (onCrosshairMove) {
        chart.subscribeCrosshairMove((param) => {
          if (param.point && param.seriesData.size > 0) {
            const data = param.seriesData.get(candleSeries);
            if (data && 'close' in data) {
              const time = param.time ? new Date((param.time as number) * 1000).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : null;
              onCrosshairMove((data as { close: number }).close, time);
            }
          } else {
            onCrosshairMove(null, null);
          }
        });
      }

      chartRef.current = chart;
      seriesRef.current = candleSeries;
      isInitializedRef.current = true;

    } catch (error) {
      console.error('Failed to initialize chart:', error);
    }
  }, [containerRef, onCrosshairMove]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        isInitializedRef.current = false;
        priceLinesRef.current = [];
      }
    };
  }, []);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 400,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // Data güncelleme fonksiyonu (chart'ı yeniden oluşturmadan!)
  const updateData = useCallback((data: CandleData[]) => {
    if (seriesRef.current && data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesRef.current.setData(data as any);

      // Son veriyi görünür yap
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, []);

  // Son candle güncelleme (real-time için)
  const updateLastCandle = useCallback((candle: CandleData) => {
    if (seriesRef.current && candle.time && typeof candle.time === 'number') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seriesRef.current.update(candle as any);
      } catch {
        // Ignore chart update errors (e.g., updating before data is set)
      }
    }
  }, []);

  // Tüm price line'ları temizle
  const clearPriceLines = useCallback(() => {
    if (seriesRef.current) {
      priceLinesRef.current.forEach(line => {
        try {
          seriesRef.current?.removePriceLine(line);
        } catch {
          // ignore
        }
      });
      priceLinesRef.current = [];
    }
  }, []);

  // Price line ekleme
  const addPriceLine = useCallback((price: number, title: string, color: string = '#10B981') => {
    if (seriesRef.current) {
      const priceLine = seriesRef.current.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(priceLine);
      return priceLine;
    }
    return null;
  }, []);

  return {
    chartRef,
    seriesRef,
    isInitialized: isInitializedRef.current,
    initializeChart,
    updateData,
    updateLastCandle,
    addPriceLine,
    clearPriceLines,
  };
};
