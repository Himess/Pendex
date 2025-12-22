"use client";

import { useState, useEffect, useCallback } from 'react';
import { TimeframeKey, TIMEFRAMES, CandleData } from './types';

interface UseChartDataProps {
  symbol: string;
  basePrice: number;
  timeframe: TimeframeKey;
}

export const useChartData = ({ symbol, basePrice, timeframe }: UseChartDataProps) => {
  const [data, setData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(false);

  // Seeded random for consistent data
  const seededRandom = useCallback((seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }, []);

  // Generate candlestick data
  const generateData = useCallback(() => {
    const config = TIMEFRAMES[timeframe];
    const bars = config.bars;
    const minutesPerBar = config.minutes;

    // Volatility based on timeframe
    const volatility = timeframe === '1M' ? 0.003
      : timeframe === '5M' ? 0.005
      : timeframe === '15M' ? 0.008
      : timeframe === '1H' ? 0.012
      : timeframe === '4H' ? 0.018
      : timeframe === '1D' ? 0.025
      : 0.04;

    const now = new Date();
    const candleData: CandleData[] = [];

    // Symbol-based seed for consistency
    let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Add timeframe to seed for different data per timeframe
    seed += timeframe.charCodeAt(0) * 100;

    let currentPrice = basePrice * 0.85; // Start lower for uptrend

    for (let i = bars - 1; i >= 0; i--) {
      const barTime = new Date(now.getTime() - i * minutesPerBar * 60 * 1000);

      // Normalize to bar boundary
      if (minutesPerBar >= 1440) {
        barTime.setHours(0, 0, 0, 0);
      } else if (minutesPerBar >= 60) {
        barTime.setMinutes(0, 0, 0);
      } else {
        barTime.setSeconds(0, 0);
      }

      seed++;
      const random1 = seededRandom(seed);
      const random2 = seededRandom(seed + 1000);
      const random3 = seededRandom(seed + 2000);

      // Trend bias (slight upward to reach current price)
      const progress = (bars - i) / bars;
      const targetPrice = basePrice;
      const trendBias = (targetPrice - currentPrice) / (bars - i + 1) / currentPrice;

      const change = (random1 - 0.5 + trendBias * 0.5) * volatility * currentPrice;

      const open = currentPrice;
      const close = currentPrice + change;
      const highExtra = random2 * volatility * currentPrice * 0.5;
      const lowExtra = random3 * volatility * currentPrice * 0.5;
      const high = Math.max(open, close) + highExtra;
      const low = Math.min(open, close) - lowExtra;

      candleData.push({
        time: Math.floor(barTime.getTime() / 1000),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      });

      currentPrice = close;
    }

    return candleData;
  }, [symbol, basePrice, timeframe, seededRandom]);

  // Timeframe veya symbol değişince data güncelle
  useEffect(() => {
    setLoading(true);

    // Simulate async data fetch
    const timer = setTimeout(() => {
      const newData = generateData();
      setData(newData);
      setLoading(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [generateData]);

  // Real-time update için son candle güncelleme
  const updateWithLivePrice = useCallback((newPrice: number) => {
    setData(prevData => {
      if (prevData.length === 0) return prevData;

      const lastCandle = { ...prevData[prevData.length - 1] };
      lastCandle.close = newPrice;
      lastCandle.high = Math.max(lastCandle.high, newPrice);
      lastCandle.low = Math.min(lastCandle.low, newPrice);

      return [...prevData.slice(0, -1), lastCandle];
    });
  }, []);

  return { data, loading, updateWithLivePrice };
};
