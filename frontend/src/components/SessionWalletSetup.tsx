"use client";

import React, { useState } from "react";
import { useSessionWallet } from "@/lib/session-wallet/hooks";
import { Zap, Shield, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
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
          setupSessionWallet,
          initializeSession,
          clearSession,
    } = useSessionWallet();

    const [isExpanded, setIsExpanded] = useState(false);
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

    // ===== ACTIVE SESSION: Minimal success indicator =====
    if (isSessionActive) {
          return (
                  <div className={cn(
                            "flex items-center justify-between px-4 py-3 bg-success/10 border border-success/30 rounded-xl",
                            className
                          )}>
                            <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                                                  <CheckCircle2 className="w-4 h-4 text-success" />
                                      </div>div>
                                      <div>
                                                  <span className="text-sm font-medium text-success">Session Active</span>span>
                                                  <span className="text-xs text-text-muted ml-2">
                                                    {parseFloat(sessionBalance).toFixed(4)} ETH
                                                  </span>span>
                                      </div>div>
                            </div>div>
                          <button
                                      onClick={clearSession}
                                      className="text-xs text-text-muted hover:text-danger transition-colors"
                                    >
                                    End
                          </button>button>
                  </div>div>
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
                                    <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                                                <Zap className="w-4 h-4 text-gold" />
                                    </div>div>
                                    <span className="text-sm text-text-primary">Session wallet ready</span>span>
                          </div>div>
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
                          </button>button>
                  </div>div>
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
                                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                                              <Zap className="w-4 h-4 text-gold" />
                                  </div>div>
                                  <div className="text-left">
                                              <span className="text-sm font-medium text-text-primary">Enable Popup-Free Trading</span>span>
                                              <span className="text-xs text-text-muted ml-2">One-time setup</span>span>
                                  </div>div>
                        </div>div>
                  {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-text-muted" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-text-muted" />
                                  )}
                </button>button>
          
            {/* Expanded Content */}
            {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border">
                      {/* Info banner */}
                              <div className="flex items-start gap-2 mt-3 p-3 bg-background rounded-lg">
                                          <Info className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-text-muted">
                                                        Creates a temporary trading key so you don't need to approve every transaction.
                                                        Your main wallet stays secure.
                                          </p>p>
                              </div>div>
                    
                      {/* Gas amount selector */}
                              <div className="mt-4">
                                          <label className="text-xs text-text-muted mb-2 block">Gas funding</label>label>
                                          <div className="flex gap-2">
                                            {["0.005", "0.01", "0.02", "0.05"].map((amount) => (
                                      <button
                                                          key={amount}
                                                          onClick={() => setFundAmount(amount)}
                                                          className={cn(
                                                                                "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                                                                                fundAmount === amount
                                                                                  ? "bg-gold/20 text-gold border border-gold/30"
                                                                                  : "bg-background text-text-secondary hover:bg-card-hover"
                                                                              )}
                                                        >
                                        {amount} ETH
                                      </button>button>
                                    ))}
                                          </div>div>
                              </div>div>
                    
                      {/* Error display */}
                      {error && (
                                  <div className="mt-3 p-2 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
                                                <p className="text-xs text-danger">{error}</p>p>
                                  </div>div>
                              )}
                    
                      {/* Setup button */}
                              <button
                                            onClick={handleSetup}
                                            disabled={isLoading}
                                            className={cn(
                                                            "w-full mt-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                                                            isLoading
                                                              ? "bg-gray-600 cursor-not-allowed text-gray-400"
                                                              : "bg-gold hover:bg-gold/90 text-black"
                                                          )}
                                          >
                                {isLoading ? (
                                                          <>
                                                                          <Loader2 className="w-4 h-4 animate-spin" />
                                                                          <span className="text-sm">Setting up...</span>span>
                                                          </>>
                                                        ) : (
                                                          <>
                                                                          <Shield className="w-4 h-4" />
                                                                          <span className="text-sm">Setup Session Wallet</span>span>
                                                          </>>
                                                        )}
                              </button>button>
                    </div>div>
                )}
          </div>div>
        );
}

export default SessionWalletSetup;</></></div>
