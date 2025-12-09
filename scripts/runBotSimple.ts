/**
 * @title Shadow Protocol - Market Maker Bot Runner (Simple Version)
 * @notice For Sepolia and non-FHE networks
 */

import hre from "hardhat";

const CONFIG = {
  TRADE_INTERVAL: 5000,
  SCENARIO_CHANGE_INTERVAL: 180000,
  BATCH_SIZE: 3,
  ASSETS: [
    "OPENAI", "ANTHROPIC", "XAI", "PERPLEXITY", "GROQ",
    "SPACEX", "ANDURIL", "SHIELDAI",
    "STRIPE", "REVOLUT", "RIPPLE", "KRAKEN",
    "DATABRICKS", "CANVA", "VERCEL",
    "BYTEDANCE", "DISCORD"
  ],
  MARKET_MAKER_ADDRESS: process.env.MARKET_MAKER_ADDRESS || "",
  ORACLE_ADDRESS: process.env.ORACLE_ADDRESS || "",
};

const SCENARIO_NAMES = [
  "PUMP",
  "DUMP",
  "SIDEWAYS",
  "VOLATILE",
  "ACCUMULATION",
  "DISTRIBUTION"
];

async function main() {
  console.log("\n========================================");
  console.log("   SHADOW PROTOCOL - Market Maker Bot  ");
  console.log("   (Simple Version for Sepolia)        ");
  console.log("========================================\n");

  const network = hre.network.name;
  console.log(`Network: ${network}`);
  console.log(`Trade Interval: ${CONFIG.TRADE_INTERVAL / 1000}s`);
  console.log(`Scenario Change: Every ${CONFIG.SCENARIO_CHANGE_INTERVAL / 60000} minutes\n`);

  const [signer] = await hre.ethers.getSigners();
  console.log(`Bot Operator: ${signer.address}`);
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  let marketMakerAddress = CONFIG.MARKET_MAKER_ADDRESS;
  let oracleAddress = CONFIG.ORACLE_ADDRESS;

  try {
    const marketMakerDeployment = await hre.deployments.get("ShadowMarketMakerSimple");
    marketMakerAddress = marketMakerDeployment.address;
    const oracleDeployment = await hre.deployments.get("ShadowOracle");
    oracleAddress = oracleDeployment.address;
  } catch (e) {
    console.log("Using environment variables for addresses");
  }

  if (!marketMakerAddress || !oracleAddress) {
    console.error("Contract addresses not found. Deploy first or set environment variables.");
    process.exit(1);
  }

  console.log(`MarketMaker: ${marketMakerAddress}`);
  console.log(`Oracle: ${oracleAddress}\n`);

  const marketMaker = await hre.ethers.getContractAt("ShadowMarketMakerSimple", marketMakerAddress);
  const oracle = await hre.ethers.getContractAt("ShadowOracle", oracleAddress);

  const assetIds = await oracle.getAllAssetIds();
  console.log(`Loaded ${assetIds.length} assets\n`);

  let totalTrades = 0;
  let totalErrors = 0;
  let currentScenario = 2;
  const startTime = Date.now();
  let lastScenarioChange = Date.now();

  console.log("========================================");
  console.log("  Starting automated trading...");
  console.log("  Press Ctrl+C to stop");
  console.log("========================================\n");

  while (true) {
    try {
      // Scenario change
      if (Date.now() - lastScenarioChange > CONFIG.SCENARIO_CHANGE_INTERVAL) {
        const newScenario = Math.floor(Math.random() * 6);

        console.log(`\n[SCENARIO CHANGE] ${SCENARIO_NAMES[currentScenario]} -> ${SCENARIO_NAMES[newScenario]}`);

        try {
          const tx = await marketMaker.setScenario(newScenario);
          await tx.wait();
          currentScenario = newScenario;
          console.log(`Scenario updated on-chain\n`);
        } catch (e: any) {
          console.log(`Failed to update scenario: ${e.message}\n`);
        }

        lastScenarioChange = Date.now();
      }

      // Select random asset
      const assetIndex = Math.floor(Math.random() * assetIds.length);
      const assetId = assetIds[assetIndex];
      const assetInfo = await oracle.getAsset(assetId);

      console.log(`Trading ${assetInfo.symbol}...`);

      try {
        const tx = await marketMaker.executeRandomTrade(assetId, {
          gasLimit: 500000
        });
        const receipt = await tx.wait();

        const newPrice = await oracle.getCurrentPrice(assetId);
        const priceUsd = Number(newPrice) / 1e6;

        totalTrades++;

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  Trade #${totalTrades} | ${assetInfo.symbol} @ $${priceUsd.toFixed(2)} | Gas: ${receipt?.gasUsed?.toString() || "?"} | Time: ${elapsed}s`);

        if (totalTrades % 10 === 0) {
          console.log(`\n--- Stats after ${totalTrades} trades ---`);
          console.log(`Scenario: ${SCENARIO_NAMES[currentScenario]}`);
          console.log(`Long OI: ${hre.ethers.formatUnits(assetInfo.totalLongOI, 6)}`);
          console.log(`Short OI: ${hre.ethers.formatUnits(assetInfo.totalShortOI, 6)}`);
          console.log(`Errors: ${totalErrors}\n`);
        }

      } catch (e: any) {
        totalErrors++;
        console.log(`  Trade failed: ${e.message?.slice(0, 80)}...`);
      }

    } catch (e: any) {
      totalErrors++;
      console.log(`Error: ${e.message?.slice(0, 80)}...`);
    }

    await sleep(CONFIG.TRADE_INTERVAL);
  }
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
