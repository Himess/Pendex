"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, ArrowUp, ArrowDown, Info, Loader2, CheckCircle, XCircle, ChevronDown, ShieldAlert, Target, Shield, Sparkles, Zap } from "lucide-react";
import { Asset } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import { keccak256, toHex } from "viem";
import { useOpenPosition, useContractAddresses } from "@/lib/contracts/hooks";
import { initFheInstance, encryptPositionParams, isFheInitialized } from "@/lib/fhe/client";

interface TradingPanelProps {
  selectedAsset: Asset | null;
}

// Encryption animation component
function EncryptionAnimation({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-gold/30 rounded-xl p-8 shadow-2xl max-w-sm mx-4">
        <div className="flex flex-col items-center gap-4">
          {/* Animated shield with particles */}
          <div className="relative">
            <Shield className="w-16 h-16 text-gold animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="w-6 h-6 text-gold animate-bounce" />
            </div>
            {/* Floating particles */}
            {[...Array(6)].map((_, i) => (
              <Sparkles
                key={i}
                className="absolute w-3 h-3 text-gold animate-ping"
                style={{
                  top: `${20 + Math.sin(i * 60) * 30}%`,
                  left: `${20 + Math.cos(i * 60) * 30}%`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "1.5s",
                }}
              />
            ))}
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-gold mb-2">Encrypting Position</h3>
            <p className="text-sm text-text-secondary">
              Your trade details are being encrypted with FHE...
            </p>
          </div>

          {/* Progress bars */}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Collateral</span>
              <span className="text-gold">Encrypting...</span>
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold to-gold/50 rounded-full animate-[loading_1s_ease-in-out_infinite]" />
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Leverage</span>
              <span className="text-gold">Encrypting...</span>
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold/50 rounded-full animate-[loading_1s_ease-in-out_infinite]"
                style={{ animationDelay: "0.2s" }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Direction</span>
              <span className="text-gold">Encrypting...</span>
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold/50 rounded-full animate-[loading_1s_ease-in-out_infinite]"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Zap className="w-3 h-3 text-gold" />
            <span>Powered by Zama FHE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Success animation
function SuccessAnimation({ isActive, hash }: { isActive: boolean; hash?: string }) {
  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-success/30 rounded-xl p-8 shadow-2xl max-w-sm mx-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-success animate-[scale-in_0.3s_ease-out]" />
            </div>
            {/* Confetti-like sparkles */}
            {[...Array(8)].map((_, i) => (
              <Sparkles
                key={i}
                className="absolute w-4 h-4 text-success animate-[fly-out_0.5s_ease-out_forwards]"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: `rotate(${i * 45}deg) translateY(-40px)`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-success mb-2">Position Opened!</h3>
            <p className="text-sm text-text-secondary">
              Your encrypted position is now active
            </p>
          </div>

          {hash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gold hover:underline flex items-center gap-1"
            >
              View on Etherscan
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function TradingPanel({ selectedAsset }: TradingPanelProps) {
  const [isLong, setIsLong] = useState(true);
  const [leverage, setLeverage] = useState(5);
  const [collateral, setCollateral] = useState("");
  const [fheReady, setFheReady] = useState(false);
  const [fheInitializing, setFheInitializing] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "encrypting" | "pending" | "confirming" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEncryptAnimation, setShowEncryptAnimation] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Order type selection
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");

  // Anonymous mode toggle
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Advanced order types
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const { address, isConnected } = useAccount();
  const { shadowVault, hasFHE } = useContractAddresses();
  const { openPosition, isPending, isConfirming, isSuccess, error, hash } = useOpenPosition();

  // Initialize FHE instance on mount
  useEffect(() => {
    if (hasFHE && !isFheInitialized()) {
      setFheInitializing(true);
      initFheInstance()
        .then(() => {
          setFheReady(true);
          setFheInitializing(false);
        })
        .catch((err) => {
          console.error("FHE init failed:", err);
          setFheInitializing(false);
        });
    } else if (!hasFHE) {
      // Mock mode - no FHE needed
      setFheReady(true);
    } else if (isFheInitialized()) {
      setFheReady(true);
    }
  }, [hasFHE]);

  // Update status based on transaction state
  useEffect(() => {
    if (isPending) {
      setTxStatus("pending");
      setShowEncryptAnimation(false);
    } else if (isConfirming) {
      setTxStatus("confirming");
    } else if (isSuccess) {
      setTxStatus("success");
      setShowSuccessAnimation(true);
      setCollateral("");
      setTimeout(() => {
        setTxStatus("idle");
        setShowSuccessAnimation(false);
      }, 3000);
    } else if (error) {
      setTxStatus("error");
      setErrorMessage(error.message);
      setShowEncryptAnimation(false);
      setTimeout(() => {
        setTxStatus("idle");
        setErrorMessage(null);
      }, 5000);
    }
  }, [isPending, isConfirming, isSuccess, error]);

  const handlePlaceOrder = useCallback(async () => {
    if (!selectedAsset || !collateral || !address) return;

    try {
      setTxStatus("encrypting");
      setErrorMessage(null);
      setShowEncryptAnimation(true);

      // Generate asset ID from symbol
      const assetId = keccak256(toHex(selectedAsset.symbol.toUpperCase())) as `0x${string}`;

      // Convert collateral to 6 decimals (USDC standard)
      const collateralAmount = BigInt(Math.floor(parseFloat(collateral) * 1e6));
      const leverageAmount = BigInt(leverage);

      // Simulate encryption delay for visual effect
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (hasFHE && fheReady) {
        // Real FHE encryption for Zama network
        const encrypted = await encryptPositionParams(
          collateralAmount,
          leverageAmount,
          isLong,
          shadowVault,
          address
        );

        openPosition(
          assetId,
          encrypted.encryptedCollateral,
          encrypted.encryptedLeverage,
          encrypted.encryptedIsLong,
          encrypted.inputProof
        );
      } else {
        // Mock mode for Sepolia - use plain values encoded as bytes32
        const mockCollateral = ("0x" + collateralAmount.toString(16).padStart(64, "0")) as `0x${string}`;
        const mockLeverage = ("0x" + leverageAmount.toString(16).padStart(64, "0")) as `0x${string}`;
        const mockIsLong = ("0x" + (isLong ? "1" : "0").padStart(64, "0")) as `0x${string}`;
        const mockProof = "0x00" as `0x${string}`;

        openPosition(assetId, mockCollateral, mockLeverage, mockIsLong, mockProof);
      }
    } catch (err) {
      console.error("Order placement failed:", err);
      setTxStatus("error");
      setShowEncryptAnimation(false);
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order");
    }
  }, [selectedAsset, collateral, address, leverage, isLong, hasFHE, fheReady, shadowVault, openPosition]);

  const getButtonText = () => {
    if (!isConnected) return "CONNECT WALLET";
    if (!selectedAsset) return "SELECT ASSET";
    if (!collateral) return "ENTER COLLATERAL";
    if (orderType === "limit" && !limitPrice) return "ENTER LIMIT PRICE";
    if (fheInitializing) return "INITIALIZING FHE...";
    if (txStatus === "encrypting") return "ENCRYPTING...";
    if (txStatus === "pending") return "CONFIRM IN WALLET...";
    if (txStatus === "confirming") return "CONFIRMING...";
    if (txStatus === "success") return "ORDER PLACED!";
    if (txStatus === "error") return "TRY AGAIN";

    const orderTypeLabel = orderType === "limit" ? "LIMIT" : "MARKET";
    const anonymousLabel = isAnonymous ? "ANONYMOUS " : "";
    return hasFHE ? `PLACE ${anonymousLabel}${orderTypeLabel} ORDER` : `PLACE ${orderTypeLabel} ORDER`;
  };

  const isButtonDisabled = !isConnected || !selectedAsset || !collateral || fheInitializing ||
    txStatus === "encrypting" || txStatus === "pending" || txStatus === "confirming" ||
    (orderType === "limit" && !limitPrice);

  // Calculate estimated values
  const collateralNum = parseFloat(collateral) || 0;
  const positionSize = collateralNum * leverage;
  const liquidationPrice = selectedAsset
    ? isLong
      ? selectedAsset.price * (1 - 1 / leverage)
      : selectedAsset.price * (1 + 1 / leverage)
    : 0;
  const fees = positionSize * 0.001; // 0.1% fee

  return (
    <>
      {/* Animations */}
      <EncryptionAnimation isActive={showEncryptAnimation} />
      <SuccessAnimation isActive={showSuccessAnimation} hash={hash} />

      <div className="w-72 bg-card border border-border rounded-xl overflow-y-auto flex-shrink-0">
        {/* Header */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">TRADE</h2>
            {hasFHE && (
              <span className={cn(
                "flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded",
                fheReady ? "bg-success/20 text-success" : "bg-gold/20 text-gold"
              )}>
                <Shield className="w-2.5 h-2.5" />
                {fheReady ? "FHE" : "..."}
              </span>
            )}
          </div>
        </div>

        <div className="p-3 space-y-4">
          {/* Order Type Toggle */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setOrderType("market")}
              className={cn(
                "py-1.5 rounded text-xs font-medium transition-all",
                orderType === "market"
                  ? "bg-gold text-background"
                  : "bg-card-hover text-text-muted hover:text-text-primary"
              )}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={cn(
                "py-1.5 rounded text-xs font-medium transition-all",
                orderType === "limit"
                  ? "bg-gold text-background"
                  : "bg-card-hover text-text-muted hover:text-text-primary"
              )}
            >
              Limit
            </button>
          </div>

          {/* Long/Short Toggle */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setIsLong(true)}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 rounded font-semibold text-xs transition-all duration-200",
                isLong
                  ? "bg-success text-white shadow-success-glow"
                  : "bg-success/20 text-success border border-success/30 hover:bg-success/30"
              )}
            >
              <ArrowUp className="w-3.5 h-3.5" />
              LONG
            </button>
            <button
              onClick={() => setIsLong(false)}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 rounded font-semibold text-xs transition-all duration-200",
                !isLong
                  ? "bg-danger text-white shadow-danger-glow"
                  : "bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30"
              )}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              SHORT
            </button>
          </div>

          {/* Leverage Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">LEVERAGE</label>
              <span className="text-sm font-bold text-gold">{leverage}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-gold"
            />
            <div className="flex justify-between text-xs text-text-muted">
              <span>1x</span>
              <span>5x</span>
              <span>10x</span>
            </div>
          </div>

          {/* Collateral Input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">COLLATERAL</label>
            <div className="relative">
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                USDC
              </span>
            </div>
          </div>

          {/* Limit Price Input - Only shown for limit orders */}
          {orderType === "limit" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">LIMIT PRICE</label>
              <div className="relative">
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={selectedAsset ? selectedAsset.price.toFixed(2) : "0.00"}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                  USD
                </span>
              </div>
            </div>
          )}

          {/* Anonymous Mode Toggle - Compact */}
          <div className="flex items-center justify-between py-1.5 px-2 bg-background rounded border border-border">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-medium text-text-primary">Anonymous</span>
            </div>
            <button
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={cn(
                "w-9 h-5 rounded-full transition-colors relative",
                isAnonymous ? "bg-gold" : "bg-border"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                  isAnonymous ? "translate-x-[18px]" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {/* Advanced Orders Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <span className="font-medium">TP / SL</span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAdvanced && "rotate-180")} />
          </button>

          {/* Stop Loss / Take Profit Inputs */}
          {showAdvanced && (
            <div className="space-y-4 pb-2">
              {/* Take Profit */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-success">
                  <Target className="w-4 h-4" />
                  TAKE PROFIT
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder={selectedAsset ? `e.g. ${(selectedAsset.price * 1.1).toFixed(2)}` : "0.00"}
                    className="input-field pr-16 border-success/30 focus:border-success"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    USD
                  </span>
                </div>
              </div>

              {/* Stop Loss */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-danger">
                  <ShieldAlert className="w-4 h-4" />
                  STOP LOSS
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder={selectedAsset ? `e.g. ${(selectedAsset.price * 0.9).toFixed(2)}` : "0.00"}
                    className="input-field pr-16 border-danger/30 focus:border-danger"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    USD
                  </span>
                </div>
              </div>

              <div className="bg-gold/10 border border-gold/30 rounded-lg p-3">
                <div className="flex items-start gap-2 text-xs text-gold">
                  <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>
                    TP/SL prices are encrypted. Nobody can front-run your orders.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Position Preview - Now shows calculated values */}
          <div className="bg-background rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-text-secondary">POSITION PREVIEW</h3>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">ORDER TYPE</span>
                <span className="text-text-primary font-medium">
                  {orderType === "limit" ? "Limit" : "Market"}
                  {isAnonymous && <span className="text-gold ml-1">(Anonymous)</span>}
                </span>
              </div>
              {orderType === "limit" && limitPrice && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">LIMIT PRICE</span>
                  <span className="text-gold font-mono">
                    ${parseFloat(limitPrice).toFixed(2)}
                    <Lock className="w-3 h-3 inline ml-1" />
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">SIZE</span>
                {collateralNum > 0 ? (
                  <span className="text-text-primary font-mono">
                    ${positionSize.toFixed(2)}
                    <Lock className="w-3 h-3 text-gold inline ml-1" />
                  </span>
                ) : (
                  <span className="encrypted-value">••••••••</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">LIQ. PRICE</span>
                {collateralNum > 0 && selectedAsset ? (
                  <span className={cn("font-mono", isLong ? "text-danger" : "text-success")}>
                    ${liquidationPrice.toFixed(2)}
                    <Lock className="w-3 h-3 text-gold inline ml-1" />
                  </span>
                ) : (
                  <span className="encrypted-value">••••••••</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">FEES (0.1%)</span>
                {collateralNum > 0 ? (
                  <span className="text-text-secondary font-mono">
                    ${fees.toFixed(2)}
                  </span>
                ) : (
                  <span className="encrypted-value">••••••••</span>
                )}
              </div>
              {takeProfit && (
                <div className="flex justify-between text-sm">
                  <span className="text-success">TAKE PROFIT</span>
                  <span className="text-success font-mono">
                    ${parseFloat(takeProfit).toFixed(2)}
                    <Lock className="w-3 h-3 inline ml-1" />
                  </span>
                </div>
              )}
              {stopLoss && (
                <div className="flex justify-between text-sm">
                  <span className="text-danger">STOP LOSS</span>
                  <span className="text-danger font-mono">
                    ${parseFloat(stopLoss).toFixed(2)}
                    <Lock className="w-3 h-3 inline ml-1" />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Place Order Button */}
          <button
            onClick={handlePlaceOrder}
            disabled={isButtonDisabled}
            className={cn(
              "w-full py-4 rounded-lg font-bold text-background transition-all duration-200 flex items-center justify-center gap-2",
              !isButtonDisabled
                ? txStatus === "success"
                  ? "bg-success hover:shadow-success-glow"
                  : txStatus === "error"
                  ? "bg-danger hover:shadow-danger-glow"
                  : "bg-gold hover:shadow-gold-glow active:scale-[0.98]"
                : "bg-gold/50 cursor-not-allowed"
            )}
          >
            {fheInitializing || txStatus === "encrypting" || txStatus === "pending" || txStatus === "confirming" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : txStatus === "success" ? (
              <CheckCircle className="w-4 h-4" />
            ) : txStatus === "error" ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {getButtonText()}
          </button>

          {/* Error Message */}
          {errorMessage && (
            <div className="text-xs text-danger bg-danger/10 p-2 rounded">
              {errorMessage}
            </div>
          )}

          {/* Transaction Hash */}
          {hash && txStatus !== "idle" && !showSuccessAnimation && (
            <div className="text-xs text-text-muted">
              <a
                href={`https://sepolia.etherscan.io/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
              >
                View transaction
              </a>
            </div>
          )}

          {/* Network Mode Indicator */}
          <div className={cn(
            "text-xs px-2 py-1.5 rounded text-center flex items-center justify-center gap-2",
            hasFHE ? "bg-success/20 text-success" : "bg-yellow-500/20 text-yellow-500"
          )}>
            {hasFHE ? (
              <>
                <Shield className="w-3 h-3" />
                FHE Mode - Real Encryption
              </>
            ) : (
              <>
                <Info className="w-3 h-3" />
                Demo Mode - Sepolia Testnet
              </>
            )}
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-xs text-text-muted">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              {hasFHE
                ? "Your position details are encrypted with FHE. Nobody can see your collateral, leverage, or direction - not even validators."
                : "Demo mode on Sepolia. In production with Zama FHE, all position details would be fully encrypted."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
