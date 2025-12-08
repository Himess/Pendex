"use client";

import { useState, useEffect } from "react";
import { Header, Footer } from "@/components";
import { formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

// Mock wallet data
const WALLET_DATA = {
  address: "0x1234...5678",
  balance: 12500.0,
  availableBalance: 8750.0,
  lockedInPositions: 3750.0,
  totalPnL: 2847.5,
  totalPnLPercent: 29.4,
  todayPnL: 345.2,
  todayPnLPercent: 2.8,
};

// Mock LP data
const LP_DATA = {
  lpBalance: 5000, // LP tokens
  lpValue: 5250, // sUSD value
  pendingRewards: 125.5,
  depositTimestamp: Date.now() - 20 * 60 * 60 * 1000, // 20 hours ago
  lastClaimedEpoch: 5,
  currentEpoch: 7,
  timeUntilUnlock: 4 * 60 * 60, // 4 hours
  timeUntilNextEpoch: 8 * 60 * 60, // 8 hours
  currentApy: 15.5, // 15.5% APY
  poolTotalLiquidity: 2500000,
  poolUtilization: 65,
};

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
  const [showBalance, setShowBalance] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "deposit" | "liquidity" | "transfer">("overview");
  const [depositAmount, setDepositAmount] = useState("");
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

  // Countdown timers
  const [unlockCountdown, setUnlockCountdown] = useState(LP_DATA.timeUntilUnlock);
  const [epochCountdown, setEpochCountdown] = useState(LP_DATA.timeUntilNextEpoch);

  useEffect(() => {
    const timer = setInterval(() => {
      setUnlockCountdown((prev) => Math.max(0, prev - 1));
      setEpochCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isLocked = unlockCountdown > 0;
  const unclaimedEpochs = LP_DATA.currentEpoch - LP_DATA.lastClaimedEpoch - 1;

  const EncryptedValue = ({ revealed, value }: { revealed: boolean; value: string }) => (
    <span className="flex items-center gap-2">
      {revealed ? value : "••••••••"}
      <Lock className={cn("w-4 h-4", revealed ? "text-success" : "text-gold")} />
    </span>
  );

  const handleLpDeposit = async () => {
    if (!lpDepositAmount) return;
    setIsLpDepositing(true);
    // Simulate transaction
    await new Promise((r) => setTimeout(r, 2000));
    setIsLpDepositing(false);
    setLpDepositAmount("");
    // Would call: addLiquidity(BigInt(parseFloat(lpDepositAmount) * 1e6))
  };

  const handleLpWithdraw = async () => {
    if (!lpWithdrawAmount || isLocked) return;
    setIsLpWithdrawing(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsLpWithdrawing(false);
    setLpWithdrawAmount("");
    // Would call: removeLiquidity(BigInt(parseFloat(lpWithdrawAmount) * 1e6))
  };

  const handleClaimRewards = async () => {
    if (unclaimedEpochs <= 0) return;
    setIsClaiming(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsClaiming(false);
    // Would call: claimRewards()
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="pt-20 px-6 pb-8 max-w-6xl mx-auto flex-1">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">Wallet</h1>
            <p className="text-text-muted flex items-center gap-2">
              {WALLET_DATA.address}
              <button className="hover:text-gold transition-colors">
                <Copy className="w-4 h-4" />
              </button>
              <button className="hover:text-gold transition-colors">
                <ExternalLink className="w-4 h-4" />
              </button>
            </p>
          </div>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="flex items-center gap-2 px-4 py-2 bg-gold/20 text-gold rounded-lg font-medium hover:bg-gold/30 transition-colors"
          >
            {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showBalance ? "Hide" : "Reveal"} Balance
          </button>
        </div>

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
                value={formatUSD(WALLET_DATA.balance)}
              />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-text-muted">
                Available:{" "}
                <span className="text-text-primary">
                  {showBalance ? formatUSD(WALLET_DATA.availableBalance) : "••••"}
                </span>
              </span>
              <span className="text-text-muted">
                Locked:{" "}
                <span className="text-gold">
                  {showBalance ? formatUSD(WALLET_DATA.lockedInPositions) : "••••"}
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
              WALLET_DATA.totalPnL >= 0 ? "text-success" : "text-danger"
            )}>
              {showBalance ? (
                <>
                  {WALLET_DATA.totalPnL >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  {WALLET_DATA.totalPnL >= 0 ? "+" : ""}{formatUSD(WALLET_DATA.totalPnL)}
                </>
              ) : (
                <EncryptedValue revealed={false} value="" />
              )}
            </div>
            <span className={cn(
              "text-sm font-medium",
              WALLET_DATA.totalPnLPercent >= 0 ? "text-success" : "text-danger"
            )}>
              {showBalance ? formatPercent(WALLET_DATA.totalPnLPercent) : "••••%"}
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
              WALLET_DATA.todayPnL >= 0 ? "text-success" : "text-danger"
            )}>
              {showBalance ? (
                <>
                  {WALLET_DATA.todayPnL >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  {WALLET_DATA.todayPnL >= 0 ? "+" : ""}{formatUSD(WALLET_DATA.todayPnL)}
                </>
              ) : (
                <EncryptedValue revealed={false} value="" />
              )}
            </div>
            <span className={cn(
              "text-sm font-medium",
              WALLET_DATA.todayPnLPercent >= 0 ? "text-success" : "text-danger"
            )}>
              {showBalance ? formatPercent(WALLET_DATA.todayPnLPercent) : "••••%"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: <PieChart className="w-4 h-4" /> },
            { id: "transfer", label: "Transfer sUSD", icon: <Send className="w-4 h-4" /> },
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
                      {showBalance ? formatUSD(WALLET_DATA.availableBalance) : "••••••"}
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
                    value={`${LP_DATA.lpBalance.toLocaleString()} LP`}
                  />
                </div>
                <p className="text-sm text-text-muted">
                  {showBalance ? `≈ ${formatUSD(LP_DATA.lpValue)}` : "≈ ••••"}
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
                    value={formatUSD(LP_DATA.pendingRewards)}
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
                  {LP_DATA.currentApy.toFixed(1)}%
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
                  {formatUSD(LP_DATA.poolTotalLiquidity)}
                </div>
                <p className="text-sm text-text-muted">
                  {LP_DATA.poolUtilization}% utilized
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
                    <h3 className="font-semibold text-text-primary">Epoch #{LP_DATA.currentEpoch}</h3>
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
                        {showBalance ? `${LP_DATA.lpBalance.toLocaleString()} LP` : "••••"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setLpWithdrawAmount(LP_DATA.lpBalance.toString())}
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
                      {showBalance ? formatUSD(LP_DATA.pendingRewards) : "••••"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Unclaimed Epochs</span>
                      <span className="text-text-primary">{unclaimedEpochs}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Last Claimed</span>
                      <span className="text-text-primary">Epoch #{LP_DATA.lastClaimedEpoch}</span>
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
                      {showBalance ? formatUSD(WALLET_DATA.availableBalance) : "••••"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setWithdrawAmount(WALLET_DATA.availableBalance.toString())}
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
