"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { CONTRACTS, NETWORK_CONTRACTS, type SupportedNetwork } from "./config";
import { SHADOW_VAULT_ABI, SHADOW_ORACLE_ABI, SHADOW_USD_ABI, SHADOW_LIQUIDITY_POOL_ABI, SHADOW_ORDER_BOOK_ABI } from "./abis";

// ============ NETWORK-AWARE CONTRACT ADDRESSES ============

export function useCurrentNetwork(): SupportedNetwork {
  const chainId = useChainId();
  return chainId === 31337 ? "hardhat" : "sepolia";
}

export function useNetworkContracts() {
  const network = useCurrentNetwork();
  return NETWORK_CONTRACTS[network];
}

export function useContractAddresses() {
  const contracts = useNetworkContracts();
  return {
    shadowVault: contracts.shadowVault,
    shadowOracle: contracts.shadowOracle,
    shadowUsd: contracts.shadowUsd,
    shadowLiquidityPool: contracts.shadowLiquidityPool,
    shadowMarketMaker: contracts.shadowMarketMaker,
    hasFHE: contracts.hasFHE,
  };
}

// ============ SHADOW USD HOOKS ============

export function useUsdBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowUsd,
    abi: SHADOW_USD_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useEncryptedUsdBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowUsd,
    abi: SHADOW_USD_ABI,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useConfidentialTransfer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const transfer = (
    to: `0x${string}`,
    encryptedAmount: `0x${string}`,
    inputProof: `0x${string}`
  ) => {
    writeContract({
      address: CONTRACTS.shadowUsd,
      abi: SHADOW_USD_ABI,
      functionName: "confidentialTransfer",
      args: [to, encryptedAmount, inputProof],
    });
  };

  return {
    transfer,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useConfidentialApprove() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = (
    spender: `0x${string}`,
    encryptedAmount: `0x${string}`,
    inputProof: `0x${string}`
  ) => {
    writeContract({
      address: CONTRACTS.shadowUsd,
      abi: SHADOW_USD_ABI,
      functionName: "confidentialApprove",
      args: [spender, encryptedAmount, inputProof],
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useApproveUsd() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = (spender: `0x${string}`, amount: bigint) => {
    writeContract({
      address: CONTRACTS.shadowUsd,
      abi: SHADOW_USD_ABI,
      functionName: "approve",
      args: [spender, amount],
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useFaucet() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claim = (amount: bigint = BigInt(10000 * 1e6)) => {
    writeContract({
      address: CONTRACTS.shadowUsd,
      abi: SHADOW_USD_ABI,
      functionName: "faucet",
      args: [amount],
    });
  };

  return {
    claim,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// ============ SHADOW VAULT HOOKS ============

export function useVaultBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowVault,
    abi: SHADOW_VAULT_ABI,
    functionName: "getBalance",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useUserPositions(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowVault,
    abi: SHADOW_VAULT_ABI,
    functionName: "getUserPositions",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function usePosition(positionId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowVault,
    abi: SHADOW_VAULT_ABI,
    functionName: "getPosition",
    args: positionId !== undefined ? [positionId] : undefined,
    query: {
      enabled: positionId !== undefined,
    },
  });
}

export function useDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = (encryptedAmount: `0x${string}`, inputProof: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.shadowVault,
      abi: SHADOW_VAULT_ABI,
      functionName: "deposit",
      args: [encryptedAmount, inputProof],
    });
  };

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useWithdraw() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = (encryptedAmount: `0x${string}`, inputProof: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.shadowVault,
      abi: SHADOW_VAULT_ABI,
      functionName: "withdraw",
      args: [encryptedAmount, inputProof],
    });
  };

  return {
    withdraw,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useOpenPosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const openPosition = (
    assetId: `0x${string}`,
    encryptedCollateral: `0x${string}`,
    encryptedLeverage: `0x${string}`,
    encryptedIsLong: `0x${string}`,
    inputProof: `0x${string}`
  ) => {
    writeContract({
      address: CONTRACTS.shadowVault,
      abi: SHADOW_VAULT_ABI,
      functionName: "openPosition",
      args: [assetId, encryptedCollateral, encryptedLeverage, encryptedIsLong, inputProof],
    });
  };

  return {
    openPosition,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useClosePosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const closePosition = (positionId: bigint) => {
    writeContract({
      address: CONTRACTS.shadowVault,
      abi: SHADOW_VAULT_ABI,
      functionName: "closePosition",
      args: [positionId],
    });
  };

  return {
    closePosition,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// ============ SHADOW ORACLE HOOKS ============

export function useAssetPrice(assetId: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowOracle,
    abi: SHADOW_ORACLE_ABI,
    functionName: "getCurrentPrice",
    args: assetId ? [assetId] : undefined,
    query: {
      enabled: !!assetId,
    },
  });
}

export function useAsset(assetId: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowOracle,
    abi: SHADOW_ORACLE_ABI,
    functionName: "getAsset",
    args: assetId ? [assetId] : undefined,
    query: {
      enabled: !!assetId,
    },
  });
}

export function useAllAssetIds() {
  return useReadContract({
    address: CONTRACTS.shadowOracle,
    abi: SHADOW_ORACLE_ABI,
    functionName: "getAllAssetIds",
  });
}

// ============ SHADOW LIQUIDITY POOL HOOKS ============

export function usePoolStats() {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "getPoolStats",
  });
}

export function useTotalLiquidity() {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "totalLiquidity",
  });
}

export function useCurrentEpoch() {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "currentEpoch",
  });
}

export function useCurrentApy() {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "getCurrentApy",
  });
}

export function useTimeUntilNextEpoch() {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "getTimeUntilNextEpoch",
  });
}

export function useLpBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "getLpBalance",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function usePendingRewards(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "getPendingRewards",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useTimeUntilUnlock(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "getTimeUntilUnlock",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useDepositTimestamp(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "depositTimestamp",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useLastClaimedEpoch(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.shadowLiquidityPool,
    abi: SHADOW_LIQUIDITY_POOL_ABI,
    functionName: "lastClaimedEpoch",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useAddLiquidity() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const addLiquidity = (amount: bigint) => {
    writeContract({
      address: CONTRACTS.shadowLiquidityPool,
      abi: SHADOW_LIQUIDITY_POOL_ABI,
      functionName: "addLiquidity",
      args: [amount],
    });
  };

  return {
    addLiquidity,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useRemoveLiquidity() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const removeLiquidity = (lpTokens: bigint) => {
    writeContract({
      address: CONTRACTS.shadowLiquidityPool,
      abi: SHADOW_LIQUIDITY_POOL_ABI,
      functionName: "removeLiquidity",
      args: [lpTokens],
    });
  };

  return {
    removeLiquidity,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useClaimRewards() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimRewards = (userLpTokens: bigint) => {
    writeContract({
      address: CONTRACTS.shadowLiquidityPool,
      abi: SHADOW_LIQUIDITY_POOL_ABI,
      functionName: "claimRewards",
      args: [userLpTokens],
    });
  };

  return {
    claimRewards,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useAdvanceEpoch() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const advanceEpoch = () => {
    writeContract({
      address: CONTRACTS.shadowLiquidityPool,
      abi: SHADOW_LIQUIDITY_POOL_ABI,
      functionName: "advanceEpoch",
    });
  };

  return {
    advanceEpoch,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// ============ SHADOW ORDER BOOK HOOKS ============

// Note: OrderBook contract address should be added to config when deployed
const ORDER_BOOK_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export function useOrderBookMarketStats(assetId: `0x${string}` | undefined) {
  return useReadContract({
    address: ORDER_BOOK_ADDRESS,
    abi: SHADOW_ORDER_BOOK_ABI,
    functionName: "getMarketStats",
    args: assetId ? [assetId] : undefined,
    query: {
      enabled: !!assetId && ORDER_BOOK_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });
}

export function useOrderBookEncryptedDepth(
  assetId: `0x${string}` | undefined,
  priceLevel: bigint | undefined
) {
  return useReadContract({
    address: ORDER_BOOK_ADDRESS,
    abi: SHADOW_ORDER_BOOK_ABI,
    functionName: "getEncryptedDepth",
    args: assetId && priceLevel !== undefined ? [assetId, priceLevel] : undefined,
    query: {
      enabled: !!assetId && priceLevel !== undefined && ORDER_BOOK_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });
}

export function useUserOrders(address: `0x${string}` | undefined) {
  return useReadContract({
    address: ORDER_BOOK_ADDRESS,
    abi: SHADOW_ORDER_BOOK_ABI,
    functionName: "getUserOrders",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && ORDER_BOOK_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });
}

export function usePlaceLimitOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const placeLimitOrder = (
    assetId: `0x${string}`,
    priceLevel: bigint,
    encryptedSize: `0x${string}`,
    orderType: number,
    inputProof: `0x${string}`
  ) => {
    writeContract({
      address: ORDER_BOOK_ADDRESS,
      abi: SHADOW_ORDER_BOOK_ABI,
      functionName: "placeLimitOrder",
      args: [assetId, priceLevel, encryptedSize, orderType, inputProof],
    });
  };

  return {
    placeLimitOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useCancelOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelOrder = (orderId: bigint) => {
    writeContract({
      address: ORDER_BOOK_ADDRESS,
      abi: SHADOW_ORDER_BOOK_ABI,
      functionName: "cancelOrder",
      args: [orderId],
    });
  };

  return {
    cancelOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
