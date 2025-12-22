"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Header, TradingPanel, PositionsTable, PriceChart, OrderBook, MarketStats, SessionWalletSetup } from "@/components";
import { Asset, ASSETS } from "@/lib/constants";
import { Lock, ChevronDown, X, BookOpen, GripHorizontal, Zap } from "lucide-react";
import { useSessionWallet } from "@/lib/session-wallet/hooks";
import { cn } from "@/lib/utils";
import { useLiveAssetPrice } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";

// Resizable divider component with percentage-based resizing
function ResizeDivider({
  onDrag,
  containerRef
}: {
  onDrag: (deltaPercent: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const containerHeight = containerRef.current?.clientHeight || 600;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPercent = (deltaY / containerHeight) * 100;
      onDrag(deltaPercent);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [onDrag, containerRef]);

  return (
    <div
      className="h-1.5 bg-border hover:bg-gold/50 cursor-row-resize flex items-center justify-center transition-colors group flex-shrink-0"
      onMouseDown={handleMouseDown}
    >
      <GripHorizontal className="w-4 h-4 text-text-muted group-hover:text-gold" />
    </div>
  );
}

// Mobile Bottom Sheet Component
function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 lg:hidden"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-card-hover rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}

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
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 max-h-96 overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-[70]">
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
  const { isSessionActive, needsSetup, isLoading: sessionLoading } = useSessionWallet();

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"orderbook" | "trades">("orderbook");
  const [bottomTab, setBottomTab] = useState<"positions" | "orders" | "history">("positions");
  const [mobileTradeOpen, setMobileTradeOpen] = useState(false);
  const [mobileOrderBookOpen, setMobileOrderBookOpen] = useState(false);
  const [showSessionSetup, setShowSessionSetup] = useState(false);

  // Resizable panels - percentage based (chart gets chartPercent, positions gets rest)
  const [chartPercent, setChartPercent] = useState(60); // Chart takes 60%, positions takes 40%
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const handleSplitResize = useCallback((deltaPercent: number) => {
    setChartPercent(prev => Math.min(Math.max(prev + deltaPercent, 30), 80));
  }, []);

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
        {/* Left: Asset Selector (Mobile) + Chart + Positions */}
        <div ref={leftPanelRef} className="flex-1 flex flex-col min-w-0">
          {/* Asset Selector (visible on smaller screens) */}
          <div className="md:hidden p-2 border-b border-border bg-card flex-shrink-0">
            <AssetSelector selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} />
          </div>

          {/* Chart Area - percentage based */}
          <div className="p-2 min-h-0" style={{ height: `${chartPercent}%` }}>
            <PriceChart selectedAsset={selectedAsset} />
          </div>

          {/* Resizable Divider */}
          <ResizeDivider onDrag={handleSplitResize} containerRef={leftPanelRef} />

          {/* Bottom Panel: Positions / Orders / History - takes remaining space */}
          <div
            className="bg-card flex flex-col min-h-0"
            style={{ height: `${100 - chartPercent}%` }}
          >
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
        <div className="w-[480px] flex border-l border-border bg-card hidden lg:flex">
          {/* Order Book */}
          <div className="w-[220px] flex flex-col border-r border-border">
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
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Session Wallet Status/Setup - Compact Banner */}
            {needsSetup && !isSessionActive && (
              <div className="p-2 border-b border-border">
                <button
                  onClick={() => setShowSessionSetup(!showSessionSetup)}
                  className="w-full flex items-center justify-between p-2 bg-gold/10 border border-gold/30 rounded-lg hover:bg-gold/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gold" />
                    <span className="text-xs font-medium text-gold">Enable Popup-Free Trading</span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-gold transition-transform", showSessionSetup && "rotate-180")} />
                </button>
                {showSessionSetup && (
                  <div className="mt-2">
                    <SessionWalletSetup compact onComplete={() => setShowSessionSetup(false)} />
                  </div>
                )}
              </div>
            )}
            {isSessionActive && (
              <div className="p-2 border-b border-border">
                <div className="flex items-center justify-center gap-2 p-2 bg-success/10 border border-success/30 rounded-lg">
                  <Zap className="w-4 h-4 text-success" />
                  <span className="text-xs font-medium text-success">Popup-Free Trading Active</span>
                </div>
              </div>
            )}
            <TradingPanel selectedAsset={selectedAsset} />
          </div>
        </div>

        {/* Mobile Action Buttons */}
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 flex gap-3">
          <button
            onClick={() => setMobileOrderBookOpen(true)}
            className="flex-1 bg-card border border-border text-text-primary px-4 py-3 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Order Book
          </button>
          <button
            onClick={() => setMobileTradeOpen(true)}
            className="flex-1 bg-gold text-background px-4 py-3 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Trade
          </button>
        </div>

        {/* Mobile Trading Sheet */}
        <MobileBottomSheet
          isOpen={mobileTradeOpen}
          onClose={() => setMobileTradeOpen(false)}
          title={`Trade ${selectedAsset?.symbol || ""}`}
        >
          <TradingPanel selectedAsset={selectedAsset} />
        </MobileBottomSheet>

        {/* Mobile Order Book Sheet */}
        <MobileBottomSheet
          isOpen={mobileOrderBookOpen}
          onClose={() => setMobileOrderBookOpen(false)}
          title="Order Book"
        >
          <div className="h-[60vh]">
            <OrderBook selectedAsset={selectedAsset} currentPrice={currentPrice} />
          </div>
        </MobileBottomSheet>
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
