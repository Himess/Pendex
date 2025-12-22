"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useSessionWallet } from "./hooks";
import { encryptPositionParams } from "../fhe/client";
import { CONTRACTS } from "../contracts/config";
import { SHADOW_VAULT_ABI } from "../contracts/abis";

export interface TradeParams {
  assetId: `0x${string}`;
  collateral: bigint;
  leverage: bigint;
  isLong: boolean;
}

export interface UseTradeWithSessionReturn {
  // State
  isTrading: boolean;
  txHash: string | null;
  error: string | null;
  isSuccess: boolean;

  // Actions
  openPosition: (params: TradeParams) => Promise<boolean>;
  closePosition: (positionId: bigint) => Promise<boolean>;
  resetState: () => void;
}

/**
 * useTradeWithSession - Hook for popup-free trading with session wallet
 *
 * Uses the session wallet signer instead of MetaMask
 * No popups required after initial session setup!
 */
export function useTradeWithSession(): UseTradeWithSessionReturn {
  const { isSessionActive, getSessionSigner, sessionAddress, mainWallet } = useSessionWallet();

  const [isTrading, setIsTrading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset state
  const resetState = useCallback(() => {
    setIsTrading(false);
    setTxHash(null);
    setError(null);
    setIsSuccess(false);
  }, []);

  // Open position with session wallet (NO POPUP!)
  const openPosition = useCallback(
    async (params: TradeParams): Promise<boolean> => {
      if (!isSessionActive) {
        setError("Session wallet not active. Please set up first.");
        return false;
      }

      if (!sessionAddress || !mainWallet) {
        setError("Session wallet not initialized.");
        return false;
      }

      resetState();
      setIsTrading(true);

      try {
        // 1. Get session signer
        const sessionSigner = getSessionSigner();
        if (!sessionSigner) {
          throw new Error("Failed to get session signer");
        }

        console.log("🔐 Encrypting position parameters...");

        // 2. Encrypt position parameters using FHE
        // Note: We use the MAIN wallet address for FHE encryption
        // because the position will be owned by the main wallet
        const encrypted = await encryptPositionParams(
          params.collateral,
          params.leverage,
          params.isLong,
          CONTRACTS.shadowVault,
          mainWallet // Main wallet address for position ownership
        );

        console.log("📝 Submitting transaction with session wallet...");

        // 3. Create contract instance with session signer
        const vaultContract = new ethers.Contract(
          CONTRACTS.shadowVault,
          SHADOW_VAULT_ABI,
          sessionSigner
        );

        // 4. Send transaction (NO METAMASK POPUP!)
        const tx = await vaultContract.openPosition(
          params.assetId,
          encrypted.encryptedCollateral,
          encrypted.encryptedLeverage,
          encrypted.encryptedIsLong,
          encrypted.inputProof,
          {
            gasLimit: BigInt(15000000), // High gas for FHE operations
          }
        );

        console.log("⏳ Waiting for confirmation...", tx.hash);
        setTxHash(tx.hash);

        // 5. Wait for transaction confirmation
        const receipt = await tx.wait();

        if (receipt.status === 1) {
          console.log("✅ Position opened successfully!");
          setIsSuccess(true);
          return true;
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        console.error("❌ Trade failed:", err);
        setError(err instanceof Error ? err.message : "Trade failed");
        return false;
      } finally {
        setIsTrading(false);
      }
    },
    [isSessionActive, sessionAddress, mainWallet, getSessionSigner, resetState]
  );

  // Close position with session wallet
  const closePosition = useCallback(
    async (positionId: bigint): Promise<boolean> => {
      if (!isSessionActive) {
        setError("Session wallet not active. Please set up first.");
        return false;
      }

      resetState();
      setIsTrading(true);

      try {
        // 1. Get session signer
        const sessionSigner = getSessionSigner();
        if (!sessionSigner) {
          throw new Error("Failed to get session signer");
        }

        console.log("📝 Closing position with session wallet...");

        // 2. Create contract instance with session signer
        const vaultContract = new ethers.Contract(
          CONTRACTS.shadowVault,
          SHADOW_VAULT_ABI,
          sessionSigner
        );

        // 3. Send transaction (NO METAMASK POPUP!)
        const tx = await vaultContract.closePosition(positionId, {
          gasLimit: BigInt(10000000),
        });

        console.log("⏳ Waiting for confirmation...", tx.hash);
        setTxHash(tx.hash);

        // 4. Wait for transaction confirmation
        const receipt = await tx.wait();

        if (receipt.status === 1) {
          console.log("✅ Position closed successfully!");
          setIsSuccess(true);
          return true;
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        console.error("❌ Close position failed:", err);
        setError(err instanceof Error ? err.message : "Close position failed");
        return false;
      } finally {
        setIsTrading(false);
      }
    },
    [isSessionActive, getSessionSigner, resetState]
  );

  return {
    isTrading,
    txHash,
    error,
    isSuccess,
    openPosition,
    closePosition,
    resetState,
  };
}

export default useTradeWithSession;
