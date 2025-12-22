"use client";

import { Shield, Wifi, WifiOff } from 'lucide-react';
import { TimeframeKey, TIMEFRAMES } from './types';
import { cn } from '@/lib/utils';

interface ChartToolbarProps {
  timeframe: TimeframeKey;
  onTimeframeChange: (tf: TimeframeKey) => void;
  isConnected: boolean;
}

export function ChartToolbar({
  timeframe,
  onTimeframeChange,
  isConnected,
}: ChartToolbarProps) {
  const timeframeKeys = Object.keys(TIMEFRAMES) as TimeframeKey[];

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-border">
      {/* Timeframe Buttons */}
      <div className="flex items-center gap-1">
        {timeframeKeys.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
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

      {/* Right Side */}
      <div className="flex items-center gap-3">
        {/* Connection Status */}
        <div className="flex items-center gap-2 text-xs">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-success" />
              <span className="text-text-muted">Real-time</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted">Connecting...</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
