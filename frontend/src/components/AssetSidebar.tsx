"use client";

import { useState, useMemo } from "react";
import { Lock, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Cpu, Rocket, CreditCard, Database, Users } from "lucide-react";
import { CATEGORIES, ASSETS, Asset, formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useLiveOracle } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";

interface AssetSidebarProps {
  selectedAsset: Asset | null;
  onSelectAsset: (asset: Asset) => void;
}

// Category icons using lucide
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  AI: <Cpu className="w-4 h-4" />,
  AEROSPACE: <Rocket className="w-4 h-4" />,
  FINTECH: <CreditCard className="w-4 h-4" />,
  DATA: <Database className="w-4 h-4" />,
  SOCIAL: <Users className="w-4 h-4" />,
};

export function AssetSidebar({ selectedAsset, onSelectAsset }: AssetSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["AI"]);

  // Live oracle data
  const network = useCurrentNetwork();
  const { assets: liveAssets } = useLiveOracle(network);

  // Create lookup map for live prices
  const livePriceMap = useMemo(() => {
    const map = new Map<string, { price: number; change24h: number }>();
    liveAssets.forEach(a => {
      map.set(a.symbol.toLowerCase(), { price: a.price, change24h: a.change24h });
    });
    return map;
  }, [liveAssets]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const assetsByCategory = Object.keys(CATEGORIES).reduce((acc, category) => {
    acc[category] = ASSETS.filter((asset) => asset.category === category);
    return acc;
  }, {} as Record<string, Asset[]>);

  return (
    <aside className="w-64 bg-card border-r border-border h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          ASSETS
          <Lock className="w-4 h-4 text-gold" />
        </h2>
      </div>

      {/* Categories */}
      <div className="p-2">
        {Object.entries(CATEGORIES).map(([key, category]) => (
          <div key={key} className="mb-1">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(key)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center gap-2 text-text-muted">
                {CATEGORY_ICONS[key]}
                <span className="text-sm font-medium text-text-secondary">
                  {category.name}
                </span>
              </div>
              {expandedCategories.includes(key) ? (
                <ChevronDown className="w-4 h-4 text-text-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-text-muted" />
              )}
            </button>

            {/* Assets List */}
            {expandedCategories.includes(key) && (
              <div className="ml-2 space-y-1">
                {assetsByCategory[key]?.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onSelectAsset(asset)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-lg transition-all duration-200",
                      selectedAsset?.id === asset.id
                        ? "bg-gold/10 border border-gold/30"
                        : "hover:bg-card-hover"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-xs font-bold text-gold border border-border overflow-hidden">
                        {asset.logo ? (
                          <img
                            src={asset.logo}
                            alt={asset.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to initials if logo fails to load
                              (e.target as HTMLImageElement).style.display = "none";
                              (e.target as HTMLImageElement).parentElement!.textContent = asset.symbol.slice(0, 2);
                            }}
                          />
                        ) : (
                          asset.symbol.slice(0, 2)
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-text-primary">
                          {asset.name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatUSD(livePriceMap.get(asset.symbol.toLowerCase())?.price ?? asset.price)}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const change = livePriceMap.get(asset.symbol.toLowerCase())?.change24h ?? asset.change24h;
                      return (
                        <div className="flex items-center gap-1">
                          {change >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-success" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-danger" />
                          )}
                          <span
                            className={cn(
                              "text-xs font-medium",
                              change >= 0 ? "text-success" : "text-danger"
                            )}
                          >
                            {formatPercent(change)}
                          </span>
                        </div>
                      );
                    })()}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom - Encrypted Badge */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="badge-encrypted flex items-center justify-center gap-2 py-2">
          <Lock className="w-3.5 h-3.5" />
          <span className="text-xs">Encrypted</span>
        </div>
      </div>
    </aside>
  );
}
