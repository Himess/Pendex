"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, ArrowUp, ArrowDown, Loader2, CheckCircle, XCircle, ShieldAlert, Target, Shield, Sparkles, Zap, Wallet, AlertTriangle, ChevronDown } from "lucide-react";
import { Asset } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import { keccak256, toHex } from "viem";
import { useContractAddresses } from "@/lib/contracts/hooks";
import { CONTRACTS } from "@/lib/contracts/config";
import Link from "next/link";
import {
  initFheInstance,
  isFheInitialized,
  decryptValue,
} from "@/lib/fhe/client";
import { useWalletClient, usePublicClient } from "wagmi";
import { parseAbi } from "viem";
import { useSessionWallet } from "@/lib/session-wallet/hooks";
import { useTradeWithSession } from "@/lib/session-wallet/useTradeWithSession";

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
          <div className="relative">
            <Shield className="w-16 h-16 text-gold animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="w-6 h-6 text-gold animate-bounce" />
            </div>
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
          <div className="w-full space-y-2">
            {["Collateral", "Leverage", "Direction"].map((label, i) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{label}</span>
                  <span className="text-gold">Encrypting...</span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-gold/50 rounded-full animate-[loading_1s_ease-in-out_infinite]"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                </div>
              </div>
            ))}
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
            <p className="text-sm text-text-secondary">Your encrypted position is now active</p>
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

const CONTRACT_ADDRESSES = {
  shadowUsd: CONTRACTS.shadowUsd,
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
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const { address, isConnected } = useAccount();
  const { hasFHE } = useContractAddresses();

  // Session wallet - MANDATORY for trading
  const { isSessionActive, needsSetup, sessionAddress, isLoading: sessionLoading } = useSessionWallet();
  const {
    openPosition: openSessionPosition,
    isTrading: isSessionTrading,
    txHash: sessionTxHash,
    error: sessionError,
    isSuccess: isSessionSuccess,
  } = useTradeWithSession();

  // Session states
  const hasNoSession = needsSetup;
  const hasInactiveSession = !needsSetup && sessionAddress && !isSessionActive;
  const canTrade = isSessionActive;

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  // Dark Pool: Position count query removed for privacy

  // sUSD Balance
  const [sUsdBalance, setSUsdBalance] = useState(0);
  const [isDecryptingBalance, setIsDecryptingBalance] = useState(false);
  const [balanceDecrypted, setBalanceDecrypted] = useState(false);

  const handleDecryptSUsdBalance = useCallback(async () => {
    if (!walletClient || !address || !fheReady) return;

    try {
      setIsDecryptingBalance(true);
      const { result: handle } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESSES.shadowUsd,
        abi: SHADOW_USD_ABI,
        functionName: "confidentialBalanceOf",
        args: [address],
        account: address,
      });

      if (!handle || handle === BigInt(0)) {
        setSUsdBalance(0);
        setBalanceDecrypted(true);
        return;
      }

      const handleHex = ("0x" + handle.toString(16).padStart(64, "0")) as `0x${string}`;
      const decryptedValue = await decryptValue(handleHex, CONTRACT_ADDRESSES.shadowUsd, address, walletClient);
      const balance = Number(decryptedValue) / 1e6;
      setSUsdBalance(balance);
      setBalanceDecrypted(true);
      // Version key with contract address to invalidate cache on redeploy
      localStorage.setItem(`susd_balance_${CONTRACT_ADDRESSES.shadowUsd}_${address}`, balance.toString());
    } catch (error) {
      console.error("FHE balance decryption failed:", error);
      const stored = localStorage.getItem(`susd_balance_${CONTRACT_ADDRESSES.shadowUsd}_${address}`);
      if (stored) setSUsdBalance(parseFloat(stored));
    } finally {
      setIsDecryptingBalance(false);
    }
  }, [walletClient, address, fheReady, publicClient]);

  useEffect(() => {
    if (address) {
      // Use versioned key to avoid stale cache from old contracts
      const stored = localStorage.getItem(`susd_balance_${CONTRACT_ADDRESSES.shadowUsd}_${address}`);
      if (stored) setSUsdBalance(parseFloat(stored));
    }
  }, [address]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `susd_balance_${CONTRACT_ADDRESSES.shadowUsd}_${address}` && e.newValue) {
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

  // Initialize FHE
  useEffect(() => {
    if (isFheInitialized()) {
      setFheReady(true);
      setFheInitializing(false);
      return;
    }

    if (!hasFHE) {
      setFheReady(true);
      setFheInitializing(false);
      return;
    }

    setFheInitializing(true);
    let timeoutId: NodeJS.Timeout;

    const initWithTimeout = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("FHE init timeout")), 15000);
        });
        await Promise.race([initFheInstance(), timeoutPromise]);
        clearTimeout(timeoutId);
        setFheReady(true);
      } catch (err) {
        console.error("FHE init failed:", err);
        if (isFheInitialized()) setFheReady(true);
      } finally {
        setFheInitializing(false);
      }
    };

    initWithTimeout();
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [hasFHE]);

  // Update TX status
  useEffect(() => {
    if (isSessionTrading) {
      setTxStatus("pending");
      setShowEncryptAnimation(false);
    } else if (isSessionSuccess) {
      setTxStatus("success");
      setShowSuccessAnimation(true);
      setCollateral("");
      setTimeout(() => {
        setTxStatus("idle");
        setShowSuccessAnimation(false);
      }, 3000);
    } else if (sessionError) {
      setTxStatus("error");
      setErrorMessage(sessionError);
      setShowEncryptAnimation(false);
      setTimeout(() => {
        setTxStatus("idle");
        setErrorMessage(null);
      }, 8000);
    }
  }, [isSessionTrading, isSessionSuccess, sessionError]);

  // ONLY session wallet trading - no fallback!
  const handlePlaceOrder = useCallback(async () => {
    if (!selectedAsset || !collateral || !address || !canTrade) return;

    try {
      setTxStatus("encrypting");
      setErrorMessage(null);
      setShowEncryptAnimation(true);

      const assetId = keccak256(toHex(selectedAsset.symbol.toUpperCase())) as `0x${string}`;
      const collateralAmount = BigInt(Math.floor(parseFloat(collateral) * 1e6));
      const leverageAmount = BigInt(leverage);

      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log("⚡ Using SESSION WALLET for popup-free trading...");
      setShowEncryptAnimation(false);

      await openSessionPosition({
        assetId,
        collateral: collateralAmount,
        leverage: leverageAmount,
        isLong,
      });
    } catch (err) {
      console.error("Order placement failed:", err);
      setTxStatus("error");
      setShowEncryptAnimation(false);
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order");
    }
  }, [selectedAsset, collateral, address, leverage, isLong, canTrade, openSessionPosition]);

  const getButtonText = () => {
    if (!isConnected) return "CONNECT WALLET";
    if (hasNoSession) return "SETUP SESSION FIRST";
    if (hasInactiveSession) return "ACTIVATE SESSION FIRST";
    if (sUsdBalance === 0 && balanceDecrypted) return "GET sUSD FIRST";
    if (!selectedAsset) return "SELECT ASSET";
    if (!collateral) return "ENTER COLLATERAL";
    if (hasInsufficientBalance && collateral) return "INSUFFICIENT BALANCE";
    if (orderType === "limit" && !limitPrice) return "ENTER LIMIT PRICE";
    if (fheInitializing) return "INITIALIZING FHE...";
    if (txStatus === "encrypting") return "ENCRYPTING...";
    if (txStatus === "pending") return "SENDING...";
    if (txStatus === "confirming") return "CONFIRMING...";
    if (txStatus === "success") return "ORDER PLACED!";
    if (txStatus === "error") return "TRY AGAIN";

    const orderTypeLabel = orderType === "limit" ? "LIMIT" : "MARKET";
    return `⚡ PLACE ${orderTypeLabel} ORDER`;
  };

  const hasNoBalance = sUsdBalance === 0 && balanceDecrypted;
  const isButtonDisabled = !isConnected || !canTrade || !selectedAsset || !collateral ||
    fheInitializing || txStatus === "encrypting" || txStatus === "pending" ||
    txStatus === "confirming" || (orderType === "limit" && !limitPrice) || hasInsufficientBalance || hasNoBalance;

  const collateralNum = parseFloat(collateral) || 0;
  const positionSize = collateralNum * leverage;
  const liquidationPrice = selectedAsset
    ? isLong
      ? selectedAsset.price * (1 - 1 / leverage)
      : selectedAsset.price * (1 + 1 / leverage)
    : 0;
  const fees = positionSize * 0.001;

  // DEBUG: Log session state
  console.log("🎯 TradingPanel Session State:", {
    isConnected,
    isSessionActive,
    sessionLoading,
    needsSetup,
    sessionAddress,
    canTrade,
    hasNoSession,
    hasInactiveSession,
  });

  // Loading state - show spinner while checking session
  if (sessionLoading) {
    return (
      <div className="w-64 bg-card border border-border rounded-lg overflow-y-auto flex-shrink-0">
        <div className="px-2.5 py-1.5 border-b border-border">
          <h2 className="text-xs font-semibold text-text-primary">TRADE</h2>
        </div>
        <div className="p-8 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
          <p className="text-xs text-text-muted mt-2">Loading session...</p>
        </div>
      </div>
    );
  }

  // If session not ready, show setup message
  if (isConnected && !isSessionActive) {
    return (
      <div className="w-64 bg-card border border-border rounded-lg overflow-y-auto flex-shrink-0">
        <div className="px-2.5 py-1.5 border-b border-border">
          <h2 className="text-xs font-semibold text-text-primary">TRADE</h2>
        </div>
        <div className="p-4 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center">
            <Zap className="w-8 h-8 text-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              {hasNoSession ? "Session Wallet Required" : "Activate Session"}
            </h3>
            <p className="text-xs text-text-muted">
              {hasNoSession
                ? "Create a session wallet to enable popup-free trading with FHE encryption."
                : "Your session wallet is ready. Click 'Activate' above to start trading."}
            </p>
          </div>
          {hasNoSession && (
            <div className="text-[10px] text-text-muted bg-background rounded p-2 space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3 text-gold" />
                <span>No MetaMask popups for each trade</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-3 h-3 text-gold" />
                <span>FHE encrypted positions</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-gold" />
                <span>Instant order execution</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <EncryptionAnimation isActive={showEncryptAnimation} />
      <SuccessAnimation isActive={showSuccessAnimation} hash={sessionTxHash || undefined} />

      <div className="w-64 bg-card border border-border rounded-lg overflow-y-auto flex-shrink-0">
        {/* Header */}
        <div className="px-2.5 py-1.5 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-text-primary">TRADE</h2>
            <div className="flex items-center gap-1">
              {hasFHE && (
                <span className={cn(
                  "flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded",
                  fheReady ? "bg-success/20 text-success" : "bg-gold/20 text-gold"
                )}>
                  <Shield className="w-2 h-2" />
                  {fheReady ? "FHE" : "..."}
                </span>
              )}
              <span className="flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded bg-gold/20 text-gold">
                <Zap className="w-2 h-2" />
                Session
              </span>
            </div>
          </div>
        </div>

        <div className="p-2.5 space-y-2.5">
          {/* Order Type Toggle */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setOrderType("market")}
              className={cn(
                "py-1 rounded text-[10px] font-medium transition-all",
                orderType === "market" ? "bg-gold text-background" : "bg-card-hover text-text-muted hover:text-text-primary"
              )}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={cn(
                "py-1 rounded text-[10px] font-medium transition-all",
                orderType === "limit" ? "bg-gold text-background" : "bg-card-hover text-text-muted hover:text-text-primary"
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
                isLong ? "bg-success text-white" : "bg-success/20 text-success border border-success/30"
              )}
            >
              <ArrowUp className="w-3 h-3" />
              LONG
            </button>
            <button
              onClick={() => setIsLong(false)}
              className={cn(
                "flex items-center justify-center gap-1 py-1.5 rounded font-semibold text-[10px] transition-all",
                !isLong ? "bg-danger text-white" : "bg-danger/20 text-danger border border-danger/30"
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

          {/* No Balance Warning */}
          {isConnected && sUsdBalance === 0 && (
            <Link
              href="/wallet?tab=deposit"
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
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">sUSD</span>
            </div>
            {hasInsufficientBalance && collateral && (
              <p className="text-[9px] text-danger">Insufficient sUSD balance</p>
            )}
          </div>

          {/* Limit Price */}
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
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">USD</span>
              </div>
            </div>
          )}

          {/* Advanced Orders Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
          >
            <span className="font-medium">TP / SL</span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAdvanced && "rotate-180")} />
          </button>

          {showAdvanced && (
            <div className="space-y-2">
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

          {/* Position Preview */}
          <div className="bg-background rounded p-2 space-y-1">
            <h3 className="text-[9px] font-medium text-text-muted uppercase">Preview</h3>
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
              <div className="flex justify-between">
                <span className="text-text-muted">Max Slip</span>
                <span className="text-gold font-mono">
                  {positionSize <= 1000 ? "0.1%" :
                   positionSize <= 10000 ? "0.3%" :
                   positionSize <= 100000 ? "0.5%" :
                   positionSize <= 1000000 ? "1.0%" : "2.0%"}
                </span>
              </div>
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
              <Zap className="w-3 h-3" />
            )}
            {getButtonText()}
          </button>

          {/* Error Message */}
          {errorMessage && (
            <div className="text-[9px] text-danger bg-danger/10 p-1.5 rounded">
              <div className="flex items-start gap-1">
                <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* TX Hash */}
          {sessionTxHash && txStatus !== "idle" && !showSuccessAnimation && (
            <a
              href={`https://sepolia.etherscan.io/tx/${sessionTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-gold hover:underline block text-center"
            >
              View tx ↗
            </a>
          )}

          {/* Network Mode */}
          <div className={cn("text-[9px] py-0.5 text-center", hasFHE ? "text-success" : "text-yellow-500")}>
            {hasFHE ? "🔒 FHE Encrypted" : "Demo Mode"}
          </div>

          {/* Dark Pool: Position count hidden for privacy */}
        </div>
      </div>
    </>
  );
}
