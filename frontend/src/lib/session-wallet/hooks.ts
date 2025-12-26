"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { sessionWalletManager, WALLET_MANAGER_ADDRESS } from "./manager";

export interface UseSessionWalletReturn {
  // State
  isSessionActive: boolean;
  sessionAddress: string | null;
  mainWallet: string | null;
  isLoading: boolean;
  error: string | null;
  needsSetup: boolean;
  sessionBalance: string;
  isWithdrawing: boolean;
  isRefunding: boolean;

  // Actions
  setupSessionWallet: (fundAmount?: string) => Promise<boolean>;
  initializeSession: () => Promise<boolean>;
  getSessionSigner: () => ethers.Wallet | null;
  revokeSession: () => Promise<void>;
  clearSession: () => void;
  refreshBalance: () => Promise<void>;
  withdrawToMainWallet: () => Promise<string | null>;
  refundSessionWallet: (amount: string) => Promise<boolean>;
}

/**
 * useSessionWallet - React hook for session wallet management
 *
 * Provides:
 * - Session wallet state (active, address, balance)
 * - Setup function (one-time)
 * - Initialize function (each session)
 * - Session signer for popup-free transactions
 */
export function useSessionWallet(): UseSessionWalletReturn {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [mainWallet, setMainWallet] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [sessionBalance, setSessionBalance] = useState("0");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);

  // Create ethers provider from viem client
  const ethersProvider = useMemo(() => {
    if (!publicClient) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new ethers.BrowserProvider((publicClient as any).transport);
  }, [publicClient]);

  // Check session status on mount and wallet change
  useEffect(() => {
    if (isConnected && address && ethersProvider) {
      checkSessionStatus();
    } else {
      // Reset state when disconnected
      setIsSessionActive(false);
      setSessionAddress(null);
      setMainWallet(null);
      setNeedsSetup(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // Sync with singleton state periodically (handles cross-component updates)
  useEffect(() => {
    const syncWithSingleton = () => {
      const singletonActive = sessionWalletManager.isSessionActive();
      const singletonAddress = sessionWalletManager.getSessionAddress();
      const singletonMain = sessionWalletManager.getMainWallet();

      // Only update if singleton says session is active but local state doesn't match
      if (singletonActive && !isSessionActive && singletonMain?.toLowerCase() === address?.toLowerCase()) {
        console.log("🔄 Syncing session state from singleton...");
        setIsSessionActive(true);
        setSessionAddress(singletonAddress);
        setMainWallet(singletonMain);
        setNeedsSetup(false);
      }
    };

    // Check immediately
    syncWithSingleton();

    // Then check every 500ms for changes from other components
    const interval = setInterval(syncWithSingleton, 500);
    return () => clearInterval(interval);
  }, [isSessionActive, address]);

  // Check session status
  const checkSessionStatus = useCallback(async () => {
    if (!address || !ethersProvider) return;

    // Skip if WalletManager is not deployed (address is zero)
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    if (WALLET_MANAGER_ADDRESS.toLowerCase() === zeroAddress.toLowerCase()) {
      console.log("⚠️ WalletManager not deployed yet");
      setNeedsSetup(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if user already has session data in memory
      if (sessionWalletManager.isSessionActive()) {
        const currentSession = sessionWalletManager.getSessionAddress();
        const currentMain = sessionWalletManager.getMainWallet();

        if (currentMain?.toLowerCase() === address.toLowerCase()) {
          setIsSessionActive(true);
          setSessionAddress(currentSession);
          setMainWallet(currentMain);
          setNeedsSetup(false);
          await refreshBalance();
          setIsLoading(false);
          return;
        }
      }

      // Check on-chain if session exists
      const hasSession = await sessionWalletManager.hasExistingSession(address, ethersProvider);

      if (hasSession) {
        // Session exists on-chain but not initialized in memory
        setNeedsSetup(false);
        setIsSessionActive(false);

        // Get session info
        const info = await sessionWalletManager.getSessionInfo(address, ethersProvider);
        if (info) {
          setSessionAddress(info.sessionAddress);
          setMainWallet(address);
        }
      } else {
        // No session on-chain, needs setup
        setNeedsSetup(true);
        setIsSessionActive(false);
        setSessionAddress(null);
      }
    } catch (err) {
      console.error("Session check failed:", err);
      setError(err instanceof Error ? err.message : "Failed to check session status");
      setNeedsSetup(true);
    } finally {
      setIsLoading(false);
    }
  }, [address, ethersProvider]);

  // Setup session wallet (one-time)
  const setupSessionWallet = useCallback(
    async (fundAmount: string = "0.01"): Promise<boolean> => {
      if (!walletClient || !ethersProvider || !address) {
        setError("Wallet not connected");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create ethers signer from wallet client
        const provider = new ethers.BrowserProvider(walletClient.transport);
        const signer = await provider.getSigner();

        // 1. Create session wallet and store encrypted key on-chain
        console.log("🔑 Creating session wallet...");
        const { sessionAddress: newSessionAddress, sessionPrivateKey } =
          await sessionWalletManager.createSessionWallet(signer, ethersProvider);

        // 2. Fund session wallet with ETH for gas
        console.log("💰 Funding session wallet...");
        await sessionWalletManager.fundSessionWallet(signer, newSessionAddress, fundAmount);

        // 3. Store session data in memory (don't need to initialize from chain)
        // Since we just created it, we have the private key
        // @ts-expect-error - accessing private property for immediate use
        sessionWalletManager.sessionData = {
          mainWallet: address,
          sessionAddress: newSessionAddress,
          sessionPrivateKey: sessionPrivateKey,
          createdAt: Math.floor(Date.now() / 1000),
        };

        setIsSessionActive(true);
        setSessionAddress(newSessionAddress);
        setMainWallet(address);
        setNeedsSetup(false);

        await refreshBalance();

        console.log("✅ Session wallet setup complete!");
        return true;
      } catch (err) {
        console.error("Session setup failed:", err);
        setError(err instanceof Error ? err.message : "Failed to setup session wallet");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, ethersProvider, address]
  );

  // Initialize existing session (each login)
  const initializeSession = useCallback(async (): Promise<boolean> => {
    if (!walletClient || !ethersProvider || !address) {
      setError("Wallet not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create ethers signer from wallet client
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Initialize session (decrypt key from chain)
      const success = await sessionWalletManager.initializeSession(signer, ethersProvider);

      if (success) {
        setIsSessionActive(true);
        setSessionAddress(sessionWalletManager.getSessionAddress());
        setMainWallet(sessionWalletManager.getMainWallet());
        setNeedsSetup(false);
        await refreshBalance();
        return true;
      } else {
        setError("Failed to initialize session");
        return false;
      }
    } catch (err) {
      console.error("Session initialization failed:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize session");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, ethersProvider, address]);

  // Get session signer for transactions
  const getSessionSigner = useCallback((): ethers.Wallet | null => {
    if (!sessionWalletManager.isSessionActive() || !ethersProvider) {
      return null;
    }

    try {
      return sessionWalletManager.getSessionSigner(ethersProvider);
    } catch {
      return null;
    }
  }, [ethersProvider]);

  // Revoke session on-chain
  const revokeSession = useCallback(async () => {
    if (!walletClient || !ethersProvider) return;

    setIsLoading(true);

    try {
      // Create ethers signer from wallet client
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const _signer = await provider.getSigner();

      // TODO: Call contract to revoke session (requires signer)
      // const walletManager = new ethers.Contract(WALLET_MANAGER_ADDRESS, WALLET_MANAGER_ABI, _signer);
      // await walletManager.revokeSessionWallet();

      sessionWalletManager.fullLogout();
      setIsSessionActive(false);
      setSessionAddress(null);
      setMainWallet(null);
      setNeedsSetup(true);
      setSessionBalance("0");

      console.log("✅ Session revoked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke session");
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, ethersProvider]);

  // Clear session (logout without revoking)
  const clearSession = useCallback(() => {
    sessionWalletManager.clearSession();
    setIsSessionActive(false);
    // Keep other state for re-initialization
  }, []);

  // Refresh session wallet balance
  const refreshBalance = useCallback(async () => {
    if (!ethersProvider || !sessionWalletManager.isSessionActive()) {
      setSessionBalance("0");
      return;
    }

    try {
      const balance = await sessionWalletManager.getSessionBalance(ethersProvider);
      setSessionBalance(balance);
    } catch {
      setSessionBalance("0");
    }
  }, [ethersProvider]);

  // Withdraw remaining ETH from session wallet to main wallet
  const withdrawToMainWallet = useCallback(async (): Promise<string | null> => {
    if (!ethersProvider || !sessionWalletManager.isSessionActive()) {
      setError("Session not active");
      return null;
    }

    setIsWithdrawing(true);
    setError(null);

    try {
      const txHash = await sessionWalletManager.withdrawToMainWallet(ethersProvider);
      await refreshBalance();
      console.log("✅ Withdrawn to main wallet:", txHash);
      return txHash;
    } catch (err) {
      console.error("Withdraw failed:", err);
      setError(err instanceof Error ? err.message : "Failed to withdraw");
      return null;
    } finally {
      setIsWithdrawing(false);
    }
  }, [ethersProvider, refreshBalance]);

  // Refund session wallet with ETH from main wallet
  const refundSessionWallet = useCallback(async (amount: string): Promise<boolean> => {
    if (!walletClient || !ethersProvider || !sessionAddress) {
      setError("Session not active");
      return false;
    }

    setIsRefunding(true);
    setError(null);

    try {
      // Create ethers signer from wallet client
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Send ETH to session wallet
      console.log(`💰 Refunding session wallet with ${amount} ETH...`);
      const tx = await signer.sendTransaction({
        to: sessionAddress,
        value: ethers.parseEther(amount),
      });
      await tx.wait();

      await refreshBalance();
      console.log(`✅ Refunded session wallet with ${amount} ETH`);
      return true;
    } catch (err) {
      console.error("Refund failed:", err);
      setError(err instanceof Error ? err.message : "Failed to refund");
      return false;
    } finally {
      setIsRefunding(false);
    }
  }, [walletClient, ethersProvider, sessionAddress, refreshBalance]);

  return {
    // State
    isSessionActive,
    sessionAddress,
    mainWallet,
    isLoading,
    error,
    needsSetup,
    sessionBalance,
    isWithdrawing,
    isRefunding,

    // Actions
    setupSessionWallet,
    initializeSession,
    getSessionSigner,
    revokeSession,
    clearSession,
    refreshBalance,
    withdrawToMainWallet,
    refundSessionWallet,
  };
}
