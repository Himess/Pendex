"use client";

import React, { useState } from "react";
import { useSessionWallet } from "@/lib/session-wallet/hooks";
import { Zap, Shield, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp, Info, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionWalletSetupProps {
  onComplete?: () => void;
  className?: string;
}

/**
 * SessionWalletSetup - Clean, minimal UI for session wallet management
 *
 * Design: Single-line collapsed state, expandable for setup
 * Details about how it works should be in docs
 */
export function SessionWalletSetup({ onComplete, className }: SessionWalletSetupProps) {
  const {
    isSessionActive,
    sessionAddress,
    isLoading,
    error,
    needsSetup,
    sessionBalance,
    isWithdrawing,
    isRefunding,
    setupSessionWallet,
    initializeSession,
    clearSession,
    withdrawToMainWallet,
    refundSessionWallet,
  } = useSessionWallet();

  const [isExpanded, setIsExpanded] = useState(false);
  const [fundAmount, setFundAmount] = useState("0.5");
  const [showRefundOptions, setShowRefundOptions] = useState(false);

  // Handle setup
  const handleSetup = async () => {
    const success = await setupSessionWallet(fundAmount);
    if (success && onComplete) {
      onComplete();
    }
  };

  // Handle initialize (for existing sessions)
  const handleInitialize = async () => {
    const success = await initializeSession();
    if (success && onComplete) {
      onComplete();
    }
  };

  // Handle withdraw to main wallet
  const handleWithdraw = async () => {
    const txHash = await withdrawToMainWallet();
    if (txHash) {
      console.log("Withdraw successful:", txHash);
      setShowRefundOptions(true); // Show refund options after withdraw
    }
  };

  // Handle refund session wallet
  const handleRefund = async (amount: string) => {
    const success = await refundSessionWallet(amount);
    if (success) {
      setShowRefundOptions(false);
    }
  };

  // ===== ACTIVE SESSION: Minimal success indicator =====
  if (isSessionActive) {
    const balanceNum = parseFloat(sessionBalance);
    const isLowBalance = balanceNum < 0.1;
    const needsRefund = isLowBalance || showRefundOptions;

    return (
      <div className={cn("rounded-xl overflow-hidden", className)}>
        <div className={cn(
          "flex items-center justify-between px-4 py-3",
          isLowBalance
            ? "bg-warning/10 border border-warning/30"
            : "bg-success/10 border border-success/30"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center",
              isLowBalance
                ? "bg-warning/20 border-warning/70 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                : "bg-success/20 border-success/70 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
            )}>
              {isLowBalance ? (
                <AlertCircle className="w-4 h-4 text-warning" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-success" />
              )}
            </div>
            <div>
              <span className={cn("text-sm font-medium", isLowBalance ? "text-warning" : "text-success")}>
                {isLowBalance ? "Low Gas Balance" : "Session Active"}
              </span>
              <span className="text-xs text-text-muted ml-2">
                {balanceNum.toFixed(4)} ETH
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!needsRefund && balanceNum > 0.001 && (
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gold/20 text-gold hover:bg-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Withdraw remaining ETH to main wallet"
              >
                {isWithdrawing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ArrowUpRight className="w-3 h-3" />
                )}
                Withdraw
              </button>
            )}
            <button
              onClick={clearSession}
              className="text-xs text-text-muted hover:text-danger transition-colors"
            >
              End
            </button>
          </div>
        </div>

        {/* Refund Options Panel */}
        {needsRefund && (
          <div className="px-4 py-3 bg-card border-t border-border">
            <p className="text-xs text-text-muted mb-3">
              FHE trades need ~0.15 ETH gas. Select amount to fund:
            </p>
            <div className="flex gap-2">
              {["0.1", "0.5", "1"].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleRefund(amount)}
                  disabled={isRefunding}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-xs font-medium transition-all",
                    "bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30",
                    isRefunding && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isRefunding ? (
                    <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                  ) : (
                    `${amount} ETH`
                  )}
                </button>
              ))}
            </div>
            {showRefundOptions && !isLowBalance && (
              <button
                onClick={() => setShowRefundOptions(false)}
                className="w-full mt-2 text-xs text-text-muted hover:text-text-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ===== SESSION EXISTS BUT NOT INITIALIZED =====
  if (!needsSetup && sessionAddress) {
    return (
      <div className={cn(
        "flex items-center justify-between px-4 py-3 bg-gold/10 border border-gold/30 rounded-xl",
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold/20 border-2 border-gold/70 shadow-[0_0_8px_rgba(0,212,170,0.3)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-gold" />
          </div>
          <span className="text-sm text-text-primary">Session wallet ready</span>
        </div>
        <button
          onClick={handleInitialize}
          disabled={isLoading}
          className={cn(
            "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
            isLoading
              ? "bg-gray-600 cursor-not-allowed text-gray-400"
              : "bg-gold hover:bg-gold/90 text-black"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Activate"
          )}
        </button>
      </div>
    );
  }

  // ===== NEEDS SETUP: Collapsed by default =====
  if (!needsSetup) {
    return null;
  }

  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      {/* Collapsed Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold/20 border-2 border-gold/70 shadow-[0_0_8px_rgba(0,212,170,0.3)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-gold" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-text-primary">Enable Popup-Free Trading</span>
            <span className="text-xs text-text-muted ml-2">One-time setup</span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-text-muted" />
        ) : (
          <ChevronDown className="w-5 h-5 text-text-muted" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border">
          {/* Info banner */}
          <div className="flex items-start gap-2 mt-3 p-3 bg-background rounded-lg">
            <Info className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
            <p className="text-xs text-text-muted">
              Creates a temporary trading key for popup-free trading.
              FHE encrypted trades require ~0.15 ETH gas per transaction.
            </p>
          </div>

          {/* Gas amount selector */}
          <div className="mt-4">
            <label className="text-xs text-text-muted mb-2 block">Gas funding</label>
            <div className="flex gap-2.5">
              {["0.1", "0.5", "1"].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setFundAmount(amount)}
                  className={cn(
                    "flex-1 min-w-[72px] py-3.5 rounded-lg text-xs font-medium transition-colors",
                    fundAmount === amount
                      ? "bg-gold/20 text-gold border border-gold/30"
                      : "bg-background text-text-secondary hover:bg-card-hover"
                  )}
                >
                  {amount} ETH
                </button>
              ))}
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="mt-3 p-2 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}

          {/* Setup button */}
          <button
            onClick={handleSetup}
            disabled={isLoading}
            className={cn(
              "w-full mt-4 py-4 px-6 rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,212,170,0.4)]",
              isLoading
                ? "bg-gray-600 cursor-not-allowed text-gray-400 shadow-none"
                : "bg-gold hover:bg-gold/90 text-black hover:shadow-[0_6px_20px_rgba(0,212,170,0.5)]"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Setting up...</span>
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                <span className="text-sm">Setup Session Wallet</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default SessionWalletSetup;
