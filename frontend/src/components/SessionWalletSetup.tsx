"use client";

import React, { useState } from "react";
import { useSessionWallet } from "@/lib/session-wallet/hooks";
import { Wallet, Zap, Shield, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionWalletSetupProps {
  onComplete?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * SessionWalletSetup - UI component for session wallet management
 *
 * Features:
 * - One-time setup with 3 confirmations
 * - Session status display
 * - Initialize/clear session actions
 * - Balance display
 */
export function SessionWalletSetup({ onComplete, className, compact = false }: SessionWalletSetupProps) {
  const {
    isSessionActive,
    sessionAddress,
    isLoading,
    error,
    needsSetup,
    sessionBalance,
    setupSessionWallet,
    initializeSession,
    clearSession,
  } = useSessionWallet();

  const [showDetails, setShowDetails] = useState(false);
  const [fundAmount, setFundAmount] = useState("0.01");

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

  // Active session view
  if (isSessionActive) {
    if (compact) {
      return (
        <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/30 rounded-lg", className)}>
          <Zap className="w-4 h-4 text-success" />
          <span className="text-sm text-success font-medium">Session Active</span>
          <span className="text-xs text-text-muted">({parseFloat(sessionBalance).toFixed(4)} ETH)</span>
        </div>
      );
    }

    return (
      <div className={cn("p-4 bg-success/10 border border-success/30 rounded-xl", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                Session Wallet Active
                <Zap className="w-4 h-4 text-gold" />
              </h3>
              <p className="text-sm text-text-muted">Trade without MetaMask popups</p>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 hover:bg-card-hover rounded-lg transition-colors"
          >
            {showDetails ? (
              <ChevronUp className="w-5 h-5 text-text-muted" />
            ) : (
              <ChevronDown className="w-5 h-5 text-text-muted" />
            )}
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-success/20 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Session Address</span>
              <span className="font-mono text-text-secondary">
                {sessionAddress?.slice(0, 10)}...{sessionAddress?.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Gas Balance</span>
              <span className="text-text-secondary">{parseFloat(sessionBalance).toFixed(4)} ETH</span>
            </div>
            <button
              onClick={clearSession}
              className="w-full mt-2 py-2 px-4 bg-card-hover hover:bg-danger/20 text-text-secondary hover:text-danger rounded-lg text-sm transition-colors"
            >
              End Session
            </button>
          </div>
        )}
      </div>
    );
  }

  // Session exists but not initialized
  if (!needsSetup && sessionAddress) {
    return (
      <div className={cn("p-4 bg-gold/10 border border-gold/30 rounded-xl", className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Session Available</h3>
            <p className="text-sm text-text-muted">Initialize to enable popup-free trading</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-card rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Session Address</span>
            <span className="font-mono text-text-secondary text-xs">
              {sessionAddress.slice(0, 10)}...{sessionAddress.slice(-8)}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <button
          onClick={handleInitialize}
          disabled={isLoading}
          className={cn(
            "w-full py-3 px-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2",
            isLoading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-gold hover:bg-gold/90 text-black"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Initializing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Initialize Session
            </>
          )}
        </button>

        <p className="text-xs text-text-muted mt-3 text-center">
          Requires one signature to decrypt your session key
        </p>
      </div>
    );
  }

  // Needs setup
  if (!needsSetup) {
    return null;
  }

  return (
    <div className={cn("p-6 bg-card border border-border rounded-xl", className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
          <Zap className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-text-primary">Enable Popup-Free Trading</h3>
          <p className="text-sm text-text-muted">Set up a session wallet for seamless trading</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gold/20 border-2 border-gold/70 shadow-[0_0_8px_rgba(0,212,170,0.3)] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-gold">1</span>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Create Session Key</p>
            <p className="text-xs text-text-muted">Generate a new wallet for trading</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gold/20 border-2 border-gold/70 shadow-[0_0_8px_rgba(0,212,170,0.3)] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-gold">2</span>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Encrypt & Store On-Chain</p>
            <p className="text-xs text-text-muted">FHE encrypted key stored securely</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gold/20 border-2 border-gold/70 shadow-[0_0_8px_rgba(0,212,170,0.3)] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-gold">3</span>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Fund for Gas</p>
            <p className="text-xs text-text-muted">Small ETH amount for transaction fees</p>
          </div>
        </div>
      </div>

      {/* Fund amount selector */}
      <div className="mb-4">
        <label className="text-sm text-text-muted mb-2 block">Gas Funding Amount</label>
        <div className="flex gap-2.5">
          {["0.005", "0.01", "0.02", "0.05"].map((amount) => (
            <button
              key={amount}
              onClick={() => setFundAmount(amount)}
              className={cn(
                "flex-1 min-w-[72px] py-3.5 px-3 rounded-lg text-sm font-medium transition-colors",
                fundAmount === amount
                  ? "bg-gold/20 text-gold border border-gold/30"
                  : "bg-card-hover text-text-secondary hover:bg-card-hover/80"
              )}
            >
              {amount} ETH
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <button
        onClick={handleSetup}
        disabled={isLoading}
        className={cn(
          "w-full py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,212,170,0.4)]",
          isLoading ? "bg-gray-600 cursor-not-allowed shadow-none" : "bg-gold hover:bg-gold/90 text-black hover:shadow-[0_6px_20px_rgba(0,212,170,0.5)]"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Setting up...
          </>
        ) : (
          <>
            <Shield className="w-5 h-5" />
            Setup Session Wallet
          </>
        )}
      </button>

      <div className="mt-4 p-3 bg-background rounded-lg">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
          <p className="text-xs text-text-muted">
            Your main wallet key is never exposed. Only the session wallet is used for trading.
            Session keys are encrypted with FHE and stored on-chain.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SessionWalletSetup;
