"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, TrendingUp, TrendingDown, RefreshCw, Shield, Loader2, X, Eye } from "lucide-react";
import { formatUSD, formatPercent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useUserPositions } from "@/lib/contracts/hooks";
import { CONTRACTS } from "@/lib/contracts/config";
import { SHADOW_VAULT_ABI, SHADOW_ORACLE_ABI } from "@/lib/contracts/abis";
import {
  initFheInstance,
  isFheInitialized,
  decryptValue,
} from "@/lib/fhe/client";
import { useSessionWallet } from "@/lib/session-wallet/hooks";
import { useTradeWithSession } from "@/lib/session-wallet/useTradeWithSession";

// Asset ID to symbol mapping
const ASSET_ID_TO_NAME: Record<string, { name: string; symbol: string }> = {
  "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9": { name: "OpenAI", symbol: "OPENAI" },
  "0xee2176d5e35f81b98746f5f98677beb44f0167ae70b6518fbb5b5bdc65da8fdd": { name: "Anthropic", symbol: "ANTHR" },
  "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab": { name: "SpaceX", symbol: "SPACEX" },
  "0x8eddee8eb3ba76411ebdccf6d0ad00841d58a803916546a295c2b0346ea86a11": { name: "Stripe", symbol: "STRIPE" },
  "0x0bf812f25cacc694be173fe6fd2b56e3f94f71dcee99e1f1280b2ce7fba46fca": { name: "Databricks", symbol: "DTBRKS" },
  "0x7a8e8d0c5008129e8077f29f2b784b6f889f3420f121d5b70b5b3326476bbce1": { name: "ByteDance", symbol: "BYTDNC" },
};

interface Position {
  id: string;
  positionId: bigint;
  asset: string;
  symbol: string;
  assetId: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  collateral: number;
  pnl: number;
  pnlPercent: number;
  isDecrypted: boolean;
  isDecrypting: boolean;
}

// getPosition returns flat tuple: [owner, assetId, isOpen, openTimestamp]
type RawPositionBasic = [string, string, boolean, bigint];

// getPositionEncryptedData returns: [collateral, size, entryPrice, isLong, leverage]
type RawPositionEncrypted = [bigint, bigint, bigint, bigint, bigint];

export function PositionsTable() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient(); // Main wallet for FHE decrypt

  // Session wallet for signing AND decryption (after contract update grants ACL to session)
  const { mainWallet, isSessionActive, sessionAddress, getSessionSigner } = useSessionWallet();
  const { closePosition: closePositionWithSession, isTrading: isClosing, isSuccess: closeSuccess } = useTradeWithSession();

  // The owner address is mainWallet if session is active, otherwise connected wallet
  const ownerAddress = (mainWallet || address) as `0x${string}` | undefined;

  // Fetch positions for OWNER address
  const { data: positionIds, isLoading: isLoadingPositions, refetch: refetchPositions } = useUserPositions(ownerAddress);

  const [positions, setPositions] = useState<Position[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [fheReady, setFheReady] = useState(false);
  const [closingPositionId, setClosingPositionId] = useState<bigint | null>(null);
  const [isDecryptingAll, setIsDecryptingAll] = useState(false);
  const [hasDecrypted, setHasDecrypted] = useState(false);

  // Initialize FHE
  useEffect(() => {
    if (isFheInitialized()) {
      setFheReady(true);
      return;
    }

    initFheInstance().then(() => {
      setFheReady(true);
    }).catch(console.error);
  }, []);

  // Refetch when close is successful
  useEffect(() => {
    if (closeSuccess) {
      refetchPositions();
      setClosingPositionId(null);
    }
  }, [closeSuccess, refetchPositions]);

  // Fetch position data from contract (without decrypting - that requires user action)
  const fetchPositionData = useCallback(async () => {
    if (!isConnected || !positionIds || !publicClient || !ownerAddress || (positionIds as bigint[]).length === 0) {
      setPositions([]);
      return;
    }

    setIsLoadingData(true);
    const fetchedPositions: Position[] = [];

    console.log("📊 Fetching positions for owner:", ownerAddress);
    console.log("📊 Position IDs:", positionIds);

    try {
      for (const posId of positionIds as bigint[]) {
        try {
          // Get basic position data (returns flat tuple: [owner, assetId, isOpen, openTimestamp])
          const rawPosition = await publicClient.readContract({
            address: CONTRACTS.shadowVault as `0x${string}`,
            abi: SHADOW_VAULT_ABI,
            functionName: "getPosition",
            args: [posId],
          }) as RawPositionBasic;

          // Destructure flat tuple
          const [owner, assetId, isOpen] = rawPosition;

          // Skip if not open
          if (!isOpen) {
            console.log(`⏭️ Position ${posId} is closed, skipping`);
            continue;
          }

          // CRITICAL: Only show positions we OWN
          if (owner.toLowerCase() !== ownerAddress.toLowerCase()) {
            console.log(`⏭️ Position ${posId} belongs to ${owner}, not us (${ownerAddress})`);
            continue;
          }

          console.log(`✅ Position ${posId} is ours! Owner: ${owner}`);

          const assetInfo = ASSET_ID_TO_NAME[assetId.toLowerCase()] || { name: "Unknown", symbol: "???" };

          // Get current price from Oracle
          let currentPrice = 0;
          try {
            const price = await publicClient.readContract({
              address: CONTRACTS.shadowOracle as `0x${string}`,
              abi: SHADOW_ORACLE_ABI,
              functionName: "getCurrentPrice",
              args: [assetId as `0x${string}`],
            }) as bigint;
            currentPrice = Number(price) / 1e6; // 6 decimals
          } catch (e) {
            console.error("Error fetching price:", e);
          }

          // Add position - values are encrypted until user clicks "Decrypt"
          fetchedPositions.push({
            id: `pos-${posId.toString()}`,
            positionId: posId,
            asset: assetInfo.name,
            symbol: assetInfo.symbol,
            assetId: assetId,
            side: "LONG", // Default, will be decrypted
            size: 0,
            entryPrice: 0,
            currentPrice,
            leverage: 0,
            collateral: 0,
            pnl: 0,
            pnlPercent: 0,
            isDecrypted: false,
            isDecrypting: false,
          });
        } catch (e) {
          console.error(`Error fetching position ${posId}:`, e);
        }
      }

      setPositions(fetchedPositions);
    } catch (e) {
      console.error("Error fetching positions:", e);
    } finally {
      setIsLoadingData(false);
    }
  }, [isConnected, positionIds, publicClient, ownerAddress]);

  // Fetch positions when IDs change
  useEffect(() => {
    fetchPositionData();
  }, [fetchPositionData]);

  // Create viem-compatible signer from session wallet (ethers.js → viem API)
  const createSessionSigner = useCallback(() => {
    if (!isSessionActive || !sessionAddress) return null;
    const ethersSigner = getSessionSigner();
    if (!ethersSigner) return null;

    return {
      signTypedData: async (params: {
        domain: Record<string, unknown>;
        types: Record<string, Array<{ name: string; type: string }>>;
        primaryType: string;
        message: Record<string, unknown>;
      }) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { EIP712Domain, ...typesWithoutDomain } = params.types;
        return await ethersSigner.signTypedData(params.domain, typesWithoutDomain, params.message);
      },
    };
  }, [isSessionActive, sessionAddress, getSessionSigner]);

  // Decrypt ALL positions - tries SESSION WALLET first, falls back to MAIN WALLET
  const decryptAllPositions = useCallback(async () => {
    if (!fheReady || !publicClient || !ownerAddress || positions.length === 0) {
      console.log("⏳ Cannot decrypt: missing FHE/publicClient/ownerAddress");
      return;
    }

    // Prefer session wallet (NO POPUP), fall back to main wallet (popup)
    const sessionSigner = createSessionSigner();
    const signerAddress = sessionSigner && sessionAddress ? sessionAddress : ownerAddress;
    const signer = sessionSigner || walletClient;

    if (!signer) {
      console.log("⏳ No signer available");
      return;
    }

    setIsDecryptingAll(true);
    setPositions(prev => prev.map(p => ({ ...p, isDecrypting: true })));

    console.log(`🔓 Decrypting ${positions.length} positions...`);
    console.log(`   Signer: ${signerAddress} (${sessionSigner ? "SESSION - no popup!" : "MAIN - popup required"})`);

    try {
      for (const position of positions) {
        if (position.isDecrypted) continue;

        try {
          // Fetch encrypted handles
          const encryptedData = await publicClient.readContract({
            address: CONTRACTS.shadowVault as `0x${string}`,
            abi: SHADOW_VAULT_ABI,
            functionName: "getPositionEncryptedData",
            args: [position.positionId],
            account: ownerAddress,
          }) as RawPositionEncrypted;

          console.log(`📦 Encrypted data for ${position.id}:`, encryptedData);

          const [encCollateral, , encEntryPrice, encIsLong, encLeverage] = encryptedData;

          // Convert to hex handles
          const collateralHandle = ("0x" + encCollateral.toString(16).padStart(64, "0")) as `0x${string}`;
          const leverageHandle = ("0x" + encLeverage.toString(16).padStart(64, "0")) as `0x${string}`;
          const isLongHandle = ("0x" + encIsLong.toString(16).padStart(64, "0")) as `0x${string}`;
          const entryPriceHandle = ("0x" + encEntryPrice.toString(16).padStart(64, "0")) as `0x${string}`;

          let collateral = 0;
          let leverage = 1;
          let isLong = true;
          let entryPrice = 0;

          // Decrypt using SESSION WALLET (no popup) or MAIN WALLET (popup)
          try {
            const decrypted = await decryptValue(collateralHandle, CONTRACTS.shadowVault, signerAddress, signer);
            collateral = Number(decrypted) / 1e6;
            console.log(`   ✅ Collateral: ${collateral}`);
          } catch (e) {
            console.log("   ❌ Collateral decrypt failed:", e);
          }

          try {
            const decrypted = await decryptValue(leverageHandle, CONTRACTS.shadowVault, signerAddress, signer);
            leverage = Number(decrypted);
            console.log(`   ✅ Leverage: ${leverage}x`);
          } catch (e) {
            console.log("   ❌ Leverage decrypt failed:", e);
          }

          try {
            const decrypted = await decryptValue(isLongHandle, CONTRACTS.shadowVault, signerAddress, signer);
            isLong = Number(decrypted) === 1;
            console.log(`   ✅ IsLong: ${isLong}`);
          } catch (e) {
            console.log("   ❌ IsLong decrypt failed:", e);
          }

          try {
            const decrypted = await decryptValue(entryPriceHandle, CONTRACTS.shadowVault, signerAddress, signer);
            entryPrice = Number(decrypted) / 1e6;
            console.log(`   ✅ Entry Price: ${entryPrice}`);
          } catch (e) {
            console.log("   ❌ Entry Price decrypt failed:", e);
          }

          // Calculate size and P&L
          const size = collateral * leverage;
          const priceDiff = position.currentPrice - entryPrice;
          const pnl = entryPrice > 0
            ? (isLong ? (priceDiff / entryPrice) * size : (-priceDiff / entryPrice) * size)
            : 0;
          const pnlPercent = collateral > 0 && entryPrice > 0 ? (pnl / collateral) * 100 : 0;

          // Debug P&L calculation
          console.log(`💰 P&L Calculation for ${position.id}:`);
          console.log(`   Entry Price: $${entryPrice}`);
          console.log(`   Current Price: $${position.currentPrice}`);
          console.log(`   Price Diff: $${priceDiff}`);
          console.log(`   Collateral: $${collateral}`);
          console.log(`   Leverage: ${leverage}x`);
          console.log(`   Size: $${size}`);
          console.log(`   IsLong: ${isLong}`);
          console.log(`   P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);

          setPositions(prev => prev.map(p =>
            p.id === position.id ? {
              ...p,
              collateral,
              leverage,
              side: isLong ? "LONG" : "SHORT",
              entryPrice,
              size,
              pnl,
              pnlPercent,
              isDecrypted: true,
              isDecrypting: false,
            } : p
          ));

          console.log(`✅ Position ${position.id} decrypted!`);
        } catch (e) {
          console.error(`❌ Error decrypting ${position.id}:`, e);
          setPositions(prev => prev.map(p =>
            p.id === position.id ? { ...p, isDecrypting: false } : p
          ));
        }
      }

      setHasDecrypted(true);
    } catch (e) {
      console.error("❌ Decrypt all failed:", e);
    } finally {
      setIsDecryptingAll(false);
    }
  }, [fheReady, publicClient, ownerAddress, walletClient, positions, createSessionSigner, sessionAddress]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchPositions();
    await fetchPositionData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClosePosition = async (positionId: bigint) => {
    if (!isSessionActive) {
      console.error("Session wallet not active");
      return;
    }
    setClosingPositionId(positionId);
    await closePositionWithSession(positionId);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-gold" />
          <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Open Positions</h2>
          {positions.length > 0 && (
            <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded">
              {positions.length} {hasDecrypted ? "Decrypted" : "Encrypted"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Decrypt All Button - only show if positions exist and not decrypted */}
          {positions.length > 0 && !hasDecrypted && (
            <button
              onClick={decryptAllPositions}
              disabled={isDecryptingAll || !fheReady}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
                "bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30",
                (isDecryptingAll || !fheReady) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isDecryptingAll ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              {isDecryptingAll ? "Decrypting..." : "Decrypt All"}
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingPositions || isLoadingData}
            className="p-1 rounded hover:bg-card-hover transition-colors"
          >
            <RefreshCw className={cn(
              "w-3.5 h-3.5 text-text-muted",
              (isRefreshing || isLoadingPositions || isLoadingData) && "animate-spin"
            )} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {(isLoadingPositions || isLoadingData) && positions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin mb-3" />
          <p className="text-sm text-text-muted">Loading positions...</p>
        </div>
      )}

      {/* Table */}
      {positions.length > 0 && (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider">
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Leverage</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Entry</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">P&L</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {positions.map((position) => (
                <tr key={position.id} className="hover:bg-card-hover transition-colors">
                  {/* Asset */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center text-[10px] font-bold text-gold border border-border">
                        {position.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <span className="font-medium text-text-primary text-xs">{position.asset}</span>
                        <span className="text-[10px] text-text-muted ml-1">/{" "}USD</span>
                      </div>
                    </div>
                  </td>

                  {/* Side */}
                  <td className="px-3 py-2">
                    {position.isDecrypting ? (
                      <Loader2 className="w-3 h-3 animate-spin text-gold" />
                    ) : position.isDecrypted ? (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          position.side === "LONG" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                        )}
                      >
                        {position.side}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-text-muted">
                        <Lock className="w-3 h-3 text-gold" />
                      </span>
                    )}
                  </td>

                  {/* Leverage */}
                  <td className="px-3 py-2">
                    {position.isDecrypting ? (
                      <Loader2 className="w-3 h-3 animate-spin text-gold" />
                    ) : position.isDecrypted ? (
                      <span className="text-gold font-medium">{position.leverage}x</span>
                    ) : (
                      <span className="flex items-center gap-1 text-text-muted">
                        <Lock className="w-3 h-3 text-gold" />
                      </span>
                    )}
                  </td>

                  {/* Size */}
                  <td className="px-3 py-2">
                    {position.isDecrypting ? (
                      <Loader2 className="w-3 h-3 animate-spin text-gold" />
                    ) : position.isDecrypted ? (
                      <span className="text-text-primary">{formatUSD(position.size)}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-text-muted text-xs">
                        <Lock className="w-3 h-3 text-gold" />
                      </span>
                    )}
                  </td>

                  {/* Entry Price */}
                  <td className="px-3 py-2">
                    {position.isDecrypting ? (
                      <Loader2 className="w-3 h-3 animate-spin text-gold" />
                    ) : position.isDecrypted ? (
                      <span className="text-text-primary">{formatUSD(position.entryPrice)}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-text-muted text-xs">
                        <Lock className="w-3 h-3 text-gold" />
                      </span>
                    )}
                  </td>

                  {/* Current Price - always visible */}
                  <td className="px-3 py-2">
                    <span className="text-text-primary font-medium">
                      {position.currentPrice > 0 ? formatUSD(position.currentPrice) : "-"}
                    </span>
                  </td>

                  {/* P&L */}
                  <td className="px-3 py-2">
                    {position.isDecrypting ? (
                      <Loader2 className="w-3 h-3 animate-spin text-gold" />
                    ) : position.isDecrypted ? (
                      <div className="flex items-center gap-1.5">
                        {position.pnl >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-success" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-danger" />
                        )}
                        <div className={cn(
                          "font-medium text-xs",
                          position.pnl >= 0 ? "text-success" : "text-danger"
                        )}>
                          <span>{position.pnl >= 0 ? "+" : ""}{formatUSD(position.pnl)}</span>
                          <span className="text-[10px] ml-1">({formatPercent(position.pnlPercent)})</span>
                        </div>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-text-muted text-xs">
                        <Lock className="w-3 h-3 text-gold" />
                      </span>
                    )}
                  </td>

                  {/* Actions - Always show CLOSE button */}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleClosePosition(position.positionId)}
                      disabled={isClosing && closingPositionId === position.positionId}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
                        "bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30",
                        isClosing && closingPositionId === position.positionId && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isClosing && closingPositionId === position.positionId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      CLOSE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingPositions && !isLoadingData && positions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-gold" />
          </div>
          <h3 className="text-sm font-semibold text-text-secondary mb-2">No open positions</h3>
          <p className="text-xs text-text-muted max-w-xs mb-6">
            Your encrypted positions will appear here. All position details are protected with FHE encryption.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-background font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Open Your First Position
          </a>
        </div>
      )}
    </div>
  );
}
