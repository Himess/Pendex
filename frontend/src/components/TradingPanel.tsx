"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, ArrowUp, ArrowDown, Info, Loader2, CheckCircle, XCircle, ChevronDown, ShieldAlert, Target, Shield, Sparkles, Zap, Wallet, AlertTriangle } from "lucide-react";
import { Asset } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import { keccak256, toHex } from "viem";
import { useOpenPosition, useOpenAnonymousPosition, useContractAddresses, useUserPositions } from "@/lib/contracts/hooks";
import Link from "next/link";
import {
  initFheInstance,
  encryptPositionParams,
  isFheInitialized,
  decryptValue,
} from "@/lib/fhe/client";
import { useWalletClient, usePublicClient } from "wagmi";
import { parseAbi } from "viem";

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

// Contract ABI for FHE balance decryption
const SHADOW_USD_ABI = parseAbi([
  "function confidentialBalanceOf(address account) external returns (uint256)",
]);

// Contract addresses - Session 8 Deployment
const CONTRACT_ADDRESSES = {
  shadowUsd: "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18" as `0x${string}`,
};

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
  const {
    openAnonymousPosition,
    isPending: isAnonPending,
    isConfirming: isAnonConfirming,
    isSuccess: isAnonSuccess,
    error: anonError,
    hash: anonHash
  } = useOpenAnonymousPosition();

  // Error handling state
  const [retryCount, setRetryCount] = useState(0);
  const [lastOrderParams, setLastOrderParams] = useState<{
    assetId: `0x${string}`;
    collateral: string;
    leverage: number;
    isLong: boolean;
  } | null>(null);
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Fetch user positions
  const { data: positionIds } = useUserPositions(address);
  const [showPositions, setShowPositions] = useState(false);
  const openPositionCount = (positionIds?.length || 0);

  // Track sUSD balance - FHE decrypted or localStorage cached
  // UPDATED: Now uses sUSD balance directly (not vault deposit)
  const [sUsdBalance, setSUsdBalance] = useState(0);
  const [isDecryptingBalance, setIsDecryptingBalance] = useState(false);
  const [balanceDecrypted, setBalanceDecrypted] = useState(false);

  // FHE Decrypt sUSD balance
  const handleDecryptSUsdBalance = useCallback(async () => {
    if (!walletClient || !address || !fheReady) {
      console.log("Missing requirements for FHE decryption");
      return;
    }

    try {
      setIsDecryptingBalance(true);
      console.log("🔐 Starting FHE sUSD balance decryption...");

      // 1. Get the encrypted balance handle from ShadowUSD contract
      const { result: handle } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESSES.shadowUsd,
        abi: SHADOW_USD_ABI,
        functionName: "confidentialBalanceOf",
        args: [address],
        account: address,
      });

      console.log("📦 Got encrypted handle:", handle);

      if (!handle || handle === BigInt(0)) {
        console.log("No encrypted balance found, setting to 0");
        setSUsdBalance(0);
        setBalanceDecrypted(true);
        return;
      }

      // Convert bigint handle to hex string
      const handleHex = ("0x" + handle.toString(16).padStart(64, "0")) as `0x${string}`;
      console.log("🔑 Handle as hex:", handleHex);

      // 2. Decrypt using FHE SDK
      const decryptedValue = await decryptValue(
        handleHex,
        CONTRACT_ADDRESSES.shadowUsd,
        address,
        walletClient
      );

      console.log("✅ Decrypted sUSD balance:", decryptedValue);

      // Convert from 6 decimals to display value
      const balance = Number(decryptedValue) / 1e6;
      setSUsdBalance(balance);
      setBalanceDecrypted(true);

      // Cache in localStorage for future reference
      localStorage.setItem(`susd_balance_${address}`, balance.toString());
    } catch (error) {
      console.error("❌ FHE sUSD balance decryption failed:", error);
      // Fall back to localStorage
      const stored = localStorage.getItem(`susd_balance_${address}`);
      if (stored) {
        setSUsdBalance(parseFloat(stored));
      }
    } finally {
      setIsDecryptingBalance(false);
    }
  }, [walletClient, address, fheReady, publicClient]);

  // Load sUSD balance from localStorage on mount
  useEffect(() => {
    if (address) {
      // First, load cached value from localStorage
      const stored = localStorage.getItem(`susd_balance_${address}`);
      if (stored) {
        setSUsdBalance(parseFloat(stored));
      }
    }
  }, [address]);

  // Listen for storage changes (when faucet is used on wallet page)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `susd_balance_${address}` && e.newValue) {
        setSUsdBalance(parseFloat(e.newValue));
        setBalanceDecrypted(true);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [address]);

  const hasInsufficientBalance = sUsdBalance < parseFloat(collateral || "0");
  const isHighLeverage = leverage >= 8;
  const isMaxLeverage = leverage === 10;

  // User-friendly error message parser
  const parseErrorMessage = (err: Error | null): string => {
    if (!err) return "";
    const msg = err.message.toLowerCase();

    // Common error patterns
    if (msg.includes("user rejected") || msg.includes("user denied")) {
      return "Transaction cancelled by user";
    }
    if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
      return "Insufficient balance for gas fees";
    }
    if (msg.includes("nonce too low")) {
      return "Transaction conflict. Please try again.";
    }
    if (msg.includes("replacement transaction underpriced")) {
      return "Gas price too low. Increase gas and retry.";
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return "Network timeout. Check connection and retry.";
    }
    if (msg.includes("network") || msg.includes("disconnected")) {
      return "Network error. Check your connection.";
    }
    if (msg.includes("execution reverted")) {
      // Try to extract revert reason
      if (msg.includes("deposit first")) {
        return "Please deposit sUSD first";
      }
      if (msg.includes("no balance")) {
        return "Insufficient vault balance";
      }
      if (msg.includes("asset not tradeable")) {
        return "This asset is not available for trading";
      }
      return "Transaction failed. Check your balance.";
    }

    // Truncate long messages
    const shortMsg = err.message.slice(0, 100);
    return shortMsg.length < err.message.length ? shortMsg + "..." : shortMsg;
  };

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

  // Update status based on transaction state (includes both regular and anonymous position hooks)
  useEffect(() => {
    const pending = isPending || isAnonPending;
    const confirming = isConfirming || isAnonConfirming;
    const success = isSuccess || isAnonSuccess;
    const txError = error || anonError;

    if (pending) {
      setTxStatus("pending");
      setShowEncryptAnimation(false);
    } else if (confirming) {
      setTxStatus("confirming");
    } else if (success) {
      setTxStatus("success");
      setShowSuccessAnimation(true);
      setCollateral("");
      setTimeout(() => {
        setTxStatus("idle");
        setShowSuccessAnimation(false);
      }, 3000);
    } else if (txError) {
      setTxStatus("error");
      setErrorMessage(parseErrorMessage(txError));
      setShowEncryptAnimation(false);
      // Keep error visible longer for user to read
      setTimeout(() => {
        setTxStatus("idle");
        setErrorMessage(null);
      }, 8000);
    }
  }, [isPending, isConfirming, isSuccess, error, isAnonPending, isAnonConfirming, isAnonSuccess, anonError]);

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

        // Use anonymous position if user selected anonymous mode
        if (isAnonymous) {
          console.log("🕵️ Opening ANONYMOUS position...");
          openAnonymousPosition(
            assetId,
            encrypted.encryptedCollateral,
            encrypted.encryptedLeverage,
            encrypted.encryptedIsLong,
            encrypted.inputProof
          );
        } else {
          openPosition(
            assetId,
            encrypted.encryptedCollateral,
            encrypted.encryptedLeverage,
            encrypted.encryptedIsLong,
            encrypted.inputProof
          );
        }
      } else {
        // Mock mode for Sepolia - use plain values encoded as bytes32
        const mockCollateral = ("0x" + collateralAmount.toString(16).padStart(64, "0")) as `0x${string}`;
        const mockLeverage = ("0x" + leverageAmount.toString(16).padStart(64, "0")) as `0x${string}`;
        const mockIsLong = ("0x" + (isLong ? "1" : "0").padStart(64, "0")) as `0x${string}`;
        const mockProof = "0x00" as `0x${string}`;

        // Use anonymous position if user selected anonymous mode
        if (isAnonymous) {
          console.log("🕵️ Opening ANONYMOUS position (mock)...");
          openAnonymousPosition(assetId, mockCollateral, mockLeverage, mockIsLong, mockProof);
        } else {
          openPosition(assetId, mockCollateral, mockLeverage, mockIsLong, mockProof);
        }
      }
    } catch (err) {
      console.error("Order placement failed:", err);
      setTxStatus("error");
      setShowEncryptAnimation(false);
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order");
    }
  }, [selectedAsset, collateral, address, leverage, isLong, hasFHE, fheReady, shadowVault, openPosition, isAnonymous, openAnonymousPosition]);

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
    (orderType === "limit" && !limitPrice) || hasInsufficientBalance;

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

      <div className="w-64 bg-card border border-border rounded-lg overflow-y-auto flex-shrink-0">
        {/* Header */}
        <div className="px-2.5 py-1.5 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-text-primary">TRADE</h2>
            {hasFHE && (
              <span className={cn(
                "flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded",
                fheReady ? "bg-success/20 text-success" : "bg-gold/20 text-gold"
              )}>
                <Shield className="w-2 h-2" />
                {fheReady ? "FHE" : "..."}
              </span>
            )}
          </div>
        </div>

        <div className="p-2.5 space-y-2.5">
          {/* Order Type Toggle */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setOrderType("market")}
              className={cn(
                "py-1 rounded text-[10px] font-medium transition-all",
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
                "py-1 rounded text-[10px] font-medium transition-all",
                orderType === "limit"
                  ? "bg-gold text-background"
                  : "bg-card-hover text-text-muted hover:text-text-primary"
              )}
            >
              Limit
            </button>
          </div>

          {/* Long/Short Toggle */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setIsLong(true)}
              className={cn(
                "flex items-center justify-center gap-1 py-1.5 rounded font-semibold text-[10px] transition-all",
                isLong
                  ? "bg-success text-white"
                  : "bg-success/20 text-success border border-success/30"
              )}
            >
              <ArrowUp className="w-3 h-3" />
              LONG
            </button>
            <button
              onClick={() => setIsLong(false)}
              className={cn(
                "flex items-center justify-center gap-1 py-1.5 rounded font-semibold text-[10px] transition-all",
                !isLong
                  ? "bg-danger text-white"
                  : "bg-danger/20 text-danger border border-danger/30"
              )}
            >
              <ArrowDown className="w-3 h-3" />
              SHORT
            </button>
          </div>

          {/* Leverage Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-text-secondary">LEVERAGE</label>
              <span className="text-xs font-bold text-gold">{leverage}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full h-1 bg-background rounded appearance-none cursor-pointer accent-gold"
            />
            <div className="flex justify-between text-[9px] text-text-muted">
              <span>1x</span>
              <span>5x</span>
              <span>10x</span>
            </div>
            {/* High Leverage Warning */}
            {isMaxLeverage && (
              <div className="flex items-center gap-1 mt-1 p-1 bg-danger/10 border border-danger/30 rounded text-[9px] text-danger">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>Max leverage! High liquidation risk</span>
              </div>
            )}
            {isHighLeverage && !isMaxLeverage && (
              <div className="flex items-center gap-1 mt-1 p-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-[9px] text-yellow-500">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>High leverage - trade carefully</span>
              </div>
            )}
          </div>

          {/* Available Balance */}
          <div className="flex items-center justify-between py-1 px-2 bg-background rounded border border-border">
            <div className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-gold" />
              <span className="text-[10px] text-text-muted">sUSD</span>
            </div>
            <div className="flex items-center gap-1">
              {!balanceDecrypted && hasFHE && fheReady && sUsdBalance === 0 && (
                <button
                  onClick={handleDecryptSUsdBalance}
                  disabled={isDecryptingBalance}
                  className="text-[8px] text-gold hover:underline"
                >
                  {isDecryptingBalance ? "..." : "🔓"}
                </button>
              )}
              <span className={cn(
                "text-[10px] font-medium",
                sUsdBalance > 0 ? "text-gold" : "text-danger"
              )}>
                {isDecryptingBalance ? "..." : `$${sUsdBalance.toFixed(2)}`}
              </span>
            </div>
          </div>

          {/* No Balance Warning - Link to faucet */}
          {isConnected && sUsdBalance === 0 && (
            <Link
              href="/wallet?tab=faucet"
              className="flex items-center gap-2 p-2 bg-danger/10 border border-danger/30 rounded text-[10px] text-danger hover:bg-danger/20 transition-colors"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>No sUSD! Click to get from faucet</span>
            </Link>
          )}

          {/* Collateral Input */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-text-secondary">COLLATERAL</label>
              {sUsdBalance > 0 && (
                <button
                  onClick={() => setCollateral(sUsdBalance.toString())}
                  className="text-[9px] text-gold hover:underline"
                >
                  MAX
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                placeholder="0.00"
                max={sUsdBalance}
                className={cn(
                  "w-full bg-background border rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none transition-colors pr-12",
                  hasInsufficientBalance && collateral ? "border-danger focus:border-danger" : "border-border focus:border-gold"
                )}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">
                sUSD
              </span>
            </div>
            {hasInsufficientBalance && collateral && (
              <p className="text-[9px] text-danger">Insufficient sUSD balance</p>
            )}
          </div>

          {/* Limit Price Input - Only shown for limit orders */}
          {orderType === "limit" && (
            <div className="space-y-0.5">
              <label className="text-[10px] font-medium text-text-secondary">LIMIT PRICE</label>
              <div className="relative">
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={selectedAsset ? selectedAsset.price.toFixed(2) : "0.00"}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors pr-10"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">
                  USD
                </span>
              </div>
            </div>
          )}

          {/* Anonymous Mode Toggle - Compact */}
          <div className="flex items-center justify-between py-1 px-1.5 bg-background rounded border border-border">
            <div className="flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-gold" />
              <span className="text-[10px] font-medium text-text-primary">Anonymous</span>
            </div>
            <button
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={cn(
                "w-7 h-4 rounded-full transition-colors relative",
                isAnonymous ? "bg-gold" : "bg-border"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                  isAnonymous ? "translate-x-3.5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {/* Advanced Orders Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
          >
            <span className="font-medium">TP / SL</span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAdvanced && "rotate-180")} />
          </button>

          {/* Stop Loss / Take Profit Inputs */}
          {showAdvanced && (
            <div className="space-y-2">
              {/* Take Profit */}
              <div className="space-y-0.5">
                <label className="flex items-center gap-1 text-[10px] font-medium text-success">
                  <Target className="w-3 h-3" />
                  TP
                </label>
                <input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder={selectedAsset ? (selectedAsset.price * 1.1).toFixed(0) : "0"}
                  className="w-full bg-background border border-success/30 rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-success"
                />
              </div>
              {/* Stop Loss */}
              <div className="space-y-0.5">
                <label className="flex items-center gap-1 text-[10px] font-medium text-danger">
                  <ShieldAlert className="w-3 h-3" />
                  SL
                </label>
                <input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder={selectedAsset ? (selectedAsset.price * 0.9).toFixed(0) : "0"}
                  className="w-full bg-background border border-danger/30 rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-danger"
                />
              </div>
            </div>
          )}

          {/* Position Preview - Compact */}
          <div className="bg-background rounded p-2 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-medium text-text-muted uppercase">Preview</h3>
              {isAnonymous && <span className="text-[8px] text-gold">Anon</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-text-muted">Size</span>
                <span className="text-text-primary font-mono">{collateralNum > 0 ? `$${positionSize.toFixed(0)}` : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Liq</span>
                <span className={cn("font-mono", isLong ? "text-danger" : "text-success")}>
                  {collateralNum > 0 && selectedAsset ? `$${liquidationPrice.toFixed(0)}` : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Fee</span>
                <span className="text-text-secondary font-mono">{collateralNum > 0 ? `$${fees.toFixed(2)}` : "-"}</span>
              </div>
              {orderType === "limit" && limitPrice && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Limit</span>
                  <span className="text-gold font-mono">${parseFloat(limitPrice).toFixed(0)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Place Order Button */}
          <button
            onClick={handlePlaceOrder}
            disabled={isButtonDisabled}
            className={cn(
              "w-full py-2 rounded font-bold text-[10px] text-background transition-all flex items-center justify-center gap-1",
              !isButtonDisabled
                ? txStatus === "success"
                  ? "bg-success"
                  : txStatus === "error"
                  ? "bg-danger"
                  : "bg-gold hover:opacity-90 active:scale-[0.98]"
                : "bg-gold/50 cursor-not-allowed"
            )}
          >
            {fheInitializing || txStatus === "encrypting" || txStatus === "pending" || txStatus === "confirming" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : txStatus === "success" ? (
              <CheckCircle className="w-3 h-3" />
            ) : txStatus === "error" ? (
              <XCircle className="w-3 h-3" />
            ) : (
              <Lock className="w-3 h-3" />
            )}
            {getButtonText()}
          </button>

          {/* Error Message with Retry */}
          {errorMessage && (
            <div className="text-[9px] text-danger bg-danger/10 p-1.5 rounded space-y-1">
              <div className="flex items-start gap-1">
                <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {(errorMessage.includes("retry") || errorMessage.includes("try again") || errorMessage.includes("timeout") || errorMessage.includes("network")) && (
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-1 bg-danger/20 hover:bg-danger/30 rounded text-[8px] font-medium transition-colors"
                >
                  Retry Transaction
                </button>
              )}
            </div>
          )}

          {/* Transaction Hash */}
          {hash && txStatus !== "idle" && !showSuccessAnimation && (
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-gold hover:underline block text-center"
            >
              View tx ↗
            </a>
          )}

          {/* Network Mode - Minimal */}
          <div className={cn(
            "text-[9px] py-0.5 text-center",
            hasFHE ? "text-success" : "text-yellow-500"
          )}>
            {hasFHE ? "🔒 Encrypted" : "Demo Mode"}
          </div>

          {/* Open Positions Section */}
          {isConnected && (
            <div className="border-t border-border pt-2 mt-2">
              <button
                onClick={() => setShowPositions(!showPositions)}
                className="w-full flex items-center justify-between py-1 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
              >
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-gold" />
                  <span className="font-medium">Open Positions</span>
                  {openPositionCount > 0 && (
                    <span className="bg-gold/20 text-gold px-1 rounded text-[8px]">
                      {openPositionCount}
                    </span>
                  )}
                </div>
                <ChevronDown className={cn("w-3 h-3 transition-transform", showPositions && "rotate-180")} />
              </button>

              {showPositions && (
                <div className="mt-2 space-y-1.5">
                  {openPositionCount === 0 ? (
                    <p className="text-[9px] text-text-muted text-center py-2">
                      No open positions
                    </p>
                  ) : (
                    <>
                      {positionIds?.map((posId) => (
                        <div
                          key={posId.toString()}
                          className="bg-background rounded p-1.5 border border-border"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-gold">
                              #{posId.toString()}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] text-text-muted bg-success/20 text-success px-1 rounded">
                                Open
                              </span>
                              <Lock className="w-2.5 h-2.5 text-gold" />
                            </div>
                          </div>
                          <div className="flex justify-between mt-1 text-[8px] text-text-muted">
                            <span>🔐 Encrypted position</span>
                            <Link
                              href={`/wallet?tab=positions&id=${posId.toString()}`}
                              className="text-gold hover:underline"
                            >
                              View →
                            </Link>
                          </div>
                        </div>
                      ))}
                      <Link
                        href="/wallet?tab=positions"
                        className="block text-center text-[9px] text-gold hover:underline py-1"
                      >
                        Manage All Positions →
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
