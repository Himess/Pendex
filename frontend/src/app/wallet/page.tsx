"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Header, Footer } from "@/components";
import { formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import {
  initFheInstance,
  isFheInitialized,
  requestUserDecryption,
} from "@/lib/fhe/client";
import {
  useUsdBalance,
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
  Key,
  Unlock,
  Users,
  UserPlus,
  UserMinus,
  Trash2,
} from "lucide-react";
import { createPublicClient, createWalletClient, custom, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";

// Contract addresses (from config)
const CONTRACT_ADDRESSES = {
  shadowUSD: CONTRACTS.shadowUsd,
  shadowVault: CONTRACTS.shadowVault,
  shadowLiquidityPool: CONTRACTS.shadowLiquidityPool,
};

// ShadowUSD ABI for operator functions (ERC-7984) and encrypted balance
const SHADOW_USD_ABI = parseAbi([
  "function setOperator(address operator, bool approved) external",
  "function isOperator(address owner, address operator) external view returns (bool)",
  "function operatorTransfer(address from, address to, bytes32 encryptedAmount, bytes calldata inputProof) external returns (bool)",
  "function confidentialBalanceOf(address account) external returns (uint256)",
]);

// Operator interface
interface Operator {
  address: string;
  isActive: boolean;
  addedAt: number;
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

// Mock transaction history
const TRANSACTIONS = [
  {
    id: "1",
    type: "deposit",
    amount: 5000,
    timestamp: "2024-12-07 14:30",
    status: "completed",
    txHash: "0xabc...123",
  },
  {
    id: "2",
    type: "trade_pnl",
    amount: 285,
    asset: "OpenAI",
    timestamp: "2024-12-07 12:15",
    status: "completed",
  },
  {
    id: "3",
    type: "lp_deposit",
    amount: 5000,
    timestamp: "2024-12-07 10:00",
    status: "completed",
    txHash: "0xlp1...789",
  },
  {
    id: "4",
    type: "lp_reward",
    amount: 75.5,
    timestamp: "2024-12-06 00:00",
    status: "completed",
  },
  {
    id: "5",
    type: "trade_pnl",
    amount: -120,
    asset: "SpaceX",
    timestamp: "2024-12-06 18:45",
    status: "completed",
  },
];

// Mock P&L history
const PNL_HISTORY = [
  { date: "Dec 7", pnl: 345.2 },
  { date: "Dec 6", pnl: -120.5 },
  { date: "Dec 5", pnl: 520.8 },
  { date: "Dec 4", pnl: 180.3 },
  { date: "Dec 3", pnl: -85.2 },
  { date: "Dec 2", pnl: 410.6 },
  { date: "Dec 1", pnl: 296.4 },
];

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
  // Wallet balances
  const { data: usdBalance, isLoading: usdLoading } = useUsdBalance(address);
  const { data: vaultBalance, isLoading: vaultLoading } = useVaultBalance(address);

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

  // Derived wallet data from contracts
  const walletData = useMemo(() => ({
    balance: formatBalance(usdBalance as bigint | undefined),
    vaultBalance: formatBalance(vaultBalance as bigint | undefined),
    availableBalance: formatBalance(usdBalance as bigint | undefined),
    lockedInPositions: formatBalance(vaultBalance as bigint | undefined),
    // PnL data would come from position tracking - placeholder for now
    totalPnL: 0,
    totalPnLPercent: 0,
    todayPnL: 0,
    todayPnLPercent: 0,
    isLoading: usdLoading || vaultLoading,
  }), [usdBalance, vaultBalance, usdLoading, vaultLoading]);

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

  const [showBalance, setShowBalance] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "deposit" | "liquidity" | "transfer" | "decrypt" | "operators">("overview");
  const [depositAmount, setDepositAmount] = useState("");

  // Operator state (ERC-7984)
  const [operators, setOperators] = useState<Operator[]>([]);
  const [newOperatorAddress, setNewOperatorAddress] = useState("");
  const [isAddingOperator, setIsAddingOperator] = useState(false);
  const [isRemovingOperator, setIsRemovingOperator] = useState<string | null>(null);
  const [operatorError, setOperatorError] = useState<string | null>(null);
  const [operatorSuccess, setOperatorSuccess] = useState<string | null>(null);
  const [checkOperatorAddress, setCheckOperatorAddress] = useState("");
  const [checkOperatorResult, setCheckOperatorResult] = useState<boolean | null>(null);
  const [isCheckingOperator, setIsCheckingOperator] = useState(false);
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
        address: CONTRACT_ADDRESSES.shadowUSD as `0x${string}`,
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

      // Step 2: Actually execute the call to grant ACL (simulate doesn't change state)
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.shadowUSD as `0x${string}`,
        abi: SHADOW_USD_ABI,
        functionName: "confidentialBalanceOf",
        args: [address],
      });

      console.log("✅ ACL granted, tx:", hash);

      // Step 3: Request decryption with EIP-712 signature
      console.log("🔐 Requesting user decryption...");
      const results = await requestUserDecryption(
        [
          { handle: handleHex, contractAddress: CONTRACT_ADDRESSES.shadowUSD },
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

  const EncryptedValue = ({ revealed, value }: { revealed: boolean; value: string }) => (
    <span className="flex items-center gap-2">
      {revealed ? value : "••••••••"}
      <Lock className={cn("w-4 h-4", revealed ? "text-success" : "text-gold")} />
    </span>
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
      claimRewardsContract();
    } catch (error) {
      console.error("Claim rewards failed:", error);
    } finally {
      setIsClaiming(false);
    }
  };

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

  // ERC-7984 Operator Functions
  const handleAddOperator = async () => {
    if (!newOperatorAddress || !walletClient || !address) return;

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newOperatorAddress)) {
      setOperatorError("Invalid address format");
      return;
    }

    // Check if adding self
    if (newOperatorAddress.toLowerCase() === address.toLowerCase()) {
      setOperatorError("Cannot set yourself as operator");
      return;
    }

    setIsAddingOperator(true);
    setOperatorError(null);
    setOperatorSuccess(null);

    try {
      // Create wallet client for transaction
      const client = createWalletClient({
        chain: sepolia,
        transport: custom(walletClient.transport),
      });

      // Call setOperator(address, true)
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESSES.shadowUSD,
        abi: SHADOW_USD_ABI,
        functionName: "setOperator",
        args: [newOperatorAddress as `0x${string}`, true],
        account: address,
      });

      console.log("setOperator tx:", hash);

      // Add to local state
      setOperators((prev) => [
        ...prev,
        {
          address: newOperatorAddress,
          isActive: true,
          addedAt: Date.now(),
        },
      ]);

      setOperatorSuccess(`Operator added! Tx: ${hash.slice(0, 10)}...`);
      setNewOperatorAddress("");
    } catch (error) {
      console.error("Failed to add operator:", error);
      setOperatorError(error instanceof Error ? error.message : "Failed to add operator");
    } finally {
      setIsAddingOperator(false);
    }
  };

  const handleRemoveOperator = async (operatorAddress: string) => {
    if (!walletClient || !address) return;

    setIsRemovingOperator(operatorAddress);
    setOperatorError(null);
    setOperatorSuccess(null);

    try {
      const client = createWalletClient({
        chain: sepolia,
        transport: custom(walletClient.transport),
      });

      // Call setOperator(address, false)
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESSES.shadowUSD,
        abi: SHADOW_USD_ABI,
        functionName: "setOperator",
        args: [operatorAddress as `0x${string}`, false],
        account: address,
      });

      console.log("removeOperator tx:", hash);

      // Remove from local state
      setOperators((prev) => prev.filter((op) => op.address.toLowerCase() !== operatorAddress.toLowerCase()));

      setOperatorSuccess(`Operator removed! Tx: ${hash.slice(0, 10)}...`);
    } catch (error) {
      console.error("Failed to remove operator:", error);
      setOperatorError(error instanceof Error ? error.message : "Failed to remove operator");
    } finally {
      setIsRemovingOperator(null);
    }
  };

  const handleCheckOperator = async () => {
    if (!checkOperatorAddress || !address) return;

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(checkOperatorAddress)) {
      setOperatorError("Invalid address format");
      return;
    }

    setIsCheckingOperator(true);
    setCheckOperatorResult(null);
    setOperatorError(null);

    try {
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });

      // Call isOperator(owner, operator)
      const isOp = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.shadowUSD,
        abi: SHADOW_USD_ABI,
        functionName: "isOperator",
        args: [address, checkOperatorAddress as `0x${string}`],
      });

      setCheckOperatorResult(isOp as boolean);
    } catch (error) {
      console.error("Failed to check operator:", error);
      setOperatorError(error instanceof Error ? error.message : "Failed to check operator status");
    } finally {
      setIsCheckingOperator(false);
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
          <div className="flex items-center gap-3">
            {/* FHE Status Indicator */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
              isFheReady
                ? "bg-success/20 text-success"
                : "bg-warning/20 text-warning"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                isFheReady ? "bg-success animate-pulse" : "bg-warning"
              )} />
              {isFheReady ? "FHE Ready" : "FHE Loading..."}
            </div>

            {/* Decrypt Button - Real FHE Decryption */}
            <button
              onClick={handleDecryptBalance}
              disabled={!isConnected || !isFheReady || isDecrypting}
              className="flex items-center gap-2 px-4 py-2 bg-gold text-background rounded-lg font-medium hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Decrypting...
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  Decrypt Balance
                </>
              )}
            </button>

            {/* Toggle visibility (for already decrypted values) */}
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-text-muted rounded-lg font-medium hover:bg-card-hover transition-colors"
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showBalance ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Decryption Error */}
        {decryptionError && (
          <div className="mb-6 p-4 bg-danger/20 border border-danger/30 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <div>
              <p className="font-medium text-danger">Decryption Failed</p>
              <p className="text-sm text-text-muted">{decryptionError}</p>
            </div>
            <button
              onClick={() => setDecryptionError(null)}
              className="ml-auto text-danger hover:text-danger/70"
            >
              ×
            </button>
          </div>
        )}

        {/* Decrypted Balance Success */}
        {decryptedBalance !== null && showBalance && (
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
            { id: "decrypt", label: "Decrypt Balance", icon: <Key className="w-4 h-4" /> },
            { id: "transfer", label: "Transfer sUSD", icon: <Send className="w-4 h-4" /> },
            { id: "operators", label: "Operators", icon: <Users className="w-4 h-4" /> },
            { id: "liquidity", label: "Liquidity Pool", icon: <Coins className="w-4 h-4" /> },
            { id: "history", label: "History", icon: <History className="w-4 h-4" /> },
            { id: "deposit", label: "Deposit / Withdraw", icon: <DollarSign className="w-4 h-4" /> },
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
        {activeTab === "decrypt" && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-8">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-full bg-gold/20 text-gold flex items-center justify-center">
                  <Key className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">FHE User Decryption</h2>
                  <p className="text-text-muted">Decrypt your encrypted balance with your wallet signature</p>
                </div>
              </div>

              {/* Connection Status */}
              {!isConnected ? (
                <div className="p-6 bg-warning/10 border border-warning/30 rounded-lg text-center">
                  <Wallet className="w-12 h-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Wallet Not Connected</h3>
                  <p className="text-text-muted mb-4">
                    Please connect your wallet to decrypt your encrypted balance.
                  </p>
                </div>
              ) : chainId !== 11155111 ? (
                <div className="p-6 bg-warning/10 border border-warning/30 rounded-lg text-center">
                  <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Wrong Network</h3>
                  <p className="text-text-muted mb-4">
                    Please switch to <strong>Sepolia testnet</strong> to use FHE decryption.
                  </p>
                  <p className="text-xs text-text-muted">
                    Current chain ID: {chainId} | Required: 11155111 (Sepolia)
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* FHE Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={cn(
                      "p-4 rounded-lg border",
                      isFheReady
                        ? "bg-success/10 border-success/30"
                        : "bg-warning/10 border-warning/30"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          isFheReady ? "bg-success/20" : "bg-warning/20"
                        )}>
                          {isFheReady ? (
                            <CheckCircle className="w-5 h-5 text-success" />
                          ) : (
                            <Loader2 className="w-5 h-5 text-warning animate-spin" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">FHE SDK Status</p>
                          <p className={cn(
                            "text-sm",
                            isFheReady ? "text-success" : "text-warning"
                          )}>
                            {isFheReady ? "Ready" : "Initializing..."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border bg-card border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-gold" />
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">Connected Wallet</p>
                          <p className="text-sm text-text-muted font-mono">{displayAddress}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Decrypted Values */}
                  {decryptedBalance !== null && (
                    <div className="p-6 bg-success/10 border border-success/30 rounded-lg">
                      <h3 className="text-lg font-semibold text-success mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Decrypted Balance
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="flex justify-between items-center p-4 bg-background rounded-lg">
                          <span className="text-text-muted">sUSD Balance</span>
                          <span className="text-2xl font-bold text-text-primary font-mono">
                            ${(Number(decryptedBalance) / 1e6).toFixed(2)}
                          </span>
                        </div>
                        {decryptedValues.vaultBalance && (
                          <div className="flex justify-between items-center p-4 bg-background rounded-lg">
                            <span className="text-text-muted">Vault Collateral</span>
                            <span className="text-xl font-bold text-text-primary font-mono">
                              ${(Number(decryptedValues.vaultBalance) / 1e6).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Decrypt Button */}
                  <button
                    onClick={handleDecryptBalance}
                    disabled={!isFheReady || isDecrypting}
                    className="w-full py-4 bg-gold text-background rounded-lg font-bold text-lg hover:bg-gold/90 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDecrypting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Signing & Decrypting...
                      </>
                    ) : (
                      <>
                        <Unlock className="w-5 h-5" />
                        {decryptedBalance !== null ? "Refresh Decryption" : "Decrypt My Balance"}
                      </>
                    )}
                  </button>

                  {/* Decryption Error */}
                  {decryptionError && (
                    <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-danger mt-0.5" />
                        <div>
                          <p className="font-medium text-danger">Decryption Failed</p>
                          <p className="text-sm text-text-muted">{decryptionError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* How FHE Decryption Works */}
            <div className="mt-6 bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-gold" />
                How FHE User Decryption Works
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Generate Keypair</h4>
                    <p className="text-sm text-text-muted">
                      A temporary keypair is generated in your browser for re-encryption.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Sign EIP-712</h4>
                    <p className="text-sm text-text-muted">
                      You sign an EIP-712 message to authorize decryption access.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Re-Encrypt</h4>
                    <p className="text-sm text-text-muted">
                      The KMS re-encrypts your data under your temporary public key.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Decrypt Locally</h4>
                    <p className="text-sm text-text-muted">
                      Your browser decrypts the value locally - only you can see it.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-4 p-4 bg-gold/5 border border-gold/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gold mb-1">Privacy Guaranteed</p>
                  <p className="text-sm text-text-muted">
                    Your decrypted balance is <strong>never stored</strong> on any server or blockchain.
                    The decryption happens entirely in your browser. Validators and other users
                    cannot see your balance - only you can with your wallet signature.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "transfer" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-8">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-full bg-gold/20 text-gold flex items-center justify-center">
                  <Send className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">Confidential Transfer</h2>
                  <p className="text-text-muted">Send sUSD with FHE encryption - amount stays private</p>
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

        {activeTab === "operators" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-card border border-border rounded-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gold/20 text-gold flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">Operator Management</h2>
                  <p className="text-text-muted">ERC-7984: Authorize addresses to transfer on your behalf</p>
                </div>
              </div>

              {/* Connection Check */}
              {!isConnected ? (
                <div className="p-6 bg-warning/10 border border-warning/30 rounded-lg text-center">
                  <Wallet className="w-12 h-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Wallet Not Connected</h3>
                  <p className="text-text-muted">Connect your wallet to manage operators.</p>
                </div>
              ) : chainId !== 11155111 ? (
                <div className="p-6 bg-warning/10 border border-warning/30 rounded-lg text-center">
                  <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Wrong Network</h3>
                  <p className="text-text-muted">Please switch to <strong>Sepolia testnet</strong>.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Success/Error Messages */}
                  {operatorSuccess && (
                    <div className="p-4 bg-success/20 border border-success/30 rounded-lg flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <p className="text-success font-medium">{operatorSuccess}</p>
                      <button onClick={() => setOperatorSuccess(null)} className="ml-auto text-success hover:text-success/70">×</button>
                    </div>
                  )}
                  {operatorError && (
                    <div className="p-4 bg-danger/20 border border-danger/30 rounded-lg flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-danger" />
                      <p className="text-danger font-medium">{operatorError}</p>
                      <button onClick={() => setOperatorError(null)} className="ml-auto text-danger hover:text-danger/70">×</button>
                    </div>
                  )}

                  {/* Add New Operator */}
                  <div className="p-6 bg-background rounded-lg border border-border">
                    <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-gold" />
                      Add New Operator
                    </h3>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newOperatorAddress}
                        onChange={(e) => setNewOperatorAddress(e.target.value)}
                        placeholder="0x... operator address"
                        className="input-field flex-1 font-mono"
                      />
                      <button
                        onClick={handleAddOperator}
                        disabled={!newOperatorAddress || isAddingOperator}
                        className="px-6 py-3 bg-gold text-background rounded-lg font-semibold hover:bg-gold/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAddingOperator ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            Add Operator
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      Operators can transfer sUSD from your account without amount limits.
                    </p>
                  </div>

                  {/* Current Operators List */}
                  <div className="p-6 bg-background rounded-lg border border-border">
                    <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-gold" />
                      Your Operators ({operators.length})
                    </h3>
                    {operators.length === 0 ? (
                      <div className="text-center py-8 text-text-muted">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No operators added yet</p>
                        <p className="text-sm">Add an operator above to grant transfer permissions</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {operators.map((op) => (
                          <div
                            key={op.address}
                            className="flex items-center justify-between p-4 bg-card rounded-lg border border-border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                                <Users className="w-5 h-5 text-gold" />
                              </div>
                              <div>
                                <p className="font-mono text-text-primary">
                                  {op.address.slice(0, 10)}...{op.address.slice(-8)}
                                </p>
                                <p className="text-xs text-text-muted">
                                  Added: {new Date(op.addedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full">
                                Active
                              </span>
                              <button
                                onClick={() => handleRemoveOperator(op.address)}
                                disabled={isRemovingOperator === op.address}
                                className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {isRemovingOperator === op.address ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Check Operator Status */}
                  <div className="p-6 bg-background rounded-lg border border-border">
                    <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-gold" />
                      Check Operator Status
                    </h3>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={checkOperatorAddress}
                        onChange={(e) => {
                          setCheckOperatorAddress(e.target.value);
                          setCheckOperatorResult(null);
                        }}
                        placeholder="0x... address to check"
                        className="input-field flex-1 font-mono"
                      />
                      <button
                        onClick={handleCheckOperator}
                        disabled={!checkOperatorAddress || isCheckingOperator}
                        className="px-6 py-3 bg-card border border-border text-text-primary rounded-lg font-semibold hover:bg-card-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCheckingOperator ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            Check
                          </>
                        )}
                      </button>
                    </div>
                    {checkOperatorResult !== null && (
                      <div className={cn(
                        "mt-4 p-4 rounded-lg flex items-center gap-3",
                        checkOperatorResult
                          ? "bg-success/20 border border-success/30"
                          : "bg-danger/20 border border-danger/30"
                      )}>
                        {checkOperatorResult ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-success" />
                            <span className="text-success font-medium">This address IS an operator for your account</span>
                          </>
                        ) : (
                          <>
                            <UserMinus className="w-5 h-5 text-danger" />
                            <span className="text-danger font-medium">This address is NOT an operator</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* How Operators Work */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-gold" />
                How ERC-7984 Operators Work
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Grant Permission</h4>
                    <p className="text-sm text-text-muted">
                      Authorize an address as your operator using setOperator().
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Operator Transfers</h4>
                    <p className="text-sm text-text-muted">
                      Operators can call operatorTransfer() to move your encrypted funds.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Revoke Anytime</h4>
                    <p className="text-sm text-text-muted">
                      Remove operator access instantly by setting approved = false.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Use Cases */}
            <div className="bg-gold/5 border border-gold/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">Common Use Cases</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-gold mt-0.5" />
                  <div>
                    <h4 className="font-medium text-text-primary">Smart Contract Vaults</h4>
                    <p className="text-sm text-text-muted">
                      Allow DeFi protocols to manage your encrypted positions.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-gold mt-0.5" />
                  <div>
                    <h4 className="font-medium text-text-primary">Multi-Sig Wallets</h4>
                    <p className="text-sm text-text-muted">
                      Enable multi-signature control over confidential funds.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-gold mt-0.5" />
                  <div>
                    <h4 className="font-medium text-text-primary">Delegated Trading</h4>
                    <p className="text-sm text-text-muted">
                      Let trading bots or strategies operate on your behalf.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-gold mt-0.5" />
                  <div>
                    <h4 className="font-medium text-text-primary">Recovery Systems</h4>
                    <p className="text-sm text-text-muted">
                      Set up trusted addresses for account recovery.
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
              <h3 className="text-lg font-semibold text-text-primary mb-4">7-Day P&L History</h3>
              <div className="space-y-3">
                {PNL_HISTORY.map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">{day.date}</span>
                    <div className="flex-1 mx-4 h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          day.pnl >= 0 ? "bg-success" : "bg-danger"
                        )}
                        style={{
                          width: `${Math.min(Math.abs(day.pnl) / 6, 100)}%`,
                          marginLeft: day.pnl < 0 ? "auto" : 0,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium w-24 text-right",
                        day.pnl >= 0 ? "text-success" : "text-danger"
                      )}
                    >
                      {showBalance
                        ? `${day.pnl >= 0 ? "+" : ""}${formatUSD(day.pnl)}`
                        : "••••"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {TRANSACTIONS.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          tx.type === "deposit" || tx.type === "lp_deposit"
                            ? "bg-success/20 text-success"
                            : tx.type === "withdraw" || tx.type === "lp_withdraw"
                            ? "bg-danger/20 text-danger"
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
                        ) : tx.amount >= 0 ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : (
                          <TrendingDown className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {tx.type === "deposit"
                            ? "Deposit"
                            : tx.type === "withdraw"
                            ? "Withdraw"
                            : tx.type === "lp_deposit"
                            ? "LP Deposit"
                            : tx.type === "lp_withdraw"
                            ? "LP Withdraw"
                            : tx.type === "lp_reward"
                            ? "LP Reward"
                            : `Trade P&L - ${tx.asset}`}
                        </p>
                        <p className="text-xs text-text-muted">{tx.timestamp}</p>
                      </div>
                    </div>
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
                  </div>
                ))}
              </div>
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted uppercase">
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TRANSACTIONS.map((tx) => (
                  <tr key={tx.id} className="hover:bg-card-hover transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            tx.type === "deposit" || tx.type === "lp_deposit"
                              ? "bg-success/20 text-success"
                              : tx.type === "withdraw" || tx.type === "lp_withdraw"
                              ? "bg-danger/20 text-danger"
                              : tx.type === "lp_reward"
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
                          ) : tx.amount >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>
                        <span className="font-medium text-text-primary capitalize">
                          {tx.type === "trade_pnl" ? `Trade - ${tx.asset}` : tx.type.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4 text-text-muted">{tx.timestamp}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full">
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {tx.txHash ? (
                        <a
                          href="#"
                          className="text-gold hover:underline flex items-center gap-1"
                        >
                          {tx.txHash}
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
          </div>
        )}

        {activeTab === "deposit" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposit */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Deposit USDC</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-text-muted mb-2 block">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="input-field pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                      USDC
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {[100, 500, 1000, 5000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setDepositAmount(amount.toString())}
                      className="flex-1 py-2 text-sm bg-background rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>

                <button className="w-full py-3 bg-success text-white rounded-lg font-semibold hover:bg-success/90 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Deposit
                </button>

                <p className="text-xs text-text-muted text-center">
                  Deposits are processed instantly on Zama network
                </p>
              </div>
            </div>

            {/* Withdraw */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-full bg-danger/20 text-danger flex items-center justify-center">
                  <Minus className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Withdraw USDC</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-text-muted mb-2 block">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="input-field pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                      USDC
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-background rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Available</span>
                    <span className="text-text-primary font-medium">
                      {showBalance ? formatUSD(walletData.availableBalance) : "••••"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setWithdrawAmount(walletData.availableBalance.toString())}
                  className="w-full py-2 text-sm bg-background rounded-lg text-gold hover:bg-card-hover transition-colors"
                >
                  Withdraw Max
                </button>

                <button className="w-full py-3 bg-danger text-white rounded-lg font-semibold hover:bg-danger/90 transition-colors flex items-center justify-center gap-2">
                  <Minus className="w-4 h-4" />
                  Withdraw
                </button>

                <p className="text-xs text-text-muted text-center">
                  Withdrawals may take up to 24 hours to process
                </p>
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
