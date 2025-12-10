/**
 * @title Shadow Protocol - Liquidation Bot
 * @notice Scans positions and liquidates those at 100% loss
 * @dev Uses FHE encrypted checks - makes publiclyDecryptable for verification
 *
 * Revenue Distribution:
 * - 50% goes to LP pool (for liquidity providers)
 * - 50% goes to protocol treasury
 * - 5% goes to liquidator as reward
 */

import hre from "hardhat";

const CONFIG = {
  // How often to check positions (ms)
  CHECK_INTERVAL: 10000, // 10 seconds

  // Batch size for position checks
  BATCH_SIZE: 10,

  // Contract addresses (from env or deployments)
  VAULT_ADDRESS: process.env.VAULT_ADDRESS || "",
  ORACLE_ADDRESS: process.env.ORACLE_ADDRESS || "",

  // Liquidator reward (5% of collateral)
  LIQUIDATOR_REWARD_BPS: 500,
};

interface LiquidationStats {
  totalChecked: number;
  totalLiquidated: number;
  totalRevenue: bigint;
  lpShare: bigint;
  protocolShare: bigint;
  liquidatorRewards: bigint;
  errors: number;
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║       SHADOW PROTOCOL - Liquidation Bot                    ║");
  console.log("║       Protecting LP funds with FHE privacy                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const network = hre.network.name;
  console.log(`🌐 Network: ${network}`);
  console.log(`⏱️  Check Interval: ${CONFIG.CHECK_INTERVAL / 1000}s`);
  console.log(`📦 Batch Size: ${CONFIG.BATCH_SIZE}\n`);

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log(`🔑 Liquidator Address: ${signer.address}`);
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log(`💰 ETH Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Get contract addresses
  let vaultAddress = CONFIG.VAULT_ADDRESS;
  let oracleAddress = CONFIG.ORACLE_ADDRESS;

  try {
    const vaultDeployment = await hre.deployments.get("ShadowVault");
    vaultAddress = vaultDeployment.address;
    const oracleDeployment = await hre.deployments.get("ShadowOracle");
    oracleAddress = oracleDeployment.address;
  } catch (e) {
    console.log("📋 Using environment variables for addresses");
  }

  if (!vaultAddress || !oracleAddress) {
    console.error("❌ Contract addresses not found. Deploy first or set environment variables.");
    console.log("   Set VAULT_ADDRESS and ORACLE_ADDRESS environment variables");
    process.exit(1);
  }

  console.log(`📝 ShadowVault: ${vaultAddress}`);
  console.log(`📝 ShadowOracle: ${oracleAddress}\n`);

  // Get contract instances
  const vault = await hre.ethers.getContractAt("ShadowVault", vaultAddress);
  const oracle = await hre.ethers.getContractAt("ShadowOracle", oracleAddress);

  // Get total positions
  const totalPositions = await vault.getTotalPositions();
  console.log(`📊 Total Positions in System: ${totalPositions}\n`);

  // Initialize stats
  const stats: LiquidationStats = {
    totalChecked: 0,
    totalLiquidated: 0,
    totalRevenue: 0n,
    lpShare: 0n,
    protocolShare: 0n,
    liquidatorRewards: 0n,
    errors: 0,
  };

  const startTime = Date.now();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Starting liquidation monitoring...                        ║");
  console.log("║  Press Ctrl+C to stop                                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Main loop
  while (true) {
    try {
      const currentTotalPositions = await vault.getTotalPositions();

      // Scan positions in batches
      const positionsToCheck: number[] = [];

      for (let i = 1; i <= Number(currentTotalPositions); i++) {
        try {
          // Check if position is open
          const [, , isOpen] = await vault.getPosition(i);
          if (isOpen) {
            positionsToCheck.push(i);
          }
        } catch {
          // Position doesn't exist or error
        }
      }

      if (positionsToCheck.length === 0) {
        console.log(`[${getTimestamp()}] No open positions to check`);
        await sleep(CONFIG.CHECK_INTERVAL);
        continue;
      }

      console.log(`[${getTimestamp()}] Checking ${positionsToCheck.length} open positions...`);

      // Process in batches
      for (let i = 0; i < positionsToCheck.length; i += CONFIG.BATCH_SIZE) {
        const batch = positionsToCheck.slice(i, i + CONFIG.BATCH_SIZE);

        // Batch check liquidations
        try {
          const tx = await vault.batchCheckLiquidations(batch, {
            gasLimit: 2000000,
          });
          await tx.wait();
          stats.totalChecked += batch.length;

          console.log(`  📋 Batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}: Checked positions ${batch.join(", ")}`);
        } catch (e: any) {
          console.log(`  ⚠️ Batch check failed: ${e.message?.slice(0, 60)}...`);
          stats.errors++;
        }

        // Try to liquidate each position in batch
        for (const positionId of batch) {
          try {
            // Attempt auto-liquidation at full loss
            const tx = await vault.autoLiquidateAtFullLoss(positionId, {
              gasLimit: 500000,
            });
            const receipt = await tx.wait();

            if (receipt && receipt.status === 1) {
              stats.totalLiquidated++;

              // Get position info for logging
              const [owner, assetId] = await vault.getPosition(positionId);

              console.log(`  🔥 LIQUIDATED Position #${positionId}`);
              console.log(`     Owner: ${owner.slice(0, 10)}...${owner.slice(-8)}`);
              console.log(`     Asset: ${hre.ethers.decodeBytes32String(assetId)}`);
              console.log(`     Gas Used: ${receipt.gasUsed.toString()}`);

              // Simulate revenue distribution (in real impl, this would be actual amounts)
              // For demo, we estimate based on average position size
              const estimatedCollateral = 1000n * 10n ** 6n; // $1000 average
              const liquidatorReward = (estimatedCollateral * BigInt(CONFIG.LIQUIDATOR_REWARD_BPS)) / 10000n;
              const remaining = estimatedCollateral - liquidatorReward;
              const lpPortion = remaining / 2n;
              const protocolPortion = remaining - lpPortion;

              stats.totalRevenue += estimatedCollateral;
              stats.lpShare += lpPortion;
              stats.protocolShare += protocolPortion;
              stats.liquidatorRewards += liquidatorReward;

              console.log(`     💰 Revenue: $${Number(estimatedCollateral) / 1e6}`);
              console.log(`        → LP Pool: $${Number(lpPortion) / 1e6}`);
              console.log(`        → Protocol: $${Number(protocolPortion) / 1e6}`);
              console.log(`        → Liquidator: $${Number(liquidatorReward) / 1e6}\n`);
            }
          } catch (e: any) {
            // Position not liquidatable or already closed - this is normal
            if (!e.message?.includes("Position not open") &&
                !e.message?.includes("execution reverted")) {
              stats.errors++;
              console.log(`  ⚠️ Error on position #${positionId}: ${e.message?.slice(0, 40)}...`);
            }
          }
        }
      }

      // Print periodic stats
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (stats.totalChecked > 0 && stats.totalChecked % 50 === 0) {
        printStats(stats, elapsed);
      }

    } catch (e: any) {
      stats.errors++;
      console.log(`[${getTimestamp()}] ❌ Error: ${e.message?.slice(0, 80)}...`);
    }

    await sleep(CONFIG.CHECK_INTERVAL);
  }
}

function printStats(stats: LiquidationStats, elapsedSeconds: number) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    LIQUIDATION STATS                       ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║  Runtime:          ${formatDuration(elapsedSeconds).padEnd(38)}║`);
  console.log(`║  Positions Checked: ${stats.totalChecked.toString().padEnd(37)}║`);
  console.log(`║  Liquidations:     ${stats.totalLiquidated.toString().padEnd(38)}║`);
  console.log(`║  Errors:           ${stats.errors.toString().padEnd(38)}║`);
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log("║                   REVENUE DISTRIBUTION                     ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║  Total Revenue:    $${(Number(stats.totalRevenue) / 1e6).toFixed(2).padEnd(36)}║`);
  console.log(`║  → LP Pool (50%):  $${(Number(stats.lpShare) / 1e6).toFixed(2).padEnd(36)}║`);
  console.log(`║  → Protocol (50%): $${(Number(stats.protocolShare) / 1e6).toFixed(2).padEnd(36)}║`);
  console.log(`║  → Liquidator (5%):$${(Number(stats.liquidatorRewards) / 1e6).toFixed(2).padEnd(36)}║`);
  console.log("╚════════════════════════════════════════════════════════════╝\n");
}

function getTimestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
