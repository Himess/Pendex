import { ethers } from "hardhat";

/**
 * Limit Order Keeper Bot
 * Checks pending limit orders every 60 seconds and executes them if triggered
 * Also checks for liquidatable positions
 */

const VAULT_ADDR = "0x486eF23A22Ab485851bE386da07767b070a51e82";
const ORACLE_ADDR = "0x9A5Fec3b1999cCBfC3a33EF5cdf09fdecad52301";

// Assets to monitor
const ASSETS = [
  { symbol: "OPENAI", id: "" },
  { symbol: "ANTHROPIC", id: "" },
  { symbol: "SPACEX", id: "" },
  { symbol: "STRIPE", id: "" },
  { symbol: "DATABRICKS", id: "" },
  { symbol: "BYTEDANCE", id: "" },
];

// Generate asset IDs
ASSETS.forEach(a => {
  a.id = ethers.keccak256(ethers.toUtf8Bytes(a.symbol));
});

interface PendingOrder {
  orderId: number;
  owner: string;
  assetId: string;
  assetSymbol: string;
  isActive: boolean;
}

async function main() {
  console.log("🤖 Starting Keeper Bot...");
  console.log(`📍 Vault: ${VAULT_ADDR}`);
  console.log(`📍 Oracle: ${ORACLE_ADDR}\n`);

  const [signer] = await ethers.getSigners();
  console.log(`👤 Keeper: ${signer.address}\n`);

  const vault = await ethers.getContractAt("ShadowVault", VAULT_ADDR);
  const oracle = await ethers.getContractAt("ShadowOracle", ORACLE_ADDR);

  console.log("✅ Contracts loaded\n");
  console.log("📊 Monitoring limit orders and positions...\n");
  console.log("━".repeat(50));

  const CHECK_INTERVAL = 60000; // 60 seconds

  let iteration = 0;

  const runKeeperCycle = async () => {
    iteration++;
    console.log(`\n🔄 Keeper Cycle #${iteration} - ${new Date().toLocaleTimeString()}`);
    console.log("─".repeat(40));

    try {
      // 1. Check limit orders
      await checkLimitOrders(vault, oracle);

      // 2. Check for liquidatable positions
      await checkLiquidations(vault);

    } catch (error: any) {
      console.error(`❌ Keeper cycle error: ${error.message}`);
    }

    console.log("─".repeat(40));
    console.log("✅ Cycle complete\n");
  };

  // Initial run
  await runKeeperCycle();

  // Set up interval
  setInterval(runKeeperCycle, CHECK_INTERVAL);

  console.log("💡 Press Ctrl+C to stop the keeper bot\n");
}

/**
 * Check all active limit orders
 */
async function checkLimitOrders(vault: any, oracle: any) {
  console.log("\n📋 Checking Limit Orders...");

  try {
    // Get next limit order ID to know range
    const nextOrderId = await vault.nextLimitOrderId();
    const totalOrders = Number(nextOrderId) - 1;

    if (totalOrders <= 0) {
      console.log("   No limit orders found");
      return;
    }

    console.log(`   Found ${totalOrders} total orders`);

    let executed = 0;
    let active = 0;

    // Check each order
    for (let i = 1; i <= totalOrders; i++) {
      try {
        // Try to get order info
        // Note: In actual contract, we'd need a view function for this
        // For now, we attempt execution and catch failures

        // Check if order can be triggered (this makes encrypted values decryptable)
        const shouldExecute = await vault.checkLimitOrderTrigger(i);

        // If we get here without error, try to execute
        try {
          const tx = await vault.executeLimitOrder(i, { gasLimit: 1000000 });
          const receipt = await tx.wait();

          if (receipt.status === 1) {
            console.log(`   ✅ Order #${i} EXECUTED!`);
            executed++;
          }
        } catch (execError: any) {
          if (execError.message.includes("Order not active")) {
            // Order was already executed or cancelled
          } else if (execError.message.includes("revert")) {
            // Trigger condition not met yet
            active++;
          } else {
            console.log(`   ⚠️ Order #${i}: ${execError.message.slice(0, 50)}`);
          }
        }
      } catch (checkError: any) {
        if (!checkError.message.includes("Order not active")) {
          // Some other error
        }
      }
    }

    console.log(`   📊 Active: ${active}, Executed this cycle: ${executed}`);

  } catch (error: any) {
    console.log(`   ⚠️ Error checking orders: ${error.message.slice(0, 50)}`);
  }
}

/**
 * Check for liquidatable positions
 */
async function checkLiquidations(vault: any) {
  console.log("\n💀 Checking Liquidations...");

  try {
    // Get next position ID to know range
    const nextPositionId = await vault.nextPositionId();
    const totalPositions = Number(nextPositionId) - 1;

    if (totalPositions <= 0) {
      console.log("   No positions found");
      return;
    }

    console.log(`   Found ${totalPositions} total positions`);

    let liquidated = 0;
    let openPositions = 0;

    // Check each position
    for (let i = 1; i <= totalPositions; i++) {
      try {
        // Get position basic info
        const [owner, assetId, isOpen] = await vault.getPosition(i);

        if (!isOpen) continue;
        openPositions++;

        // Check if position can be liquidated (100% loss)
        try {
          const isFullLoss = await vault.checkFullLiquidation(i);

          // Try to liquidate
          const tx = await vault.autoLiquidateAtFullLoss(i, { gasLimit: 1000000 });
          const receipt = await tx.wait();

          if (receipt.status === 1) {
            console.log(`   💀 Position #${i} LIQUIDATED!`);
            liquidated++;
          }
        } catch (liqError: any) {
          // Not liquidatable or other error - this is expected for healthy positions
        }
      } catch (posError: any) {
        // Position doesn't exist or other error
      }
    }

    console.log(`   📊 Open: ${openPositions}, Liquidated this cycle: ${liquidated}`);

  } catch (error: any) {
    console.log(`   ⚠️ Error checking liquidations: ${error.message.slice(0, 50)}`);
  }
}

/**
 * Get current asset prices for logging
 */
async function logCurrentPrices(oracle: any) {
  console.log("\n💰 Current Prices:");

  for (const asset of ASSETS) {
    try {
      const assetData = await oracle.getAsset(asset.id);
      const priceUsd = Number(assetData.basePrice) / 1_000_000;
      console.log(`   ${asset.symbol}: $${priceUsd.toFixed(2)}`);
    } catch (error) {
      console.log(`   ${asset.symbol}: Error fetching price`);
    }
  }
}

// One-time check (for testing)
async function oneTimeCheck() {
  console.log("🤖 Running one-time keeper check...\n");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("ShadowVault", VAULT_ADDR);
  const oracle = await ethers.getContractAt("ShadowOracle", ORACLE_ADDR);

  console.log(`👤 Keeper: ${signer.address}\n`);

  await logCurrentPrices(oracle);
  await checkLimitOrders(vault, oracle);
  await checkLiquidations(vault);

  console.log("\n✅ One-time check complete!");
}

// Check if running with --once flag
const args = process.argv.slice(2);
if (args.includes("--once")) {
  oneTimeCheck()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
