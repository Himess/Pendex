"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header, TradingPanel, PositionsTable, PriceChart, OrderBook, MarketStats } from "@/components";
import { Asset, ASSETS } from "@/lib/constants";
import { Lock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveAssetPrice } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";

// Asset selector dropdown for top bar
function AssetSelector({
  selectedAsset,
  onSelectAsset
}: {
  selectedAsset: Asset | null;
  onSelectAsset: (asset: Asset) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded hover:bg-card-hover transition-colors"
      >
        {selectedAsset && (
          <>
            <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center overflow-hidden border border-border">
              {selectedAsset.logo ? (
                <img
                  src={selectedAsset.logo}
                  alt={selectedAsset.symbol}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-bold text-gold">
                  {selectedAsset.symbol.slice(0, 2)}
                </span>
              )}
            </div>
            <span className="font-medium text-text-primary">{selectedAsset.symbol}</span>
          </>
        )}
        <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 max-h-96 overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-50">
            {ASSETS.map((asset) => (
              <button
                key={asset.id}
                onClick={() => {
                  onSelectAsset(asset);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 hover:bg-card-hover transition-colors",
                  selectedAsset?.id === asset.id && "bg-gold/10"
                )}
              >
                <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center overflow-hidden border border-border">
                  {asset.logo ? (
                    <img src={asset.logo} alt={asset.symbol} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-gold">{asset.symbol.slice(0, 2)}</span>
                  )}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-text-primary">{asset.symbol}</div>
                  <div className="text-xs text-text-muted">{asset.name}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Tab component for Order Book / Trades toggle
function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium transition-colors border-b-2",
        active
          ? "text-text-primary border-gold"
          : "text-text-muted border-transparent hover:text-text-secondary"
      )}
    >
      {children}
    </button>
  );
}

function TradeContent() {
  const searchParams = useSearchParams();
  const assetId = searchParams.get("asset");
  const network = useCurrentNetwork();

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"orderbook" | "trades">("orderbook");
  const [bottomTab, setBottomTab] = useState<"positions" | "orders" | "history">("positions");

  // Get live price
  const { asset: oracleAsset } = useLiveAssetPrice(
    selectedAsset?.symbol || "",
    network
  );
  const currentPrice = oracleAsset?.price ?? selectedAsset?.price;

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
    <div className="flex flex-col h-screen">
      {/* Header - Fixed */}
      <Header />

      {/* Market Stats Bar */}
      <div className="pt-16">
        <MarketStats selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} />
      </div>

      {/* Main Trading Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Asset Selector (Mobile) + Chart */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Asset Selector (visible on smaller screens) */}
          <div className="md:hidden p-2 border-b border-border bg-card">
            <AssetSelector selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} />
          </div>

          {/* Chart Area */}
          <div className="flex-1 p-2">
            <PriceChart selectedAsset={selectedAsset} />
          </div>

          {/* Bottom Panel: Positions / Orders / History */}
          <div className="h-[200px] border-t border-border bg-card flex flex-col">
            {/* Tabs */}
            <div className="flex items-center border-b border-border px-2">
              <TabButton
                active={bottomTab === "positions"}
                onClick={() => setBottomTab("positions")}
              >
                Positions
              </TabButton>
              <TabButton
                active={bottomTab === "orders"}
                onClick={() => setBottomTab("orders")}
              >
                Open Orders
              </TabButton>
              <TabButton
                active={bottomTab === "history"}
                onClick={() => setBottomTab("history")}
              >
                Trade History
              </TabButton>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-2">
              {bottomTab === "positions" && <PositionsTable />}
              {bottomTab === "orders" && (
                <div className="h-full flex items-center justify-center text-text-muted text-sm">
                  No open orders
                </div>
              )}
              {bottomTab === "history" && (
                <div className="h-full flex items-center justify-center text-text-muted text-sm">
                  No trade history
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Order Book + Trading Panel */}
        <div className="w-[600px] flex border-l border-border bg-card hidden lg:flex">
          {/* Order Book */}
          <div className="w-[280px] flex flex-col border-r border-border">
            {/* Tabs */}
            <div className="flex items-center border-b border-border">
              <TabButton
                active={rightPanelTab === "orderbook"}
                onClick={() => setRightPanelTab("orderbook")}
              >
                Order Book
              </TabButton>
              <TabButton
                active={rightPanelTab === "trades"}
                onClick={() => setRightPanelTab("trades")}
              >
                Trades
              </TabButton>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {rightPanelTab === "orderbook" && (
                <OrderBook selectedAsset={selectedAsset} currentPrice={currentPrice} />
              )}
              {rightPanelTab === "trades" && (
                <div className="h-full flex items-center justify-center text-text-muted text-sm p-4">
                  <div className="text-center">
                    <Lock className="w-8 h-8 mx-auto mb-2 text-gold" />
                    <p>Trades are encrypted</p>
                    <p className="text-xs mt-1">FHE protects all trading activity</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trading Panel */}
          <div className="flex-1 overflow-y-auto">
            <TradingPanel selectedAsset={selectedAsset} />
          </div>
        </div>

        {/* Mobile Trading Panel Toggle */}
        <div className="lg:hidden fixed bottom-4 right-4 z-50">
          <button className="bg-gold text-background px-6 py-3 rounded-full font-semibold shadow-lg flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Trade
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Lock className="w-12 h-12 text-gold mx-auto mb-4 animate-pulse" />
        <p className="text-text-muted">Loading trading interface...</p>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <div className="h-screen bg-background overflow-hidden">
      <Suspense fallback={<LoadingFallback />}>
        <TradeContent />
      </Suspense>
    </div>
  );
}
