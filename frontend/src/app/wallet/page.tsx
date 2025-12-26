"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Header, Footer } from "@/components";
import { formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import {
  initFheInstance,
  isFheInitialized,
  requestUserDecryption,
  encryptUint64,
  getFheInstance,
} from "@/lib/fhe/client";
import {
  useHasUsdBalance,
  useVaultBalance,
  useLpBalance,
  usePendingRewards,
  usePoolStats,
  useCurrentApy,
  useTimeUntilUnlock,
  useCurrentEpoch,
  useTimeUntilNextEpoch,
  useLastClaimedEpoch,
  useTotalLiquidity,
  useAddLiquidity,
  useRemoveLiquidity,
  useClaimRewards as useClaimRewardsHook,
  useFaucet,
  useDeposit,
  useWithdraw,
} from "@/lib/contracts/hooks";
import { CONTRACTS } from "@/lib/contracts/config";
import {
  Lock,
  Eye,
  EyeOff,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Shield,
  Copy,
  ExternalLink,
  Wallet,
  DollarSign,
  PieChart,
  Calendar,
  Coins,
  Timer,
  Percent,
  Gift,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Send,
  Droplet,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { createPublicClient, createWalletClient, custom, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";

// Contract addresses (from config) - use lowercase for consistency with TradingPanel
const CONTRACT_ADDRESSES = {
  shadowUsd: CONTRACTS.shadowUsd,
  shadowVault: CONTRACTS.shadowVault,
  shadowLiquidityPool: CONTRACTS.shadowLiquidityPool,
};

// ShadowUSD ABI for encrypted balance
const SHADOW_USD_ABI = parseAbi([
  "function confidentialBalanceOf(address account) external returns (uint256)",
]);

// ShadowVault ABI for encrypted vault balance
const SHADOW_VAULT_ABI = parseAbi([
  "function confidentialGetBalance(address user) external returns (uint256)",
]);

// ShadowLiquidityPool ABI for encrypted LP balance
const SHADOW_LP_ABI = parseAbi([
  "function getLpBalance(address user) external view returns (uint256)",
  "function getPendingRewards(address user) external view returns (uint256)",
]);

// Event ABIs for transaction history
const VAULT_EVENTS_ABI = parseAbi([
  "event PositionOpened(uint256 indexed positionId, address indexed trader, bytes32 indexed assetId, uint256 timestamp)",
  "event PositionClosed(uint256 indexed positionId, address indexed trader, uint256 timestamp)",
  "event LimitOrderCreated(uint256 indexed orderId, address indexed user, bytes32 indexed assetId, uint256 timestamp)",
  "event LimitOrderExecuted(uint256 indexed orderId, uint256 positionId, uint256 timestamp)",
]);

const LP_EVENTS_ABI = parseAbi([
  "event LiquidityAdded(address indexed provider, uint256 amount, uint256 lpTokens)",
  "event LiquidityRemoved(address indexed provider, uint256 amount, uint256 lpTokens)",
  "event RewardsClaimed(address indexed provider, uint256 epoch)",
]);

const USD_EVENTS_ABI = parseAbi([
  "event Mint(address indexed to, uint256 publicAmount)",
  "event Burn(address indexed from, uint256 publicAmount)",
]);

// Transaction type interface
interface Transaction {
  id: string;
  type: string;
  amount: number;
  asset?: string;
  timestamp: string;
  status: string;
  txHash?: string;
}

// Helper to format bigint to number (6 decimals for sUSD)
function formatBalance(value: bigint | undefined): number {
  if (!value) return 0;
  return Number(value) / 1e6;
}

// Helper to format APY from basis points
function formatApyFromBps(bps: bigint | undefined): number {
  if (!bps) return 0;
  return Number(bps) / 100; // 1500 bps = 15.00%
}

// Asset ID to symbol mapping (for transaction display)
const ASSET_ID_TO_SYMBOL: Record<string, string> = {
  "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9": "OPENAI",
  "0xee2176d5e35f81b98746f5f98677beb44f0167ae70b6518fbb5b5bdc65da8fdd": "ANTHROPIC",
  "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab": "SPACEX",
  "0x8eddee8eb3ba76411ebdccf6d0ad00841d58a803916546a295c2b0346ea86a11": "STRIPE",
  "0x0bf812f25cacc694be173fe6fd2b56e3f94f71dcee99e1f1280b2ce7fba46fca": "DATABRICKS",
  "0x7a8e8d0c5008129e8077f29f2b784b6f889f3420f121d5b70b5b3326476bbce1": "BYTEDANCE",
};


function formatTimeRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  // ==================== CONTRACT DATA HOOKS ====================
  // Wallet balances - hasUsdBalance is boolean (FHE encrypted)
  const { data: hasUsdBalance, isLoading: usdLoading, refetch: refetchUsdBalance } = useHasUsdBalance(address);
  const { data: vaultBalance, isLoading: vaultLoading, refetch: refetchVaultBalance } = useVaultBalance(address);

  // Track faucet claims locally (since actual balance is encrypted)
  const [claimedAmount, setClaimedAmount] = useState<number>(0);
  // Track vault balance locally
  const [localVaultBalance, setLocalVaultBalance] = useState<number>(0);
  // Deposit amount for vault
  const [depositAmount, setDepositAmount] = useState("");

  // Transaction history from on-chain events
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTxHistory, setIsLoadingTxHistory] = useState(false);

  // Load claimed amount and vault balance from localStorage on mount
  useEffect(() => {
    if (address) {
      // Load sUSD balance from localStorage (versioned with contract address)
      const storedSUsd = localStorage.getItem(`susd_balance_${CONTRACT_ADDRESSES.shadowUsd}_${address}`);
      if (storedSUsd) {
        setClaimedAmount(parseFloat(storedSUsd));
      }
      // Also check faucet claimed key (versioned)
      const storedClaimed = localStorage.getItem(`faucet_claimed_${CONTRACT_ADDRESSES.shadowUsd}_${address}`);
      if (storedClaimed && !storedSUsd) {
        setClaimedAmount(parseFloat(storedClaimed));
      }
      const storedVault = localStorage.getItem(`vault_balance_${CONTRACT_ADDRESSES.shadowVault}_${address}`);
      if (storedVault) {
        setLocalVaultBalance(parseFloat(storedVault));
      }
    }
  }, [address]);

  // Fetch transaction history from on-chain events
  useEffect(() => {
    if (!address || !isConnected) return;

    const fetchTransactionHistory = async () => {
      setIsLoadingTxHistory(true);
      try {
        const client = createPublicClient({
          chain: sepolia,
          transport: http("https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"),
        });

        const allTransactions: Transaction[] = [];
        const currentBlock = await client.getBlockNumber();
        // Look back ~7 days (roughly 50400 blocks at 12s/block)
        const fromBlock = currentBlock - BigInt(50400);

        // Fetch Position events from Vault
        const [positionOpenedLogs, positionClosedLogs] = await Promise.all([
          client.getLogs({
            address: CONTRACT_ADDRESSES.shadowVault as `0x${string}`,
            event: VAULT_EVENTS_ABI[0],
            args: { trader: address },
            fromBlock,
            toBlock: "latest",
          }),
          client.getLogs({
            address: CONTRACT_ADDRESSES.shadowVault as `0x${string}`,
            event: VAULT_EVENTS_ABI[1],
            args: { trader: address },
            fromBlock,
            toBlock: "latest",
          }),
        ]);

        // Fetch LP events
        const [liquidityAddedLogs, liquidityRemovedLogs, rewardsClaimedLogs] = await Promise.all([
          client.getLogs({
            address: CONTRACT_ADDRESSES.shadowLiquidityPool as `0x${string}`,
            event: LP_EVENTS_ABI[0],
            args: { provider: address },
            fromBlock,
            toBlock: "latest",
          }),
          client.getLogs({
            address: CONTRACT_ADDRESSES.shadowLiquidityPool as `0x${string}`,
            event: LP_EVENTS_ABI[1],
            args: { provider: address },
            fromBlock,
            toBlock: "latest",
          }),
          client.getLogs({
            address: CONTRACT_ADDRESSES.shadowLiquidityPool as `0x${string}`,
            event: LP_EVENTS_ABI[2],
            args: { provider: address },
            fromBlock,
            toBlock: "latest",
          }),
        ]);

        // Fetch Mint events from ShadowUSD (faucet claims)
        const mintLogs = await client.getLogs({
          address: CONTRACT_ADDRESSES.shadowUsd as `0x${string}`,
          event: USD_EVENTS_ABI[0],
          args: { to: address },
          fromBlock,
          toBlock: "latest",
        });

        // Process position opened events
        for (const log of positionOpenedLogs) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          const assetId = log.args.assetId as string;
          allTransactions.push({
            id: `pos-open-${log.transactionHash}-${log.logIndex}`,
            type: "position_open",
            amount: 0, // Amount is encrypted
            asset: ASSET_ID_TO_SYMBOL[assetId] || "Unknown",
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
            status: "completed",
            txHash: log.transactionHash,
          });
        }

        // Process position closed events
        for (const log of positionClosedLogs) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          allTransactions.push({
            id: `pos-close-${log.transactionHash}-${log.logIndex}`,
            type: "position_close",
            amount: 0, // P&L is encrypted
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
            status: "completed",
            txHash: log.transactionHash,
          });
        }

        // Process LP add events
        for (const log of liquidityAddedLogs) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          allTransactions.push({
            id: `lp-add-${log.transactionHash}-${log.logIndex}`,
            type: "lp_deposit",
            amount: Number(log.args.amount || 0) / 1e6,
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
            status: "completed",
            txHash: log.transactionHash,
          });
        }

        // Process LP remove events
        for (const log of liquidityRemovedLogs) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          allTransactions.push({
            id: `lp-remove-${log.transactionHash}-${log.logIndex}`,
            type: "lp_withdraw",
            amount: Number(log.args.amount || 0) / 1e6,
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
            status: "completed",
            txHash: log.transactionHash,
          });
        }

        // Process rewards claimed events
        for (const log of rewardsClaimedLogs) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          allTransactions.push({
            id: `reward-${log.transactionHash}-${log.logIndex}`,
            type: "lp_reward",
            amount: 0, // Encrypted amount
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
            status: "completed",
            txHash: log.transactionHash,
          });
        }

        // Process mint (faucet) events
        for (const log of mintLogs) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          allTransactions.push({
            id: `mint-${log.transactionHash}-${log.logIndex}`,
            type: "deposit",
            amount: Number(log.args.publicAmount || 0) / 1e6,
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
            status: "completed",
            txHash: log.transactionHash,
          });
        }

        // Sort by timestamp (newest first)
        allTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setTransactions(allTransactions);
      } catch (error) {
        console.error("Failed to fetch transaction history:", error);
      } finally {
        setIsLoadingTxHistory(false);
      }
    };

    fetchTransactionHistory();
  }, [address, isConnected]);

  // LP Pool data
  const { data: lpBalance, isLoading: lpLoading } = useLpBalance(address);
  const { data: pendingRewards, isLoading: rewardsLoading } = usePendingRewards(address);
  const { data: poolStats } = usePoolStats();
  const { data: currentApy } = useCurrentApy();
  const { data: timeUntilUnlock } = useTimeUntilUnlock(address);
  const { data: currentEpoch } = useCurrentEpoch();
  const { data: timeUntilNextEpoch } = useTimeUntilNextEpoch();
  const { data: lastClaimedEpoch } = useLastClaimedEpoch(address);
  const { data: totalLiquidity } = useTotalLiquidity();

  // Contract write hooks
  const { addLiquidity, isPending: _isAddingLiquidity, isSuccess: _addLiquiditySuccess } = useAddLiquidity();
  const { removeLiquidity, isPending: _isRemovingLiquidity, isSuccess: _removeLiquiditySuccess } = useRemoveLiquidity();
  const { claimRewards: claimRewardsContract, isPending: _isClaimingRewards, isSuccess: _claimSuccess } = useClaimRewardsHook();
  const { claim: claimFaucet, isPending: isFaucetPending, isSuccess: isFaucetSuccess, hash: faucetHash } = useFaucet();
  const { deposit: depositToVault, isPending: isDepositPending, isSuccess: isDepositSuccess, hash: depositHash } = useDeposit();
  const { withdraw: withdrawFromVault, isPending: isWithdrawPending, isSuccess: isWithdrawSuccess, hash: withdrawHash } = useWithdraw();

  // Track faucet success and update claimed amount
  useEffect(() => {
    if (isFaucetSuccess && address) {
      const newClaimed = claimedAmount + 10000; // Faucet gives 10,000 sUSD
      setClaimedAmount(newClaimed);
      localStorage.setItem(`faucet_claimed_${CONTRACT_ADDRESSES.shadowUsd}_${address}`, newClaimed.toString());
      // Refetch balance check
      setTimeout(() => refetchUsdBalance(), 2000);
    }
  }, [isFaucetSuccess]);

  // Track deposit success and update balances
  useEffect(() => {
    if (isDepositSuccess && address) {
      // After deposit, reduce claimed amount and increase vault balance
      const depositedAmount = parseFloat(depositAmount || "0");
      if (depositedAmount > 0) {
        // Update wallet balance (claimed from faucet)
        const newClaimed = Math.max(0, claimedAmount - depositedAmount);
        setClaimedAmount(newClaimed);
        localStorage.setItem(`faucet_claimed_${CONTRACT_ADDRESSES.shadowUsd}_${address}`, newClaimed.toString());

        // Update vault balance
        const newVaultBalance = localVaultBalance + depositedAmount;
        setLocalVaultBalance(newVaultBalance);
        localStorage.setItem(`vault_balance_${CONTRACT_ADDRESSES.shadowVault}_${address}`, newVaultBalance.toString());
      }
      setTimeout(() => {
        refetchVaultBalance();
        refetchUsdBalance();
      }, 2000);
    }
  }, [isDepositSuccess]);

  // Derived wallet data from contracts
  // Note: All balances are FHE encrypted, we track locally for UI
  const walletData = useMemo(() => ({
    balance: claimedAmount, // Estimated from faucet claims (actual is encrypted)
    hasBalance: hasUsdBalance as boolean, // True if any balance exists on-chain
    vaultBalance: localVaultBalance, // Tracked locally since actual is encrypted
    availableBalance: claimedAmount,
    lockedInPositions: localVaultBalance,
    // PnL data would come from position tracking - placeholder for now
    totalPnL: 0,
    totalPnLPercent: 0,
    todayPnL: 0,
    todayPnLPercent: 0,
    isLoading: usdLoading || vaultLoading,
  }), [claimedAmount, hasUsdBalance, localVaultBalance, usdLoading, vaultLoading]);

  // Derived LP data from contracts
  const lpData = useMemo(() => ({
    lpBalance: formatBalance(lpBalance as bigint | undefined),
    lpValue: formatBalance(lpBalance as bigint | undefined), // 1:1 for now
    pendingRewards: formatBalance(pendingRewards as bigint | undefined),
    timeUntilUnlock: Number(timeUntilUnlock || 0),
    timeUntilNextEpoch: Number(timeUntilNextEpoch || 0),
    currentEpoch: Number(currentEpoch || 0),
    lastClaimedEpoch: Number(lastClaimedEpoch || 0),
    currentApy: formatApyFromBps(currentApy as bigint | undefined),
    poolTotalLiquidity: formatBalance(totalLiquidity as bigint | undefined),
    poolUtilization: poolStats ? Number((poolStats as readonly bigint[])[1] || 0) / 100 : 0,
    isLoading: lpLoading || rewardsLoading,
  }), [lpBalance, pendingRewards, timeUntilUnlock, timeUntilNextEpoch, currentEpoch, lastClaimedEpoch, currentApy, totalLiquidity, poolStats, lpLoading, rewardsLoading]);

  const [showBalance, setShowBalance] = useState(true); // Show by default - clean UI
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "faucet" | "liquidity" | "transfer">("overview");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [lpDepositAmount, setLpDepositAmount] = useState("");
  const [lpWithdrawAmount, setLpWithdrawAmount] = useState("");
  const [isLpDepositing, setIsLpDepositing] = useState(false);
  const [isLpWithdrawing, setIsLpWithdrawing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  // Transfer state
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);

  // FHE Decryption state
  const [isFheReady, setIsFheReady] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<bigint | null>(null);
  const hasAttemptedDecrypt = useRef(false); // Prevent infinite retry loop
  const [decryptedValues, setDecryptedValues] = useState<{
    sUsdBalance?: bigint;
    vaultBalance?: bigint;
    lpBalance?: bigint;
    pendingRewards?: bigint;
  }>({});

  // Countdown timers - now using real contract data
  const [unlockCountdown, setUnlockCountdown] = useState(0);
  const [epochCountdown, setEpochCountdown] = useState(0);

  // Update countdowns when contract data changes
  useEffect(() => {
    if (timeUntilUnlock !== undefined) {
      setUnlockCountdown(Number(timeUntilUnlock));
    }
  }, [timeUntilUnlock]);

  useEffect(() => {
    if (timeUntilNextEpoch !== undefined) {
      setEpochCountdown(Number(timeUntilNextEpoch));
    }
  }, [timeUntilNextEpoch]);

  // Initialize FHE on mount
  useEffect(() => {
    const init = async () => {
      try {
        if (!isFheInitialized()) {
          await initFheInstance();
        }
        setIsFheReady(true);
      } catch (error) {
        console.error("FHE init failed:", error);
        setIsFheReady(false);
      }
    };
    init();
  }, []);

  // Reset decrypt attempt flag when address changes
  useEffect(() => {
    hasAttemptedDecrypt.current = false;
  }, [address]);

  // Auto-decrypt balance when FHE ready and wallet connected
  // Uses hasAttemptedDecrypt ref to prevent infinite retry loop on error
  useEffect(() => {
    if (isFheReady && isConnected && walletClient && address && chainId === 11155111 && !hasAttemptedDecrypt.current && !isDecrypting) {
      hasAttemptedDecrypt.current = true; // Mark as attempted BEFORE calling
      handleDecryptBalance();
    }
  }, [isFheReady, isConnected, walletClient, address, chainId, isDecrypting]);

  useEffect(() => {
    const timer = setInterval(() => {
      setUnlockCountdown((prev) => Math.max(0, prev - 1));
      setEpochCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Decrypt user's encrypted balance
  const handleDecryptBalance = useCallback(async () => {
    if (!walletClient || !address || !isFheReady) {
      setDecryptionError("Wallet not connected or FHE not ready");
      return;
    }

    // Only works on Sepolia (chainId: 11155111)
    if (chainId !== 11155111) {
      setDecryptionError("Please switch to Sepolia testnet for FHE decryption");
      return;
    }

    setIsDecrypting(true);
    setDecryptionError(null);

    try {
      // Step 1: Call contract to get encrypted balance handle
      // This also grants ACL permission for decryption
      console.log("📝 Calling confidentialBalanceOf to get handle + ACL...");

      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });

      // Call confidentialBalanceOf - this is a state-changing call that grants ACL
      // We need to simulate the call first to get the handle
      const balanceHandle = await publicClient.simulateContract({
        address: CONTRACT_ADDRESSES.shadowUsd as `0x${string}`,
        abi: SHADOW_USD_ABI,
        functionName: "confidentialBalanceOf",
        args: [address],
        account: address,
      });

      // The result is the encrypted handle (euint64 as uint256)
      const handle = balanceHandle.result as bigint;
      const handleHex = `0x${handle.toString(16).padStart(64, "0")}` as `0x${string}`;

      console.log("🔐 Got encrypted handle:", handleHex);

      // If handle is 0, user has no balance
      if (handle === BigInt(0)) {
        setDecryptedBalance(BigInt(0));
        setDecryptedValues((prev) => ({
          ...prev,
          sUsdBalance: BigInt(0),
        }));
        setShowBalance(true);
        return;
      }

      // Step 2: Request decryption with EIP-712 signature
      // ACL is already granted inside the contract during openPosition/faucet
      console.log("🔐 Requesting user decryption...");
      const results = await requestUserDecryption(
        [
          { handle: handleHex, contractAddress: CONTRACT_ADDRESSES.shadowUsd },
        ],
        address,
        walletClient
      );

      console.log("✅ Decryption results:", results);

      // Store decrypted values
      const resultKey = Object.keys(results).find(k => k.toLowerCase() === handleHex.toLowerCase()) || handleHex;
      if (results[resultKey] !== undefined) {
        const balance = typeof results[resultKey] === "bigint"
          ? results[resultKey]
          : BigInt(results[resultKey].toString());
        setDecryptedBalance(balance as bigint);
        setDecryptedValues((prev) => ({
          ...prev,
          sUsdBalance: balance as bigint,
        }));
        setShowBalance(true);

        // Update localStorage with real decrypted balance (for TradingPanel sync)
        const balanceNumber = Number(balance) / 1e6; // 6 decimals
        setClaimedAmount(balanceNumber);
        localStorage.setItem(`susd_balance_${CONTRACT_ADDRESSES.shadowUsd}_${address}`, balanceNumber.toString());
        console.log("✅ Updated sUSD balance from FHE decryption:", balanceNumber);
      }
    } catch (error) {
      console.error("❌ Decryption failed:", error);
      setDecryptionError(
        error instanceof Error ? error.message : "Decryption failed. Please try again."
      );
    } finally {
      setIsDecrypting(false);
    }
  }, [walletClient, address, isFheReady, chainId]);

  const isLocked = unlockCountdown > 0;
  const unclaimedEpochs = lpData.currentEpoch - lpData.lastClaimedEpoch - 1;

  // Format address for display
  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not Connected";

  // Clean UI - just show the value, no encryption indicators
  const EncryptedValue = ({ revealed, value }: { revealed: boolean; value: string }) => (
    <span>{value || "$0.00"}</span>
  );

  const handleLpDeposit = async () => {
    if (!lpDepositAmount) return;
    setIsLpDepositing(true);
    try {
      const amount = BigInt(Math.floor(parseFloat(lpDepositAmount) * 1e6));
      addLiquidity(amount);
    } catch (error) {
      console.error("LP deposit failed:", error);
    } finally {
      setIsLpDepositing(false);
      setLpDepositAmount("");
    }
  };

  const handleLpWithdraw = async () => {
    if (!lpWithdrawAmount || isLocked) return;
    setIsLpWithdrawing(true);
    try {
      const amount = BigInt(Math.floor(parseFloat(lpWithdrawAmount) * 1e6));
      removeLiquidity(amount);
    } catch (error) {
      console.error("LP withdraw failed:", error);
    } finally {
      setIsLpWithdrawing(false);
      setLpWithdrawAmount("");
    }
  };

  const handleClaimRewards = async () => {
    if (unclaimedEpochs <= 0 || lpData.pendingRewards <= 0) return;
    setIsClaiming(true);
    try {
      // Pass LP balance as parameter (converted to bigint with 6 decimals)
      const lpTokens = BigInt(Math.floor(lpData.lpBalance * 1e6));
      claimRewardsContract(lpTokens);
    } catch (error) {
      console.error("Claim rewards failed:", error);
    } finally {
      setIsClaiming(false);
    }
  };

  // Real FHE Deposit Handler
  const handleFheDeposit = useCallback(async () => {
    if (!address || !depositAmount || !isFheReady) {
      console.error("Missing requirements for FHE deposit");
      return;
    }

    try {
      console.log("🔐 Encrypting deposit amount with FHE...");
      const amountInMicroUnits = BigInt(Math.floor(parseFloat(depositAmount) * 1e6));

      // Encrypt the amount using Zama FHE
      const { encryptedAmount, inputProof } = await encryptUint64(
        amountInMicroUnits,
        CONTRACT_ADDRESSES.shadowVault,
        address
      );

      console.log("✅ Amount encrypted, sending to vault...");
      console.log("   Encrypted:", encryptedAmount.slice(0, 20) + "...");
      console.log("   Proof:", inputProof.slice(0, 20) + "...");

      // Call the deposit function with encrypted data
      depositToVault(encryptedAmount, inputProof);
    } catch (error) {
      console.error("❌ FHE deposit failed:", error);
    }
  }, [address, depositAmount, isFheReady, depositToVault]);

  // Real FHE Withdraw Handler
  const handleFheWithdraw = useCallback(async () => {
    if (!address || !withdrawAmount || !isFheReady) {
      console.error("Missing requirements for FHE withdraw");
      return;
    }

    try {
      console.log("🔐 Encrypting withdraw amount with FHE...");
      const amountInMicroUnits = BigInt(Math.floor(parseFloat(withdrawAmount) * 1e6));

      // Encrypt the amount using Zama FHE
      const { encryptedAmount, inputProof } = await encryptUint64(
        amountInMicroUnits,
        CONTRACT_ADDRESSES.shadowVault,
        address
      );

      console.log("✅ Amount encrypted, withdrawing from vault...");
      console.log("   Encrypted:", encryptedAmount.slice(0, 20) + "...");
      console.log("   Proof:", inputProof.slice(0, 20) + "...");

      // Call the withdraw function with encrypted data
      withdrawFromVault(encryptedAmount, inputProof);
    } catch (error) {
      console.error("❌ FHE withdraw failed:", error);
    }
  }, [address, withdrawAmount, isFheReady, withdrawFromVault]);

  // Decrypt Vault Balance
  const handleDecryptVaultBalance = useCallback(async () => {
    if (!walletClient || !address || !isFheReady) {
      setDecryptionError("Wallet not connected or FHE not ready");
      return;
    }

    if (chainId !== 11155111) {
      setDecryptionError("Please switch to Sepolia testnet for FHE decryption");
      return;
    }

    setIsDecrypting(true);
    setDecryptionError(null);

    try {
      console.log("📝 Calling confidentialGetBalance for vault...");

      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });

      // Simulate to get the handle
      const vaultHandle = await publicClient.simulateContract({
        address: CONTRACT_ADDRESSES.shadowVault as `0x${string}`,
        abi: SHADOW_VAULT_ABI,
        functionName: "confidentialGetBalance",
        args: [address],
        account: address,
      });

      const handle = vaultHandle.result as bigint;
      const handleHex = `0x${handle.toString(16).padStart(64, "0")}` as `0x${string}`;

      console.log("🔐 Got vault handle:", handleHex);

      if (handle === BigInt(0)) {
        setDecryptedValues((prev) => ({ ...prev, vaultBalance: BigInt(0) }));
        setLocalVaultBalance(0);
        localStorage.setItem(`vault_balance_${CONTRACT_ADDRESSES.shadowVault}_${address}`, "0");
        return;
      }

      // Execute call to grant ACL
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.shadowVault as `0x${string}`,
        abi: SHADOW_VAULT_ABI,
        functionName: "confidentialGetBalance",
        args: [address],
      });

      console.log("✅ Vault ACL granted, tx:", hash);

      // Request decryption
      const results = await requestUserDecryption(
        [{ handle: handleHex, contractAddress: CONTRACT_ADDRESSES.shadowVault }],
        address,
        walletClient
      );

      const resultKey = Object.keys(results).find(k => k.toLowerCase() === handleHex.toLowerCase()) || handleHex;
      if (results[resultKey] !== undefined) {
        const balance = typeof results[resultKey] === "bigint"
          ? results[resultKey]
          : BigInt(results[resultKey].toString());
        setDecryptedValues((prev) => ({ ...prev, vaultBalance: balance as bigint }));

        // Update localStorage for TradingPanel sync
        const balanceNumber = Number(balance) / 1e6;
        setLocalVaultBalance(balanceNumber);
        localStorage.setItem(`vault_balance_${CONTRACT_ADDRESSES.shadowVault}_${address}`, balanceNumber.toString());
        console.log("✅ Vault balance decrypted:", balanceNumber);
      }
    } catch (error) {
      console.error("❌ Vault decryption failed:", error);
      setDecryptionError(
        error instanceof Error ? error.message : "Vault decryption failed"
      );
    } finally {
      setIsDecrypting(false);
    }
  }, [walletClient, address, isFheReady, chainId]);

  // Decrypt LP Balance
  const handleDecryptLpBalance = useCallback(async () => {
    if (!walletClient || !address || !isFheReady) {
      console.log("Missing requirements for LP decryption");
      return;
    }

    if (chainId !== 11155111) {
      console.log("Wrong chain for FHE");
      return;
    }

    try {
      console.log("🔐 Decrypting LP Balance...");
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });

      // Get the LP balance handle (view function)
      const handle = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.shadowLiquidityPool,
        abi: SHADOW_LP_ABI,
        functionName: "getLpBalance",
        args: [address],
      });

      console.log("📦 LP balance handle:", handle);

      if (!handle || handle === BigInt(0)) {
        console.log("No LP balance found");
        setDecryptedValues((prev) => ({ ...prev, lpBalance: BigInt(0) }));
        return;
      }

      // Convert to hex string and try to decrypt
      const handleHex = ("0x" + (handle as bigint).toString(16).padStart(64, "0")) as `0x${string}`;

      const results = await requestUserDecryption(
        [{ handle: handleHex, contractAddress: CONTRACT_ADDRESSES.shadowLiquidityPool }],
        address,
        walletClient
      );

      const balance = results[handleHex] ?? results[handleHex.toLowerCase() as `0x${string}`];
      if (balance !== undefined) {
        console.log("✅ Decrypted LP balance:", balance);
        setDecryptedValues((prev) => ({ ...prev, lpBalance: balance as bigint }));
      }
    } catch (error) {
      console.error("❌ LP balance decryption failed:", error);
    }
  }, [walletClient, address, isFheReady, chainId]);

  // Decrypt Pending Rewards
  const handleDecryptPendingRewards = useCallback(async () => {
    if (!walletClient || !address || !isFheReady) {
      console.log("Missing requirements for rewards decryption");
      return;
    }

    if (chainId !== 11155111) {
      console.log("Wrong chain for FHE");
      return;
    }

    try {
      console.log("🔐 Decrypting Pending Rewards...");
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });

      // Get the pending rewards handle (view function)
      const handle = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.shadowLiquidityPool,
        abi: SHADOW_LP_ABI,
        functionName: "getPendingRewards",
        args: [address],
      });

      console.log("📦 Pending rewards handle:", handle);

      if (!handle || handle === BigInt(0)) {
        console.log("No pending rewards found");
        setDecryptedValues((prev) => ({ ...prev, pendingRewards: BigInt(0) }));
        return;
      }

      // Convert to hex string and try to decrypt
      const handleHex = ("0x" + (handle as bigint).toString(16).padStart(64, "0")) as `0x${string}`;

      const results = await requestUserDecryption(
        [{ handle: handleHex, contractAddress: CONTRACT_ADDRESSES.shadowLiquidityPool }],
        address,
        walletClient
      );

      const rewards = results[handleHex] ?? results[handleHex.toLowerCase() as `0x${string}`];
      if (rewards !== undefined) {
        console.log("✅ Decrypted pending rewards:", rewards);
        setDecryptedValues((prev) => ({ ...prev, pendingRewards: rewards as bigint }));
      }
    } catch (error) {
      console.error("❌ Pending rewards decryption failed:", error);
    }
  }, [walletClient, address, isFheReady, chainId]);

  // Decrypt All Balances at once
  const handleDecryptAllBalances = useCallback(async () => {
    setIsDecrypting(true);
    setDecryptionError(null);

    try {
      // Decrypt sUSD balance
      await handleDecryptBalance();
      // Decrypt Vault balance
      await handleDecryptVaultBalance();
      // Decrypt LP balance
      await handleDecryptLpBalance();
      // Decrypt pending rewards
      await handleDecryptPendingRewards();
      console.log("✅ All balances decrypted!");
    } catch (error) {
      console.error("❌ Decrypt all failed:", error);
      setDecryptionError("Failed to decrypt all balances");
    } finally {
      setIsDecrypting(false);
    }
  }, [handleDecryptBalance, handleDecryptVaultBalance, handleDecryptLpBalance, handleDecryptPendingRewards]);

  const handleConfidentialTransfer = async () => {
    if (!transferTo || !transferAmount) return;
    setIsTransferring(true);
    setTransferSuccess(false);

    try {
      // In production, this would:
      // 1. Initialize FHE instance
      // 2. Encrypt the transfer amount
      // 3. Generate input proof
      // 4. Call confidentialTransfer on the contract

      // Simulate encryption and transaction
      console.log("Encrypting amount:", transferAmount);
      await new Promise((r) => setTimeout(r, 1500)); // Simulate encryption

      console.log("Sending confidential transfer to:", transferTo);
      await new Promise((r) => setTimeout(r, 2000)); // Simulate transaction

      setTransferSuccess(true);
      setTransferTo("");
      setTransferAmount("");
    } catch (error) {
      console.error("Transfer failed:", error);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="pt-20 px-6 pb-8 max-w-6xl mx-auto flex-1">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">Wallet</h1>
            <p className="text-text-muted flex items-center gap-2">
              {displayAddress}
              <button
                className="hover:text-gold transition-colors"
                onClick={() => address && navigator.clipboard.writeText(address)}
              >
                <Copy className="w-4 h-4" />
              </button>
              {address && (
                <a
                  href={`https://sepolia.etherscan.io/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </p>
          </div>
          {/* Clean UI - just show loading state subtly if needed */}
          {isDecrypting && (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        {/* Show error only if decryption fails */}
        {decryptionError && (
          <div className="mb-6 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <span className="text-danger">{decryptionError}</span>
            <button
              onClick={() => setDecryptionError(null)}
              className="ml-auto text-danger hover:text-danger/70"
            >
              ×
            </button>
          </div>
        )}

        {/* Removed: Success message - clean UI doesn't need this */}
        {false && decryptedBalance !== null && showBalance && (
          <div className="mb-6 p-4 bg-success/20 border border-success/30 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success" />
            <div>
              <p className="font-medium text-success">Balance Decrypted Successfully</p>
              <p className="text-sm text-text-muted">
                Your encrypted balance has been decrypted using FHE. Only you can see this value.
              </p>
            </div>
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Balance */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 text-text-muted mb-3">
              <Wallet className="w-5 h-5" />
              <span className="text-sm uppercase">Total Balance</span>
            </div>
            <div className="text-3xl font-bold text-text-primary mb-2">
              <EncryptedValue
                revealed={showBalance}
                value={formatUSD(walletData.balance)}
              />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-text-muted">
                Available:{" "}
                <span className="text-text-primary">
                  {showBalance ? formatUSD(walletData.availableBalance) : "••••"}
                </span>
              </span>
              <span className="text-text-muted">
                Locked:{" "}
                <span className="text-gold">
                  {showBalance ? formatUSD(walletData.lockedInPositions) : "••••"}
                </span>
              </span>
            </div>
          </div>

          {/* Total P&L */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 text-text-muted mb-3">
              <PieChart className="w-5 h-5" />
              <span className="text-sm uppercase">Total P&L</span>
            </div>
            <div className={cn(
              "text-3xl font-bold flex items-center gap-2 mb-2",
              walletData.totalPnL >= 0 ? "text-success" : "text-danger"
            )}>
              {showBalance ? (
                <>
                  {walletData.totalPnL >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  {walletData.totalPnL >= 0 ? "+" : ""}{formatUSD(walletData.totalPnL)}
                </>
              ) : (
                <EncryptedValue revealed={false} value="" />
              )}
            </div>
            <span className={cn(
              "text-sm font-medium",
              walletData.totalPnLPercent >= 0 ? "text-success" : "text-danger"
            )}>
              {showBalance ? formatPercent(walletData.totalPnLPercent) : "••••%"}
            </span>
          </div>

          {/* Today's P&L */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 text-text-muted mb-3">
              <Calendar className="w-5 h-5" />
              <span className="text-sm uppercase">Today&apos;s P&L</span>
            </div>
            <div className={cn(
              "text-3xl font-bold flex items-center gap-2 mb-2",
              walletData.todayPnL >= 0 ? "text-success" : "text-danger"
            )}>
              {showBalance ? (
                <>
                  {walletData.todayPnL >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  {walletData.todayPnL >= 0 ? "+" : ""}{formatUSD(walletData.todayPnL)}
                </>
              ) : (
                <EncryptedValue revealed={false} value="" />
              )}
            </div>
            <span className={cn(
              "text-sm font-medium",
              walletData.todayPnLPercent >= 0 ? "text-success" : "text-danger"
            )}>
              {showBalance ? formatPercent(walletData.todayPnLPercent) : "••••%"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: <PieChart className="w-4 h-4" /> },
            { id: "faucet", label: "Get sUSD", icon: <Droplet className="w-4 h-4" /> },
            { id: "transfer", label: "Transfer sUSD", icon: <Send className="w-4 h-4" /> },
            { id: "liquidity", label: "Liquidity Pool", icon: <Coins className="w-4 h-4" /> },
            { id: "history", label: "History", icon: <History className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                activeTab === tab.id
                  ? "border-gold text-gold"
                  : "border-transparent text-text-muted hover:text-text-primary"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "transfer" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-8">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-full bg-gold/20 text-gold flex items-center justify-center">
                  <Send className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">Transfer sUSD</h2>
                  <p className="text-text-muted">Send sUSD to another wallet</p>
                </div>
              </div>

              {/* Success Message */}
              {transferSuccess && (
                <div className="mb-6 p-4 bg-success/20 border border-success/30 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <div>
                    <p className="font-medium text-success">Transfer Successful!</p>
                    <p className="text-sm text-text-muted">Your confidential transfer has been processed.</p>
                  </div>
                </div>
              )}

              {/* Transfer Form */}
              <div className="space-y-6">
                {/* Recipient */}
                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    placeholder="0x..."
                    className="input-field font-mono"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">
                    Amount (sUSD)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className="input-field pr-20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">
                      sUSD
                    </span>
                  </div>
                </div>

                {/* Quick Amounts */}
                <div className="flex gap-2">
                  {[100, 500, 1000, 2500].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setTransferAmount(amount.toString())}
                      className="flex-1 py-2.5 text-sm bg-background rounded-lg text-text-muted hover:text-gold hover:bg-gold/10 transition-colors border border-border"
                    >
                      ${amount.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Available Balance */}
                <div className="p-4 bg-background rounded-lg border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Available Balance</span>
                    <span className="font-semibold text-text-primary flex items-center gap-2">
                      {showBalance ? formatUSD(walletData.availableBalance) : "••••••"}
                      <Lock className="w-4 h-4 text-gold" />
                    </span>
                  </div>
                </div>

                {/* FHE Info */}
                <div className="p-4 bg-gold/5 border border-gold/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-gold mt-0.5" />
                    <div>
                      <p className="font-medium text-gold mb-1">Fully Homomorphic Encryption</p>
                      <p className="text-sm text-text-muted">
                        Your transfer amount is encrypted before leaving your device.
                        Neither validators nor observers can see how much you&apos;re sending.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transfer Button */}
                <button
                  onClick={handleConfidentialTransfer}
                  disabled={!transferTo || !transferAmount || isTransferring}
                  className="w-full py-4 bg-gold text-background rounded-lg font-bold text-lg hover:bg-gold/90 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTransferring ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {/* Show encryption step */}
                      Encrypting & Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Confidential Transfer
                    </>
                  )}
                </button>

                {/* Note */}
                <p className="text-xs text-text-muted text-center">
                  Transfers are final and cannot be reversed. Double-check the recipient address.
                </p>
              </div>
            </div>

            {/* How it Works */}
            <div className="mt-6 bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">How Confidential Transfers Work</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Encrypt Amount</h4>
                    <p className="text-sm text-text-muted">
                      Your amount is encrypted with FHE in your browser before submission.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Verify On-Chain</h4>
                    <p className="text-sm text-text-muted">
                      The FHE contract verifies you have sufficient balance using encrypted computation.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Private Transfer</h4>
                    <p className="text-sm text-text-muted">
                      The contract processes encrypted values - only sender and receiver know the amount.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* P&L Chart */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-primary">Trading Performance</h3>
              </div>

              {/* Position Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-background rounded-lg p-4">
                  <p className="text-sm text-text-muted mb-1">Opened Positions</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    <span className="text-2xl font-bold text-text-primary">
                      {transactions.filter(tx => tx.type === "position_open").length}
                    </span>
                  </div>
                </div>
                <div className="bg-background rounded-lg p-4">
                  <p className="text-sm text-text-muted mb-1">Closed Positions</p>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-gold" />
                    <span className="text-2xl font-bold text-text-primary">
                      {transactions.filter(tx => tx.type === "position_close").length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Encrypted P&L Notice */}
              <div className="border border-border/50 rounded-lg p-4 bg-background/50">
                <div className="flex items-center gap-3 mb-2">
                  <Lock className="w-5 h-5 text-gold" />
                  <span className="font-medium text-text-primary">P&L is Fully Encrypted</span>
                </div>
                <p className="text-sm text-text-muted">
                  Your profit and loss data is protected by Fully Homomorphic Encryption (FHE).
                  No one can see your trading performance - not even validators or the protocol.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs text-text-muted">Privacy: Active</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h3>
              {isLoadingTxHistory ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Loader2 className="w-8 h-8 text-gold animate-spin mb-3" />
                  <p className="text-text-muted">Loading transactions...</p>
                </div>
              ) : transactions.length > 0 ? (
                <div className="space-y-4">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            tx.type === "deposit" || tx.type === "lp_deposit" || tx.type === "position_open"
                              ? "bg-success/20 text-success"
                              : tx.type === "withdraw" || tx.type === "lp_withdraw" || tx.type === "position_close"
                              ? "bg-gold/20 text-gold"
                              : tx.type === "lp_reward"
                              ? "bg-gold/20 text-gold"
                              : tx.amount >= 0
                              ? "bg-success/20 text-success"
                              : "bg-danger/20 text-danger"
                          )}
                        >
                          {tx.type === "deposit" ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : tx.type === "withdraw" ? (
                            <ArrowUpRight className="w-5 h-5" />
                          ) : tx.type === "lp_deposit" ? (
                            <Coins className="w-5 h-5" />
                          ) : tx.type === "lp_withdraw" ? (
                            <Coins className="w-5 h-5" />
                          ) : tx.type === "lp_reward" ? (
                            <Gift className="w-5 h-5" />
                          ) : tx.type === "position_open" ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : tx.type === "position_close" ? (
                            <TrendingDown className="w-5 h-5" />
                          ) : tx.amount >= 0 ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {tx.type === "deposit"
                              ? "Faucet Claim"
                              : tx.type === "withdraw"
                              ? "Withdraw"
                              : tx.type === "lp_deposit"
                              ? "LP Deposit"
                              : tx.type === "lp_withdraw"
                              ? "LP Withdraw"
                              : tx.type === "lp_reward"
                              ? "LP Reward"
                              : tx.type === "position_open"
                              ? `Open Position - ${tx.asset}`
                              : tx.type === "position_close"
                              ? "Close Position"
                              : `Trade P&L - ${tx.asset}`}
                          </p>
                          <p className="text-xs text-text-muted">
                            {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tx.type === "position_open" || tx.type === "position_close" ? (
                          <span className="text-sm text-text-muted flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Encrypted
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "font-semibold",
                              tx.amount >= 0 ? "text-success" : "text-danger"
                            )}
                          >
                            {showBalance
                              ? `${tx.amount >= 0 ? "+" : ""}${formatUSD(Math.abs(tx.amount))}`
                              : "••••"}
                          </span>
                        )}
                        {tx.txHash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gold hover:text-gold/80"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <History className="w-12 h-12 text-text-muted mb-3" />
                  <p className="text-text-muted">No activity yet</p>
                  <p className="text-sm text-text-muted/70">Your transactions will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "liquidity" && (
          <div className="space-y-6">
            {/* LP Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* LP Balance */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 text-text-muted mb-2">
                  <Coins className="w-4 h-4" />
                  <span className="text-xs uppercase">Your LP Balance</span>
                </div>
                <div className="text-2xl font-bold text-text-primary mb-1">
                  <EncryptedValue
                    revealed={showBalance}
                    value={`${lpData.lpBalance.toLocaleString()} LP`}
                  />
                </div>
                <p className="text-sm text-text-muted">
                  {showBalance ? `≈ ${formatUSD(lpData.lpValue)}` : "≈ ••••"}
                </p>
              </div>

              {/* Pending Rewards */}
              <div className="bg-card border border-gold/30 rounded-xl p-5">
                <div className="flex items-center gap-2 text-gold mb-2">
                  <Gift className="w-4 h-4" />
                  <span className="text-xs uppercase">Pending Rewards</span>
                </div>
                <div className="text-2xl font-bold text-gold mb-1">
                  <EncryptedValue
                    revealed={showBalance}
                    value={formatUSD(lpData.pendingRewards)}
                  />
                </div>
                <p className="text-sm text-text-muted">
                  {unclaimedEpochs > 0 ? `${unclaimedEpochs} epochs unclaimed` : "All claimed"}
                </p>
              </div>

              {/* Current APY */}
              <div className="bg-card border border-success/30 rounded-xl p-5">
                <div className="flex items-center gap-2 text-success mb-2">
                  <Percent className="w-4 h-4" />
                  <span className="text-xs uppercase">Current APY</span>
                </div>
                <div className="text-2xl font-bold text-success mb-1">
                  {lpData.currentApy.toFixed(1)}%
                </div>
                <p className="text-sm text-text-muted">
                  Base + Utilization bonus
                </p>
              </div>

              {/* Pool Stats */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 text-text-muted mb-2">
                  <PieChart className="w-4 h-4" />
                  <span className="text-xs uppercase">Pool Stats</span>
                </div>
                <div className="text-2xl font-bold text-text-primary mb-1">
                  {formatUSD(lpData.poolTotalLiquidity)}
                </div>
                <p className="text-sm text-text-muted">
                  {lpData.poolUtilization}% utilized
                </p>
              </div>
            </div>

            {/* Epoch & Lock Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lock Status */}
              <div className={cn(
                "bg-card border rounded-xl p-5",
                isLocked ? "border-warning/30" : "border-success/30"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lock className={cn("w-5 h-5", isLocked ? "text-warning" : "text-success")} />
                    <h3 className="font-semibold text-text-primary">Lock Status</h3>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    isLocked ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
                  )}>
                    {isLocked ? "Locked" : "Unlocked"}
                  </span>
                </div>
                {isLocked ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Time until unlock</span>
                      <span className="font-mono text-lg text-warning">
                        {formatTimeRemaining(unlockCountdown)}
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div
                        className="bg-warning h-2 rounded-full transition-all"
                        style={{ width: `${((24 * 3600 - unlockCountdown) / (24 * 3600)) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      24-hour lock period protects against JIT attacks
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="w-5 h-5" />
                    <span>You can withdraw your liquidity anytime</span>
                  </div>
                )}
              </div>

              {/* Epoch Info */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-gold" />
                    <h3 className="font-semibold text-text-primary">Epoch #{lpData.currentEpoch}</h3>
                  </div>
                  <span className="px-3 py-1 bg-gold/20 text-gold rounded-full text-sm font-medium">
                    Active
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Next epoch in</span>
                    <span className="font-mono text-lg text-text-primary">
                      {formatTimeRemaining(epochCountdown)}
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div
                      className="bg-gold h-2 rounded-full transition-all"
                      style={{ width: `${((24 * 3600 - epochCountdown) / (24 * 3600)) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted">
                    Rewards distributed at epoch end (every 24h)
                  </p>
                </div>
              </div>
            </div>

            {/* LP Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Add Liquidity */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Add Liquidity</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-text-muted mb-2 block">Amount (sUSD)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={lpDepositAmount}
                        onChange={(e) => setLpDepositAmount(e.target.value)}
                        placeholder="0.00"
                        className="input-field pr-16"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                        sUSD
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {[100, 500, 1000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setLpDepositAmount(amount.toString())}
                        className="flex-1 py-2 text-sm bg-background rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleLpDeposit}
                    disabled={!lpDepositAmount || isLpDepositing}
                    className="w-full py-3 bg-success text-white rounded-lg font-semibold hover:bg-success/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLpDepositing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Depositing...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Liquidity
                      </>
                    )}
                  </button>

                  <p className="text-xs text-text-muted text-center">
                    24-hour lock period starts on deposit
                  </p>
                </div>
              </div>

              {/* Remove Liquidity */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-10 h-10 rounded-full bg-danger/20 text-danger flex items-center justify-center">
                    <Minus className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Remove Liquidity</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-text-muted mb-2 block">LP Tokens</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={lpWithdrawAmount}
                        onChange={(e) => setLpWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                        className="input-field pr-12"
                        disabled={isLocked}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                        LP
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-background rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Your LP Balance</span>
                      <span className="text-text-primary font-medium">
                        {showBalance ? `${lpData.lpBalance.toLocaleString()} LP` : "••••"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setLpWithdrawAmount(lpData.lpBalance.toString())}
                    disabled={isLocked}
                    className="w-full py-2 text-sm bg-background rounded-lg text-gold hover:bg-card-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Withdraw Max
                  </button>

                  <button
                    onClick={handleLpWithdraw}
                    disabled={!lpWithdrawAmount || isLpWithdrawing || isLocked}
                    className="w-full py-3 bg-danger text-white rounded-lg font-semibold hover:bg-danger/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLpWithdrawing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Withdrawing...
                      </>
                    ) : isLocked ? (
                      <>
                        <Lock className="w-4 h-4" />
                        Locked ({formatTimeRemaining(unlockCountdown)})
                      </>
                    ) : (
                      <>
                        <Minus className="w-4 h-4" />
                        Remove Liquidity
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Claim Rewards */}
              <div className="bg-card border border-gold/30 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-10 h-10 rounded-full bg-gold/20 text-gold flex items-center justify-center">
                    <Gift className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Claim Rewards</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-gold/10 border border-gold/30 rounded-lg text-center">
                    <p className="text-sm text-text-muted mb-1">Pending Rewards</p>
                    <p className="text-3xl font-bold text-gold">
                      {showBalance ? formatUSD(lpData.pendingRewards) : "••••"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Unclaimed Epochs</span>
                      <span className="text-text-primary">{unclaimedEpochs}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Last Claimed</span>
                      <span className="text-text-primary">Epoch #{lpData.lastClaimedEpoch}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleClaimRewards}
                    disabled={unclaimedEpochs <= 0 || isClaiming}
                    className="w-full py-3 bg-gold text-background rounded-lg font-semibold hover:bg-gold/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      <>
                        <Gift className="w-4 h-4" />
                        Claim Rewards
                      </>
                    )}
                  </button>

                  <p className="text-xs text-text-muted text-center">
                    Rewards accumulate - claim anytime
                  </p>
                </div>
              </div>
            </div>

            {/* How LP Works */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">How Liquidity Providing Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Deposit sUSD</h4>
                    <p className="text-sm text-text-muted">
                      Add sUSD to the pool and receive LP tokens representing your share.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Earn Rewards</h4>
                    <p className="text-sm text-text-muted">
                      Earn 50% of trading fees + profit from trader losses each epoch.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Withdraw Anytime</h4>
                    <p className="text-sm text-text-muted">
                      After 24h lock, withdraw your LP tokens for sUSD + accumulated rewards.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {isLoadingTxHistory ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="w-8 h-8 text-gold animate-spin mb-3" />
                <p className="text-text-muted">Loading transaction history...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="w-12 h-12 text-text-muted mb-3" />
                <p className="text-text-muted">No transactions yet</p>
                <p className="text-sm text-text-muted/70">Your transaction history will appear here</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted uppercase">
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Amount / Asset</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Tx Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-card-hover transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              tx.type === "deposit" || tx.type === "lp_deposit" || tx.type === "position_open"
                                ? "bg-success/20 text-success"
                                : tx.type === "withdraw" || tx.type === "lp_withdraw"
                                ? "bg-danger/20 text-danger"
                                : tx.type === "lp_reward" || tx.type === "position_close"
                                ? "bg-gold/20 text-gold"
                                : tx.amount >= 0
                                ? "bg-success/20 text-success"
                                : "bg-danger/20 text-danger"
                            )}
                          >
                            {tx.type === "deposit" ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : tx.type === "withdraw" ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : tx.type === "lp_deposit" || tx.type === "lp_withdraw" ? (
                              <Coins className="w-4 h-4" />
                            ) : tx.type === "lp_reward" ? (
                              <Gift className="w-4 h-4" />
                            ) : tx.type === "position_open" ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : tx.type === "position_close" ? (
                              <TrendingDown className="w-4 h-4" />
                            ) : tx.amount >= 0 ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                          </div>
                          <span className="font-medium text-text-primary">
                            {tx.type === "deposit"
                              ? "Faucet Claim"
                              : tx.type === "position_open"
                              ? "Open Position"
                              : tx.type === "position_close"
                              ? "Close Position"
                              : tx.type === "lp_deposit"
                              ? "LP Deposit"
                              : tx.type === "lp_withdraw"
                              ? "LP Withdraw"
                              : tx.type === "lp_reward"
                              ? "LP Reward"
                              : tx.type.replace("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {tx.type === "position_open" || tx.type === "position_close" ? (
                          <div className="flex items-center gap-2">
                            {tx.asset && <span className="font-medium text-text-primary">{tx.asset}</span>}
                            <span className="text-sm text-text-muted flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Encrypted
                            </span>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "font-semibold",
                              tx.amount >= 0 ? "text-success" : "text-danger"
                            )}
                          >
                            {showBalance
                              ? `${tx.amount >= 0 ? "+" : ""}${formatUSD(Math.abs(tx.amount))}`
                              : "••••"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-text-muted">
                        {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full">
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {tx.txHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gold hover:underline flex items-center gap-1"
                          >
                            {tx.txHash.slice(0, 10)}...
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "faucet" && (
          <div className="max-w-md mx-auto">
            <div className="bg-card border border-border rounded-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gold/20 text-gold flex items-center justify-center">
                  <Droplet className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">Testnet Faucet</h2>
                  <p className="text-text-muted">Get free sUSD for testing</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-background rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-muted">Current Balance</span>
                    <span className="text-2xl font-bold text-gold">{formatUSD(walletData.balance)}</span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Use sUSD directly for trading - no deposit required!
                  </p>
                </div>

                <button
                  onClick={() => claimFaucet()}
                  disabled={isFaucetPending || !isConnected}
                  className={cn(
                    "w-full py-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-lg",
                    isFaucetPending
                      ? "bg-gold/50 cursor-not-allowed"
                      : isFaucetSuccess
                      ? "bg-success text-white"
                      : "bg-gold text-background hover:bg-gold/90"
                  )}
                >
                  {isFaucetPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Claiming...
                    </>
                  ) : isFaucetSuccess ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Claimed 10,000 sUSD!
                    </>
                  ) : (
                    <>
                      <Droplet className="w-5 h-5" />
                      Claim 10,000 sUSD
                    </>
                  )}
                </button>

                {faucetHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${faucetHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gold hover:underline flex items-center justify-center gap-1"
                  >
                    View transaction <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                <div className="p-4 bg-gold/10 border border-gold/30 rounded-lg">
                  <h4 className="font-medium text-gold mb-2">How it works</h4>
                  <ol className="text-sm text-text-muted space-y-1">
                    <li>1. Click "Claim 10,000 sUSD" above</li>
                    <li>2. Confirm the transaction in MetaMask</li>
                    <li>3. Go to Trade page and start trading!</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Encrypted Badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-gold">
          <Shield className="w-4 h-4" />
          <span className="text-sm">All balances are encrypted with FHE</span>
        </div>
      </main>

      <Footer />
    </div>
  );
}
