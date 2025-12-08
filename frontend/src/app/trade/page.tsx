"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header, AssetSidebar, TradingPanel, PositionsTable, PriceChart, MarketInfo } from "@/components";
import { Asset, ASSETS } from "@/lib/constants";
import { Lock } from "lucide-react";

function TradeContent() {
  const searchParams = useSearchParams();
  const assetId = searchParams.get("asset");

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (assetId) {
      const asset = ASSETS.find(a => a.id === assetId);
      if (asset) {
        setSelectedAsset(asset);
        return;
      }
    }
    setSelectedAsset(ASSETS[0]);
  }, [assetId]);

  return (
    <div className="pt-16 flex min-h-screen">
      {/* Left Sidebar - Assets */}
      <AssetSidebar
        selectedAsset={selectedAsset}
        onSelectAsset={setSelectedAsset}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-x-hidden">
        {/* Chart Section - Takes primary space */}
        <div className="flex gap-4 min-h-[500px]">
          {/* Chart - flex-1 to take most horizontal space */}
          <div className="flex-1 min-w-0">
            <PriceChart selectedAsset={selectedAsset} />
          </div>
          {/* Trading Panel - Fixed width */}
          <TradingPanel selectedAsset={selectedAsset} />
        </div>

        {/* Market Info - Compact bar */}
        <MarketInfo selectedAsset={selectedAsset} />

        {/* Positions Table - Collapsible section */}
        <div className="min-h-[200px]">
          <PositionsTable />
        </div>
      </main>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="pt-16 flex h-screen items-center justify-center">
      <div className="text-center">
        <Lock className="w-12 h-12 text-gold mx-auto mb-4 animate-pulse" />
        <p className="text-text-muted">Loading...</p>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Suspense fallback={<LoadingFallback />}>
        <TradeContent />
      </Suspense>
    </div>
  );
}
