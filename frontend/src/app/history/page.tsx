"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import {
  History,
  Lock,
  ExternalLink,
  Filter,
  RefreshCw,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Wallet,
  Repeat,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { CONTRACTS } from "@/lib/contracts/config";

type TransactionType = "DEPOSIT" | "WITHDRAW" | "OPEN_POSITION" | "CLOSE_POSITION" | "TRANSFER" | "LP_ADD" | "LP_REMOVE" | "CLAIM_REWARDS";

interface Transaction {
  id: string;
  type: TransactionType;
  hash: string;
  timestamp: number;
  status: "confirmed" | "pending" | "failed";
  amount?: string;
  asset?: string;
  isEncrypted: boolean;
  // Position specific
  positionId?: string;
  side?: "LONG" | "SHORT";
  pnl?: number;
  // LP specific
  lpTokens?: string;
}

// Mock transactions - in production these would come from event logs
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    type: "DEPOSIT",
    hash: "0x1234...5678",
    timestamp: Date.now() - 3600000,
    status: "confirmed",
    amount: "1,000 sUSD",
    isEncrypted: true,
  },
  {
    id: "2",
    type: "OPEN_POSITION",
    hash: "0x2345...6789",
    timestamp: Date.now() - 7200000,
    status: "confirmed",
    asset: "SPACEX",
    positionId: "42",
    side: "LONG",
    amount: "$5,000",
    isEncrypted: true,
  },
  {
    id: "3",
    type: "LP_ADD",
    hash: "0x3456...7890",
    timestamp: Date.now() - 86400000,
    status: "confirmed",
    amount: "2,500 sUSD",
    lpTokens: "2,500 LP",
    isEncrypted: false,
  },
  {
    id: "4",
    type: "CLOSE_POSITION",
    hash: "0x4567...8901",
    timestamp: Date.now() - 172800000,
    status: "confirmed",
    asset: "STRIPE",
    positionId: "38",
    side: "SHORT",
    pnl: 125.50,
    isEncrypted: true,
  },
  {
    id: "5",
    type: "TRANSFER",
    hash: "0x5678...9012",
    timestamp: Date.now() - 259200000,
    status: "confirmed",
    amount: "500 sUSD",
    isEncrypted: true,
  },
  {
    id: "6",
    type: "CLAIM_REWARDS",
    hash: "0x6789...0123",
    timestamp: Date.now() - 345600000,
    status: "confirmed",
    amount: "45.23 sUSD",
    isEncrypted: false,
  },
];

const TX_TYPE_CONFIG: Record<TransactionType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  DEPOSIT: { label: "Deposit", icon: ArrowDownRight, color: "text-success" },
  WITHDRAW: { label: "Withdraw", icon: ArrowUpRight, color: "text-danger" },
  OPEN_POSITION: { label: "Open Position", icon: TrendingUp, color: "text-gold" },
  CLOSE_POSITION: { label: "Close Position", icon: TrendingDown, color: "text-blue-400" },
  TRANSFER: { label: "Transfer", icon: Repeat, color: "text-purple-400" },
  LP_ADD: { label: "Add Liquidity", icon: Wallet, color: "text-success" },
  LP_REMOVE: { label: "Remove Liquidity", icon: Wallet, color: "text-danger" },
  CLAIM_REWARDS: { label: "Claim Rewards", icon: TrendingUp, color: "text-gold" },
};

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<TransactionType | "ALL">("ALL");

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (filter === "ALL") return transactions;
    return transactions.filter(tx => tx.type === filter);
  }, [transactions, filter]);

  const handleRefresh = async () => {
    setIsLoading(true);
    // In production, fetch from event logs or backend API
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  // Stats
  const stats = useMemo(() => {
    const deposits = transactions.filter(tx => tx.type === "DEPOSIT").length;
    const positions = transactions.filter(tx => tx.type === "OPEN_POSITION" || tx.type === "CLOSE_POSITION").length;
    const lpActions = transactions.filter(tx => tx.type === "LP_ADD" || tx.type === "LP_REMOVE").length;
    const totalPnl = transactions
      .filter(tx => tx.pnl !== undefined)
      .reduce((sum, tx) => sum + (tx.pnl || 0), 0);

    return { deposits, positions, lpActions, totalPnl };
  }, [transactions]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gold/10 rounded-xl">
              <History className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Transaction History</h1>
              <p className="text-sm text-text-muted">
                Your FHE-encrypted transaction records on Sepolia
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-card-hover transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
              <ArrowDownRight className="w-4 h-4" />
              Deposits
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats.deposits}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Positions
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats.positions}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
              <Wallet className="w-4 h-4" />
              LP Actions
            </div>
            <div className="text-2xl font-bold text-text-primary">{stats.lpActions}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
              <Shield className="w-4 h-4" />
              Total P&L
            </div>
            <div className={cn(
              "text-2xl font-bold",
              stats.totalPnl >= 0 ? "text-success" : "text-danger"
            )}>
              {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {(["ALL", "DEPOSIT", "WITHDRAW", "OPEN_POSITION", "CLOSE_POSITION", "LP_ADD", "CLAIM_REWARDS"] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                filter === type
                  ? "bg-gold text-background"
                  : "bg-card border border-border text-text-secondary hover:text-text-primary"
              )}
            >
              {type === "ALL" ? "All" : TX_TYPE_CONFIG[type]?.label || type}
            </button>
          ))}
        </div>

        {/* Transactions Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold" />
              <span className="font-medium text-text-primary">Transactions</span>
              <span className="text-xs text-gold bg-gold/10 px-2 py-0.5 rounded">
                FHE Encrypted
              </span>
            </div>
            <span className="text-sm text-text-muted">
              {filteredTransactions.length} transactions
            </span>
          </div>

          {!isConnected ? (
            <div className="p-12 text-center">
              <Lock className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary mb-2">Connect your wallet to view history</p>
              <p className="text-sm text-text-muted">
                Your encrypted transactions will appear here
              </p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary mb-2">No transactions found</p>
              <p className="text-sm text-text-muted">
                Your transaction history will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTransactions.map(tx => {
                const config = TX_TYPE_CONFIG[tx.type];
                const Icon = config.icon;

                return (
                  <div
                    key={tx.id}
                    className="p-4 hover:bg-card-hover transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2 rounded-lg bg-background", config.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">{config.label}</span>
                          {tx.isEncrypted && (
                            <Lock className="w-3 h-3 text-gold" />
                          )}
                          {tx.asset && (
                            <span className="text-xs bg-background px-2 py-0.5 rounded text-text-secondary">
                              {tx.asset}
                            </span>
                          )}
                          {tx.side && (
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded",
                              tx.side === "LONG" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                            )}>
                              {tx.side}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-text-muted">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(tx.timestamp)}
                          <span className="mx-1">|</span>
                          <span className="font-mono">{tx.hash}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {tx.amount && (
                          <div className="font-medium text-text-primary">
                            {tx.isEncrypted ? "******" : tx.amount}
                            {tx.isEncrypted && <Lock className="w-3 h-3 text-gold inline ml-1" />}
                          </div>
                        )}
                        {tx.pnl !== undefined && (
                          <div className={cn(
                            "text-sm font-medium",
                            tx.pnl >= 0 ? "text-success" : "text-danger"
                          )}>
                            P&L: {tx.pnl >= 0 ? "+" : ""}${tx.pnl.toFixed(2)}
                          </div>
                        )}
                        {tx.lpTokens && (
                          <div className="text-sm text-text-muted">{tx.lpTokens}</div>
                        )}
                      </div>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-background rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-text-muted" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FHE Info Banner */}
        <div className="mt-8 p-4 bg-gold/10 border border-gold/30 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-gold mb-1">Fully Homomorphic Encryption (FHE)</h3>
              <p className="text-sm text-gold/80">
                Your transaction amounts, position sizes, and trading details are encrypted using Zama&apos;s fhEVM.
                Only you can decrypt and view your actual values. Not even validators can see your trading activity.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
