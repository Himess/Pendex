import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export type TimeframeKey = '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W';

export interface TimeframeConfig {
  label: string;
  minutes: number;
  bars: number;
  description: string;
}

export const TIMEFRAMES: Record<TimeframeKey, TimeframeConfig> = {
  '1M': { label: '1M', minutes: 1, bars: 60, description: '1 Minute' },
  '5M': { label: '5M', minutes: 5, bars: 60, description: '5 Minutes' },
  '15M': { label: '15M', minutes: 15, bars: 60, description: '15 Minutes' },
  '1H': { label: '1H', minutes: 60, bars: 48, description: '1 Hour' },
  '4H': { label: '4H', minutes: 240, bars: 42, description: '4 Hours' },
  '1D': { label: '1D', minutes: 1440, bars: 60, description: '1 Day' },
  '1W': { label: '1W', minutes: 10080, bars: 52, description: '1 Week' },
};

export interface ChartRefs {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
}

export interface Drawing {
  id: string;
  type: 'hline' | 'trendline' | 'rectangle' | 'fibonacci';
  data: unknown;
  color: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
