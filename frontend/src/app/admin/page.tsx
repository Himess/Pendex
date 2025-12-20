"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ethers } from "ethers";
import { CONTRACTS } from "@/lib/contracts/config";
import {
  Settings,
  Plus,
  Bot,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  RefreshCw,
  Percent,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Contract ABIs for admin functions
const ORACLE_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function getAllAssetIds() view returns (bytes32[])",
  "function getAsset(bytes32 assetId) view returns (tuple(string name, string symbol, uint64 basePrice, bool isActive, uint256 totalLongOI, uint256 totalShortOI))",
  "function updateBasePrice(bytes32 assetId, uint64 newPrice) external",
  "function setAssetActive(bytes32 assetId, bool active) external",
  "function addAssetWithCategory(string name, string symbol, uint64 basePrice, uint8 category) external",
];

const VAULT_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function pause() external",
  "function unpause() external",
  "function protocolFeeBps() view returns (uint64)",
  "function setProtocolFee(uint64 newFeeBps) external",
  "function getRevenueStats() view returns (uint256 totalFees, uint256 totalLiquidationRevenue, uint256 distributedToLPs, uint256 distributedToTreasury)",
];

const LIQUIDITY_POOL_ABI = [
  "function owner() view returns (address)",
  "function totalLiquidity() view returns (uint256)",
  "function currentUtilization() view returns (uint256)",
  "function currentEpoch() view returns (uint256)",
  "function epochFees() view returns (uint256)",
  "function epochPnL() view returns (int256)",
  "function advanceEpoch() external",
];

// Asset categories matching contract
const ASSET_CATEGORIES = [
  { id: 0, name: "AI", description: "AI & Machine Learning" },
  { id: 1, name: "AEROSPACE", description: "Aerospace & Defense" },
  { id: 2, name: "FINTECH", description: "Financial Technology" },
  { id: 3, name: "DATA", description: "Data & Enterprise" },
  { id: 4, name: "SOCIAL", description: "Social Media" },
];

interface AssetInfo {
  assetId: string;
  name: string;
  symbol: string;
  basePrice: number;
  isActive: boolean;
  totalLongOI: number;
  totalShortOI: number;
}

interface PoolStats {
  totalLiquidity: number;
  utilization: number;
  currentEpoch: number;
  epochFees: number;
  epochPnL: number;
}

interface RevenueStats {
  totalFees: number;
  totalLiquidationRevenue: number;
  distributedToLPs: number;
  distributedToTreasury: number;
}

interface NewAssetForm {
  name: string;
  symbol: string;
  basePrice: string;
  category: number;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [vaultPaused, setVaultPaused] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // New state for improvements
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [currentFeeBps, setCurrentFeeBps] = useState<number>(0);
  const [newFeeBps, setNewFeeBps] = useState("");
  const [showFeeEditor, setShowFeeEditor] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAssetForm, setNewAssetForm] = useState<NewAssetForm>({
    name: "",
    symbol: "",
    basePrice: "",
    category: 0,
  });
  const [botStatus, setBotStatus] = useState<"running" | "stopped" | "unknown">("unknown");
  const [lastBotActivity, setLastBotActivity] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "assets" | "settings">("overview");

  const RPC_URL = "https://sepolia.infura.io/v3/84842078b09946638c03157f83405213";

  useEffect(() => {
    const checkOwnerAndFetchData = async () => {
      if (!isConnected || !address) {
        setIsLoading(false);
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        // Check if user is owner of Oracle
        const oracle = new ethers.Contract(CONTRACTS.shadowOracle, ORACLE_ADMIN_ABI, provider);
        const oracleOwner = await oracle.owner();
        const isOracleOwner = oracleOwner.toLowerCase() === address.toLowerCase();
        setIsOwner(isOracleOwner);

        if (!isOracleOwner) {
          setIsLoading(false);
          return;
        }

        // Fetch all assets
        const assetIds = await oracle.getAllAssetIds();
        const loadedAssets: AssetInfo[] = [];

        for (const assetId of assetIds) {
          const asset = await oracle.getAsset(assetId);
          loadedAssets.push({
            assetId: assetId,
            name: asset.name,
            symbol: asset.symbol,
            basePrice: Number(asset.basePrice) / 1e6,
            isActive: asset.isActive,
            totalLongOI: Number(asset.totalLongOI) / 1e6,
            totalShortOI: Number(asset.totalShortOI) / 1e6,
          });
        }
        setAssets(loadedAssets);

        // Fetch vault status
        const vault = new ethers.Contract(CONTRACTS.shadowVault, VAULT_ADMIN_ABI, provider);
        const paused = await vault.paused();
        setVaultPaused(paused);

        // Fetch fee rate
        try {
          const feeBps = await vault.protocolFeeBps();
          setCurrentFeeBps(Number(feeBps));
        } catch {
          console.log("Fee BPS not available");
        }

        // Fetch revenue stats
        try {
          const revenue = await vault.getRevenueStats();
          setRevenueStats({
            totalFees: Number(revenue.totalFees) / 1e6,
            totalLiquidationRevenue: Number(revenue.totalLiquidationRevenue) / 1e6,
            distributedToLPs: Number(revenue.distributedToLPs) / 1e6,
            distributedToTreasury: Number(revenue.distributedToTreasury) / 1e6,
          });
        } catch {
          console.log("Revenue stats not available");
        }

        // Check bot status (simulated - based on recent OI changes)
        const totalOI = loadedAssets.reduce((acc, a) => acc + a.totalLongOI + a.totalShortOI, 0);
        if (totalOI > 0) {
          setBotStatus("running");
          setLastBotActivity(new Date());
        } else {
          setBotStatus("stopped");
        }

        // Fetch pool stats
        const pool = new ethers.Contract(CONTRACTS.shadowLiquidityPool, LIQUIDITY_POOL_ABI, provider);
        const [liquidity, util, epoch, fees, pnl] = await Promise.all([
          pool.totalLiquidity(),
          pool.currentUtilization(),
          pool.currentEpoch(),
          pool.epochFees(),
          pool.epochPnL(),
        ]);

        setPoolStats({
          totalLiquidity: Number(liquidity) / 1e6,
          utilization: Number(util) / 100,
          currentEpoch: Number(epoch),
          epochFees: Number(fees) / 1e6,
          epochPnL: Number(pnl) / 1e6,
        });

      } catch (error) {
        console.error("Failed to fetch admin data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOwnerAndFetchData();
  }, [address, isConnected]);

  const handleUpdatePrice = async () => {
    if (!selectedAsset || !newPrice || !window.ethereum) return;

    setActionStatus("Updating price...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const oracle = new ethers.Contract(CONTRACTS.shadowOracle, ORACLE_ADMIN_ABI, signer);

      const priceInUnits = BigInt(Math.floor(parseFloat(newPrice) * 1e6));
      const tx = await oracle.updateBasePrice(selectedAsset.assetId, priceInUnits);
      await tx.wait();

      setActionStatus("Price updated successfully!");
      setNewPrice("");
      setSelectedAsset(null);

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error("Failed to update price:", error);
      setActionStatus("Failed to update price");
    }
  };

  const handleToggleAsset = async (asset: AssetInfo) => {
    if (!window.ethereum) return;

    setActionStatus(`${asset.isActive ? "Deactivating" : "Activating"} ${asset.symbol}...`);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const oracle = new ethers.Contract(CONTRACTS.shadowOracle, ORACLE_ADMIN_ABI, signer);

      const tx = await oracle.setAssetActive(asset.assetId, !asset.isActive);
      await tx.wait();

      setActionStatus(`${asset.symbol} ${asset.isActive ? "deactivated" : "activated"}!`);
      window.location.reload();
    } catch (error) {
      console.error("Failed to toggle asset:", error);
      setActionStatus("Failed to toggle asset");
    }
  };

  const handleTogglePause = async () => {
    if (!window.ethereum) return;

    setActionStatus(vaultPaused ? "Unpausing vault..." : "Pausing vault...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONTRACTS.shadowVault, VAULT_ADMIN_ABI, signer);

      const tx = vaultPaused ? await vault.unpause() : await vault.pause();
      await tx.wait();

      setActionStatus(vaultPaused ? "Vault unpaused!" : "Vault paused!");
      window.location.reload();
    } catch (error) {
      console.error("Failed to toggle pause:", error);
      setActionStatus("Failed to toggle pause");
    }
  };

  const handleAdvanceEpoch = async () => {
    if (!window.ethereum) return;

    setActionStatus("Advancing epoch...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const pool = new ethers.Contract(CONTRACTS.shadowLiquidityPool, LIQUIDITY_POOL_ABI, signer);

      const tx = await pool.advanceEpoch();
      await tx.wait();

      setActionStatus("Epoch advanced!");
      window.location.reload();
    } catch (error) {
      console.error("Failed to advance epoch:", error);
      setActionStatus("Failed to advance epoch");
    }
  };

  // New handler: Update protocol fee
  const handleUpdateFee = async () => {
    if (!window.ethereum || !newFeeBps) return;

    const feeBpsValue = parseInt(newFeeBps);
    if (isNaN(feeBpsValue) || feeBpsValue < 0 || feeBpsValue > 1000) {
      setActionStatus("Fee must be between 0 and 1000 bps (0-10%)");
      return;
    }

    setActionStatus("Updating protocol fee...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONTRACTS.shadowVault, VAULT_ADMIN_ABI, signer);

      const tx = await vault.setProtocolFee(BigInt(feeBpsValue));
      await tx.wait();

      setActionStatus(`Protocol fee updated to ${feeBpsValue / 100}%!`);
      setCurrentFeeBps(feeBpsValue);
      setNewFeeBps("");
      setShowFeeEditor(false);
    } catch (error) {
      console.error("Failed to update fee:", error);
      setActionStatus("Failed to update protocol fee");
    }
  };

  // New handler: Add new asset
  const handleAddAsset = async () => {
    if (!window.ethereum) return;

    const { name, symbol, basePrice, category } = newAssetForm;
    if (!name || !symbol || !basePrice) {
      setActionStatus("Please fill in all fields");
      return;
    }

    const priceValue = parseFloat(basePrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      setActionStatus("Invalid price value");
      return;
    }

    setActionStatus(`Adding new asset: ${symbol}...`);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const oracle = new ethers.Contract(CONTRACTS.shadowOracle, ORACLE_ADMIN_ABI, signer);

      const priceInUnits = BigInt(Math.floor(priceValue * 1e6));
      const tx = await oracle.addAssetWithCategory(name, symbol.toUpperCase(), priceInUnits, category);
      await tx.wait();

      setActionStatus(`${symbol} added successfully!`);
      setNewAssetForm({ name: "", symbol: "", basePrice: "", category: 0 });
      setShowAddAsset(false);
      window.location.reload();
    } catch (error) {
      console.error("Failed to add asset:", error);
      setActionStatus("Failed to add asset");
    }
  };

  // Bot toggle (simulated - shows notification)
  const handleToggleBot = () => {
    if (botStatus === "running") {
      setBotStatus("stopped");
      setActionStatus("Bot stop signal sent. Note: Actual bot runs as a separate process.");
    } else {
      setBotStatus("running");
      setLastBotActivity(new Date());
      setActionStatus("Bot start signal sent. Run: npx hardhat run scripts/runBotSimple.ts --network sepolia");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-text-secondary">Loading...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-text-secondary">Please connect your wallet</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-2xl text-danger">Access Denied</div>
            <div className="text-text-secondary">You are not the contract owner</div>
            <div className="text-xs text-text-muted font-mono">{address}</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-text-primary">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold" />
            <span className="text-sm text-gold">Owner Mode</span>
          </div>
        </div>

        {actionStatus && (
          <div className="mb-6 p-4 bg-accent/10 border border-accent rounded-lg text-accent flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {actionStatus}
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {[
            { id: "overview", label: "Overview", icon: TrendingUp },
            { id: "assets", label: "Assets", icon: DollarSign },
            { id: "settings", label: "Settings", icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === id
                  ? "text-gold border-gold"
                  : "text-text-muted border-transparent hover:text-text-secondary"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Protocol Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="text-text-secondary text-sm mb-1">Total Liquidity</div>
                <div className="text-2xl font-bold text-text-primary">
                  ${poolStats?.totalLiquidity.toLocaleString() ?? "0"}
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="text-text-secondary text-sm mb-1">Utilization</div>
                <div className="text-2xl font-bold text-text-primary">
                  {poolStats?.utilization.toFixed(2) ?? "0"}%
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="text-text-secondary text-sm mb-1">Current Epoch</div>
                <div className="text-2xl font-bold text-text-primary">
                  #{poolStats?.currentEpoch ?? "0"}
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="text-text-secondary text-sm mb-1">Epoch PnL</div>
                <div className={`text-2xl font-bold ${(poolStats?.epochPnL ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                  ${poolStats?.epochPnL.toFixed(2) ?? "0"}
                </div>
              </div>
            </div>

            {/* Revenue Stats */}
            <div className="bg-card border border-border rounded-lg p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-gold" />
                <h2 className="text-xl font-bold text-text-primary">Protocol Revenue</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-text-muted text-xs mb-1">Total Fees</div>
                  <div className="text-lg font-bold text-success">
                    ${revenueStats?.totalFees.toLocaleString() ?? "0"}
                  </div>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-text-muted text-xs mb-1">Liquidation Revenue</div>
                  <div className="text-lg font-bold text-gold">
                    ${revenueStats?.totalLiquidationRevenue.toLocaleString() ?? "0"}
                  </div>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-text-muted text-xs mb-1">Distributed to LPs</div>
                  <div className="text-lg font-bold text-text-primary">
                    ${revenueStats?.distributedToLPs.toLocaleString() ?? "0"}
                  </div>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-text-muted text-xs mb-1">Treasury</div>
                  <div className="text-lg font-bold text-text-primary">
                    ${revenueStats?.distributedToTreasury.toLocaleString() ?? "0"}
                  </div>
                </div>
              </div>
            </div>

            {/* Bot Status */}
            <div className="bg-card border border-border rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">Trading Bot</h2>
                </div>
                <button
                  onClick={handleToggleBot}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                    botStatus === "running"
                      ? "bg-danger/20 text-danger hover:bg-danger/30"
                      : "bg-success/20 text-success hover:bg-success/30"
                  )}
                >
                  {botStatus === "running" ? (
                    <>
                      <Pause className="w-4 h-4" />
                      Stop Bot
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start Bot
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-text-muted text-xs mb-1">Status</div>
                  <div className={cn(
                    "flex items-center gap-2 text-sm font-medium",
                    botStatus === "running" ? "text-success" : "text-danger"
                  )}>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      botStatus === "running" ? "bg-success animate-pulse" : "bg-danger"
                    )} />
                    {botStatus === "running" ? "Running" : botStatus === "stopped" ? "Stopped" : "Unknown"}
                  </div>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-text-muted text-xs mb-1">Last Activity</div>
                  <div className="text-sm text-text-primary">
                    {lastBotActivity ? lastBotActivity.toLocaleTimeString() : "N/A"}
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gold/10 rounded-lg text-xs text-gold">
                Bot command: MARKET_MAKER_ADDRESS=0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb npx hardhat run scripts/runBotSimple.ts --network sepolia
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-text-primary mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleTogglePause}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                    vaultPaused
                      ? "bg-success text-white hover:bg-success/80"
                      : "bg-danger text-white hover:bg-danger/80"
                  }`}
                >
                  {vaultPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {vaultPaused ? "Unpause Vault" : "Pause Vault"}
                </button>
                <button
                  onClick={handleAdvanceEpoch}
                  className="flex items-center gap-2 px-6 py-3 bg-gold text-background rounded-lg font-medium hover:bg-gold/80 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Advance Epoch
                </button>
              </div>
              <div className="mt-4 text-sm text-text-muted">
                Vault Status: <span className={vaultPaused ? "text-danger" : "text-success"}>
                  {vaultPaused ? "PAUSED" : "ACTIVE"}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Assets Tab */}
        {activeTab === "assets" && (
          <>
            {/* Add Asset Button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowAddAsset(!showAddAsset)}
                className="flex items-center gap-2 px-4 py-2 bg-gold text-background rounded-lg font-medium hover:bg-gold/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New Asset
              </button>
            </div>

            {/* Add Asset Form */}
            {showAddAsset && (
              <div className="mb-6 bg-card border border-gold/30 rounded-lg p-6">
                <h3 className="text-lg font-bold text-text-primary mb-4">Add New Pre-IPO Asset</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Asset Name</label>
                    <input
                      type="text"
                      value={newAssetForm.name}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, name: e.target.value })}
                      placeholder="e.g., OpenAI"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Symbol</label>
                    <input
                      type="text"
                      value={newAssetForm.symbol}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, symbol: e.target.value.toUpperCase() })}
                      placeholder="e.g., OPENAI"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-primary uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Base Price (USD)</label>
                    <input
                      type="number"
                      value={newAssetForm.basePrice}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, basePrice: e.target.value })}
                      placeholder="e.g., 150"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Category</label>
                    <select
                      value={newAssetForm.category}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, category: parseInt(e.target.value) })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-primary"
                    >
                      {ASSET_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} - {cat.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={handleAddAsset}
                    className="px-6 py-2 bg-gold text-background rounded-lg font-medium hover:bg-gold/80"
                  >
                    Add Asset
                  </button>
                  <button
                    onClick={() => setShowAddAsset(false)}
                    className="px-6 py-2 bg-card-hover text-text-secondary rounded-lg hover:bg-card-hover/80"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Asset Management */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4">Asset Management</h2>

              {/* Price Update Form */}
              {selectedAsset && (
                <div className="mb-6 p-4 bg-background/50 rounded-lg border border-border">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <div className="text-sm text-text-secondary">Update price for</div>
                      <div className="text-lg font-bold text-text-primary">{selectedAsset.symbol}</div>
                    </div>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder={`Current: $${selectedAsset.basePrice}`}
                      className="flex-1 min-w-[200px] bg-background border border-border rounded-lg px-4 py-2 text-text-primary"
                    />
                    <button
                      onClick={handleUpdatePrice}
                      className="px-4 py-2 bg-gold text-background rounded-lg font-medium hover:bg-gold/80"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => setSelectedAsset(null)}
                      className="px-4 py-2 bg-card-hover text-text-secondary rounded-lg hover:bg-card-hover/80"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Assets Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-text-secondary text-sm border-b border-border">
                      <th className="pb-3 pr-4">Symbol</th>
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4 text-right">Base Price</th>
                      <th className="pb-3 pr-4 text-right">Long OI</th>
                      <th className="pb-3 pr-4 text-right">Short OI</th>
                      <th className="pb-3 pr-4 text-center">Status</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.assetId} className="border-b border-border/50 hover:bg-card-hover/50">
                        <td className="py-4 pr-4 font-bold text-text-primary">{asset.symbol}</td>
                        <td className="py-4 pr-4 text-text-secondary">{asset.name}</td>
                        <td className="py-4 pr-4 text-right font-mono text-text-primary">
                          ${asset.basePrice.toLocaleString()}
                        </td>
                        <td className="py-4 pr-4 text-right font-mono text-success">
                          ${asset.totalLongOI.toLocaleString()}
                        </td>
                        <td className="py-4 pr-4 text-right font-mono text-danger">
                          ${asset.totalShortOI.toLocaleString()}
                        </td>
                        <td className="py-4 pr-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            asset.isActive ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                          }`}>
                            {asset.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedAsset(asset)}
                              className="px-3 py-1 bg-gold/20 text-gold rounded text-sm hover:bg-gold/30"
                            >
                              Edit Price
                            </button>
                            <button
                              onClick={() => handleToggleAsset(asset)}
                              className={`px-3 py-1 rounded text-sm ${
                                asset.isActive
                                  ? "bg-danger/20 text-danger hover:bg-danger/30"
                                  : "bg-success/20 text-success hover:bg-success/30"
                              }`}
                            >
                              {asset.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <>
            {/* Protocol Fee Settings */}
            <div className="bg-card border border-border rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">Protocol Fee</h2>
                </div>
                <button
                  onClick={() => setShowFeeEditor(!showFeeEditor)}
                  className="flex items-center gap-2 px-4 py-2 bg-gold/20 text-gold rounded-lg font-medium hover:bg-gold/30"
                >
                  <Settings className="w-4 h-4" />
                  Edit Fee
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-text-muted text-xs mb-1">Current Fee Rate</div>
                  <div className="text-2xl font-bold text-gold">
                    {(currentFeeBps / 100).toFixed(2)}%
                  </div>
                  <div className="text-xs text-text-muted">({currentFeeBps} basis points)</div>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-text-muted text-xs mb-1">Fee Range</div>
                  <div className="text-lg font-bold text-text-primary">0% - 10%</div>
                  <div className="text-xs text-text-muted">(0 - 1000 bps)</div>
                </div>
              </div>

              {showFeeEditor && (
                <div className="p-4 bg-background/50 rounded-lg border border-gold/30">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm text-text-muted mb-1">New Fee (basis points)</label>
                      <input
                        type="number"
                        value={newFeeBps}
                        onChange={(e) => setNewFeeBps(e.target.value)}
                        placeholder={`Current: ${currentFeeBps} bps`}
                        min="0"
                        max="1000"
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-primary"
                      />
                      <p className="text-xs text-text-muted mt-1">
                        {newFeeBps ? `= ${(parseInt(newFeeBps) / 100).toFixed(2)}%` : "100 bps = 1%"}
                      </p>
                    </div>
                    <button
                      onClick={handleUpdateFee}
                      className="px-6 py-2 bg-gold text-background rounded-lg font-medium hover:bg-gold/80"
                    >
                      Update Fee
                    </button>
                    <button
                      onClick={() => { setShowFeeEditor(false); setNewFeeBps(""); }}
                      className="px-6 py-2 bg-card-hover text-text-secondary rounded-lg hover:bg-card-hover/80"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Contract Addresses */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4">Contract Addresses</h2>
              <div className="space-y-3 font-mono text-sm">
                {[
                  { label: "Oracle", address: CONTRACTS.shadowOracle },
                  { label: "Vault", address: CONTRACTS.shadowVault },
                  { label: "ShadowUSD", address: CONTRACTS.shadowUsd },
                  { label: "Liquidity Pool", address: CONTRACTS.shadowLiquidityPool },
                ].map(({ label, address }) => (
                  <div key={label} className="flex justify-between items-center p-3 bg-background/50 rounded-lg">
                    <span className="text-text-secondary">{label}:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary">{address}</span>
                      <a
                        href={`https://sepolia.etherscan.io/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:text-gold/80"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
