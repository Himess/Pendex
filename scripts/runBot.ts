/**
 * @title Shadow Protocol - Market Maker Bot Runner
 * @notice Runs the on-chain market maker bot to simulate realistic trading activity
 * @dev This script continuously executes encrypted trades using FHE
 *
 * USAGE:
 *   npx hardhat run scripts/runBot.ts --network zama
 *   npx hardhat run scripts/runBot.ts --network sepolia
 *
 * SCENARIOS:
 *   PUMP (0)        - 75% buy, bullish market
 *   DUMP (1)        - 25% buy, bearish market
 *   SIDEWAYS (2)    - 50% buy, stable market
 *   VOLATILE (3)    - 50% buy, large swings
 *   ACCUMULATION (4) - 70% buy, whale buying
 *   DISTRIBUTION (5) - 30% buy, whale selling
 */

import hre from "hardhat";

// Configuration
const CONFIG = {
  // Trade interval in milliseconds (how often to execute trades)
  TRADE_INTERVAL: 5000, // 5 seconds

  // Scenario change interval (milliseconds)
  SCENARIO_CHANGE_INTERVAL: 180000, // 3 minutes

  // Batch size (trades per execution)
  BATCH_SIZE: 3,

  // Assets to trade (symbols)
  ASSETS: [
    "OPENAI", "ANTHROPIC", "XAI", "PERPLEXITY", "GROQ",
    "SPACEX", "ANDURIL", "SHIELDAI",
    "STRIPE", "REVOLUT", "RIPPLE", "KRAKEN",
    "DATABRICKS", "CANVA", "VERCEL",
    "BYTEDANCE", "DISCORD"
  ],

  // Deployed contract addresses (update after deployment)
  MARKET_MAKER_ADDRESS: process.env.MARKET_MAKER_ADDRESS || "",
  ORACLE_ADDRESS: process.env.ORACLE_ADDRESS || "",
};

// Scenario names for logging
const SCENARIO_NAMES = [
  "PUMP 🚀",
  "DUMP 📉",
  "SIDEWAYS ➡️",
  "VOLATILE 🎢",
  "ACCUMULATION 🐋⬆️",
  "DISTRIBUTION 🐋⬇️"
];

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║       🤖 SHADOW PROTOCOL - On-Chain Market Maker 🤖       ║");
  console.log("║             FHE-Encrypted Automated Trading               ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const network = hre.network.name;
  console.log(`🌐 Network: ${network}`);
  console.log(`⏱️  Trade Interval: ${CONFIG.TRADE_INTERVAL / 1000}s`);
  console.log(`🔄 Scenario Change: Every ${CONFIG.SCENARIO_CHANGE_INTERVAL / 60000} minutes`);
  console.log(`📦 Batch Size: ${CONFIG.BATCH_SIZE} trades/execution\n`);

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log(`👤 Bot Operator: ${signer.address}`);
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Get deployed addresses
  let marketMakerAddress = CONFIG.MARKET_MAKER_ADDRESS;
  let oracleAddress = CONFIG.ORACLE_ADDRESS;

  // Try to load from deployments
  try {
    const marketMakerDeployment = await hre.deployments.get("ShadowMarketMaker");
    marketMakerAddress = marketMakerDeployment.address;
    const oracleDeployment = await hre.deployments.get("ShadowOracle");
    oracleAddress = oracleDeployment.address;
  } catch (e) {
    console.log("⚠️  Could not load deployments, using environment variables");
  }

  if (!marketMakerAddress || !oracleAddress) {
    console.error("❌ Contract addresses not found. Deploy first or set environment variables.");
    console.error("   MARKET_MAKER_ADDRESS=0x... ORACLE_ADDRESS=0x... npx hardhat run scripts/runBot.ts");
    process.exit(1);
  }

  console.log(`📍 MarketMaker: ${marketMakerAddress}`);
  console.log(`📍 Oracle: ${oracleAddress}\n`);

  // Connect to contracts
  const marketMaker = await hre.ethers.getContractAt("ShadowMarketMaker", marketMakerAddress);
  const oracle = await hre.ethers.getContractAt("ShadowOracle", oracleAddress);

  // Get all asset IDs
  const assetIds = await oracle.getAllAssetIds();
  console.log(`📊 Loaded ${assetIds.length} assets\n`);

  // Stats
  let totalTrades = 0;
  let totalErrors = 0;
  let currentScenario = 2; // Start with SIDEWAYS
  const startTime = Date.now();

  // Scenario change timer
  let lastScenarioChange = Date.now();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Starting automated trading... Press Ctrl+C to stop");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Main trading loop
  while (true) {
    try {
      // Check if scenario should change
      if (Date.now() - lastScenarioChange > CONFIG.SCENARIO_CHANGE_INTERVAL) {
        const newScenario = Math.floor(Math.random() * 6);

        console.log(`\n🎭 SCENARIO CHANGE: ${SCENARIO_NAMES[currentScenario]} → ${SCENARIO_NAMES[newScenario]}`);

        try {
          const tx = await marketMaker.setScenario(newScenario);
          await tx.wait();
          currentScenario = newScenario;
          console.log(`   ✅ Scenario updated on-chain\n`);
        } catch (e: any) {
          console.log(`   ⚠️ Failed to update scenario: ${e.message}\n`);
        }

        lastScenarioChange = Date.now();
      }

      // Select random asset
      const assetIndex = Math.floor(Math.random() * assetIds.length);
      const assetId = assetIds[assetIndex];
      const assetInfo = await oracle.getAsset(assetId);

      // Execute batch trades
      console.log(`📈 Trading ${assetInfo.symbol}...`);

      try {
        // Execute random trade
        const tx = await marketMaker.executeRandomTrade(assetId, {
          gasLimit: 500000
        });
        const receipt = await tx.wait();

        // Get new price
        const newPrice = await oracle.getCurrentPrice(assetId);
        const priceUsd = Number(newPrice) / 1e6;

        totalTrades++;

        // Log trade
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`   ✅ Trade #${totalTrades} | ${assetInfo.symbol} @ $${priceUsd.toFixed(2)} | Gas: ${receipt?.gasUsed?.toString() || "?"} | Time: ${elapsed}s`);

        // Log OI changes periodically
        if (totalTrades % 10 === 0) {
          console.log(`\n📊 Stats after ${totalTrades} trades:`);
          console.log(`   Scenario: ${SCENARIO_NAMES[currentScenario]}`);
          console.log(`   Long OI: ${hre.ethers.formatUnits(assetInfo.totalLongOI, 6)}`);
          console.log(`   Short OI: ${hre.ethers.formatUnits(assetInfo.totalShortOI, 6)}`);
          console.log(`   Errors: ${totalErrors}\n`);
        }

      } catch (e: any) {
        totalErrors++;
        console.log(`   ❌ Trade failed: ${e.message?.slice(0, 50)}...`);
      }

    } catch (e: any) {
      totalErrors++;
      console.log(`❌ Error: ${e.message?.slice(0, 50)}...`);
    }

    // Wait before next trade
    await sleep(CONFIG.TRADE_INTERVAL);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the bot
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
