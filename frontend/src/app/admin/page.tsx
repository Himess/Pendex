"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ethers } from "ethers";
import { CONTRACTS } from "@/lib/contracts/config";

// Contract ABIs for admin functions
const ORACLE_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function getAllAssetIds() view returns (bytes32[])",
  "function getAsset(bytes32 assetId) view returns (tuple(string name, string symbol, uint64 basePrice, bool isActive, uint256 totalLongOI, uint256 totalShortOI))",
  "function updateBasePrice(bytes32 assetId, uint64 newPrice) external",
  "function setAssetActive(bytes32 assetId, bool active) external",
];

const VAULT_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function pause() external",
  "function unpause() external",
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
        <h1 className="text-3xl font-bold text-text-primary mb-8">Admin Dashboard</h1>

        {actionStatus && (
          <div className="mb-6 p-4 bg-accent/10 border border-accent rounded-lg text-accent">
            {actionStatus}
          </div>
        )}

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

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-text-primary mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleTogglePause}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                vaultPaused
                  ? "bg-success text-white hover:bg-success/80"
                  : "bg-danger text-white hover:bg-danger/80"
              }`}
            >
              {vaultPaused ? "Unpause Vault" : "Pause Vault"}
            </button>
            <button
              onClick={handleAdvanceEpoch}
              className="px-6 py-3 bg-accent text-background rounded-lg font-medium hover:bg-accent/80 transition-colors"
            >
              Advance Epoch
            </button>
          </div>
          <div className="mt-4 text-sm text-text-muted">
            Vault Status: <span className={vaultPaused ? "text-danger" : "text-success"}>
              {vaultPaused ? "PAUSED" : "ACTIVE"}
            </span>
          </div>
        </div>

        {/* Asset Management */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">Asset Management</h2>

          {/* Price Update Form */}
          {selectedAsset && (
            <div className="mb-6 p-4 bg-surface-dark rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-sm text-text-secondary">Update price for</div>
                  <div className="text-lg font-bold text-text-primary">{selectedAsset.symbol}</div>
                </div>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder={`Current: $${selectedAsset.basePrice}`}
                  className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-text-primary"
                />
                <button
                  onClick={handleUpdatePrice}
                  className="px-4 py-2 bg-accent text-background rounded-lg font-medium hover:bg-accent/80"
                >
                  Update
                </button>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="px-4 py-2 bg-surface-light text-text-secondary rounded-lg hover:bg-surface-light/80"
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
                  <tr key={asset.assetId} className="border-b border-border/50 hover:bg-surface-dark/50">
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
                          className="px-3 py-1 bg-accent/20 text-accent rounded text-sm hover:bg-accent/30"
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

        {/* Contract Addresses */}
        <div className="mt-8 bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">Contract Addresses</h2>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Oracle:</span>
              <span className="text-text-primary">{CONTRACTS.shadowOracle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Vault:</span>
              <span className="text-text-primary">{CONTRACTS.shadowVault}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">ShadowUSD:</span>
              <span className="text-text-primary">{CONTRACTS.shadowUsd}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Liquidity Pool:</span>
              <span className="text-text-primary">{CONTRACTS.shadowLiquidityPool}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Market Maker:</span>
              <span className="text-text-primary">{CONTRACTS.shadowMarketMaker}</span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
