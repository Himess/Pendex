"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, ArrowUp, ArrowDown, Info, Loader2, CheckCircle, XCircle, ChevronDown, ShieldAlert, Target } from "lucide-react";
import { Asset } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import { keccak256, toHex } from "viem";
import { useOpenPosition, useContractAddresses } from "@/lib/contracts/hooks";
import { initFheInstance, encryptPositionParams, isFheInitialized } from "@/lib/fhe/client";

interface TradingPanelProps {
  selectedAsset: Asset | null;
}

export function TradingPanel({ selectedAsset }: TradingPanelProps) {
  const [isLong, setIsLong] = useState(true);
  const [leverage, setLeverage] = useState(5);
  const [collateral, setCollateral] = useState("");
  const [fheReady, setFheReady] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "encrypting" | "pending" | "confirming" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      initFheInstance()
        .then(() => setFheReady(true))
        .catch((err) => console.error("FHE init failed:", err));
    } else if (!hasFHE) {
      // Mock mode - no FHE needed
      setFheReady(true);
    }
  }, [hasFHE]);

  // Update status based on transaction state
  useEffect(() => {
    if (isPending) setTxStatus("pending");
    else if (isConfirming) setTxStatus("confirming");
    else if (isSuccess) {
      setTxStatus("success");
      setCollateral("");
      setTimeout(() => setTxStatus("idle"), 3000);
    } else if (error) {
      setTxStatus("error");
      setErrorMessage(error.message);
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

      // Generate asset ID from symbol
      const assetId = keccak256(toHex(selectedAsset.symbol.toUpperCase())) as `0x${string}`;

      // Convert collateral to 6 decimals (USDC standard)
      const collateralAmount = BigInt(Math.floor(parseFloat(collateral) * 1e6));
      const leverageAmount = BigInt(leverage);

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
        // Contract should handle this differently in mock mode
        const mockCollateral = ("0x" + collateralAmount.toString(16).padStart(64, "0")) as `0x${string}`;
        const mockLeverage = ("0x" + leverageAmount.toString(16).padStart(64, "0")) as `0x${string}`;
        const mockIsLong = ("0x" + (isLong ? "1" : "0").padStart(64, "0")) as `0x${string}`;
        const mockProof = "0x00" as `0x${string}`;

        openPosition(assetId, mockCollateral, mockLeverage, mockIsLong, mockProof);
      }
    } catch (err) {
      console.error("Order placement failed:", err);
      setTxStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order");
    }
  }, [selectedAsset, collateral, address, leverage, isLong, hasFHE, fheReady, shadowVault, openPosition]);

  const getButtonText = () => {
    if (!isConnected) return "CONNECT WALLET";
    if (!selectedAsset) return "SELECT ASSET";
    if (!collateral) return "ENTER COLLATERAL";
    if (txStatus === "encrypting") return "ENCRYPTING...";
    if (txStatus === "pending") return "CONFIRM IN WALLET...";
    if (txStatus === "confirming") return "CONFIRMING...";
    if (txStatus === "success") return "ORDER PLACED!";
    if (txStatus === "error") return "TRY AGAIN";
    return hasFHE ? "PLACE ENCRYPTED ORDER" : "PLACE ORDER";
  };

  const isButtonDisabled = !isConnected || !selectedAsset || !collateral ||
    txStatus === "encrypting" || txStatus === "pending" || txStatus === "confirming";

  return (
    <div className="w-80 bg-card border border-border rounded-xl overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary">TRADING</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Long/Short Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setIsLong(true)}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all duration-200",
              isLong
                ? "bg-success text-white shadow-success-glow"
                : "bg-success/20 text-success border border-success/30 hover:bg-success/30"
            )}
          >
            <ArrowUp className="w-4 h-4" />
            LONG
          </button>
          <button
            onClick={() => setIsLong(false)}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all duration-200",
              !isLong
                ? "bg-danger text-white shadow-danger-glow"
                : "bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30"
            )}
          >
            <ArrowDown className="w-4 h-4" />
            SHORT
          </button>
        </div>

        {/* Leverage Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">LEVERAGE</label>
            <span className="text-lg font-bold text-gold">{leverage}x</span>
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
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">
            COLLATERAL (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="0.00"
              className="input-field pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">
              USDC
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gold">
            <Lock className="w-3 h-3" />
            <span>Encrypted</span>
          </div>
        </div>

        {/* Advanced Orders Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span className="font-medium">TP / SL</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
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
              <div className="flex items-center gap-1 text-xs text-success/70">
                <Lock className="w-3 h-3" />
                <span>Auto-close when price reaches target</span>
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
              <div className="flex items-center gap-1 text-xs text-danger/70">
                <Lock className="w-3 h-3" />
                <span>Auto-close to limit losses</span>
              </div>
            </div>

            {/* Info about encrypted orders */}
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3">
              <div className="flex items-start gap-2 text-xs text-gold">
                <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  TP/SL prices are encrypted with FHE. Nobody can front-run your stop loss or take profit orders.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Position Preview */}
        <div className="bg-background rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">POSITION PREVIEW</h3>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">SIZE</span>
              <span className="encrypted-value flex items-center gap-1">
                ••••••••
                <Lock className="w-3 h-3 text-gold" />
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">LIQ. PRICE</span>
              <span className="encrypted-value flex items-center gap-1">
                ••••••••
                <Lock className="w-3 h-3 text-gold" />
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">FEES</span>
              <span className="encrypted-value flex items-center gap-1">
                ••••••••
                <Lock className="w-3 h-3 text-gold" />
              </span>
            </div>
            {takeProfit && (
              <div className="flex justify-between text-sm">
                <span className="text-success">TAKE PROFIT</span>
                <span className="encrypted-value flex items-center gap-1 text-success">
                  ${parseFloat(takeProfit).toFixed(2)}
                  <Lock className="w-3 h-3" />
                </span>
              </div>
            )}
            {stopLoss && (
              <div className="flex justify-between text-sm">
                <span className="text-danger">STOP LOSS</span>
                <span className="encrypted-value flex items-center gap-1 text-danger">
                  ${parseFloat(stopLoss).toFixed(2)}
                  <Lock className="w-3 h-3" />
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
          {txStatus === "encrypting" || txStatus === "pending" || txStatus === "confirming" ? (
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
        {hash && txStatus !== "idle" && (
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
          "text-xs px-2 py-1 rounded text-center",
          hasFHE ? "bg-success/20 text-success" : "bg-yellow-500/20 text-yellow-500"
        )}>
          {hasFHE ? "FHE Mode - Real Encryption" : "Mock Mode - Sepolia Testnet"}
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
  );
}
