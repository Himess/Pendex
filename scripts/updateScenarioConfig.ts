import { ethers } from "hardhat";

/**
 * Update scenario configs for smaller price movements (+-1-2%)
 *
 * Price formula: modifierPercent = (oiDiff * 1) / 10000
 * For 1% movement: oiDiff = 100,000,000 units = $100 (with 1e6 decimals)
 * For 2% movement: oiDiff = 200,000,000 units = $200
 *
 * So trade sizes should be in range of $10-$500 for realistic movements
 */
async function main() {
  const MARKET_MAKER_ADDRESS = process.env.MARKET_MAKER_ADDRESS;

  if (!MARKET_MAKER_ADDRESS) {
    throw new Error("Please set MARKET_MAKER_ADDRESS environment variable");
  }

  console.log("🔧 Updating scenario configs for smaller price movements...\n");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Get contract
  const marketMaker = await ethers.getContractAt("ShadowMarketMakerSimple", MARKET_MAKER_ADDRESS);

  // Updated configs for +-1-2% price movements
  // Trade sizes in USD (multiplied by 1e6 for decimals)
  const newConfigs = [
    {
      scenario: 0, // PUMP
      buyProbability: 75,
      minTradeSize: 50 * 1e6,      // $50
      maxTradeSize: 300 * 1e6,     // $300
      volatilityMultiplier: 120
    },
    {
      scenario: 1, // DUMP
      buyProbability: 25,
      minTradeSize: 50 * 1e6,
      maxTradeSize: 300 * 1e6,
      volatilityMultiplier: 120
    },
    {
      scenario: 2, // SIDEWAYS
      buyProbability: 50,
      minTradeSize: 20 * 1e6,      // $20
      maxTradeSize: 150 * 1e6,     // $150
      volatilityMultiplier: 80
    },
    {
      scenario: 3, // VOLATILE
      buyProbability: 50,
      minTradeSize: 100 * 1e6,     // $100
      maxTradeSize: 500 * 1e6,     // $500
      volatilityMultiplier: 200
    },
    {
      scenario: 4, // ACCUMULATION
      buyProbability: 70,
      minTradeSize: 200 * 1e6,     // $200
      maxTradeSize: 800 * 1e6,     // $800
      volatilityMultiplier: 150
    },
    {
      scenario: 5, // DISTRIBUTION
      buyProbability: 30,
      minTradeSize: 200 * 1e6,
      maxTradeSize: 800 * 1e6,
      volatilityMultiplier: 150
    }
  ];

  const scenarioNames = ["PUMP", "DUMP", "SIDEWAYS", "VOLATILE", "ACCUMULATION", "DISTRIBUTION"];

  for (const config of newConfigs) {
    console.log(`Updating ${scenarioNames[config.scenario]}...`);
    console.log(`  Buy prob: ${config.buyProbability}%`);
    console.log(`  Trade size: $${config.minTradeSize / 1e6} - $${config.maxTradeSize / 1e6}`);

    try {
      const tx = await marketMaker.updateScenarioConfig(
        config.scenario,
        config.buyProbability,
        config.minTradeSize,
        config.maxTradeSize,
        config.volatilityMultiplier
      );
      await tx.wait();
      console.log(`  ✅ Updated (tx: ${tx.hash})\n`);
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}\n`);
    }
  }

  console.log("✅ All scenario configs updated!");

  // Verify
  console.log("\n📊 Verifying current config...");
  const currentConfig = await marketMaker.getCurrentScenarioConfig();
  console.log("Current scenario config:", {
    buyProbability: currentConfig.buyProbabilityPercent.toString(),
    minTradeSize: `$${Number(currentConfig.minTradeSize) / 1e6}`,
    maxTradeSize: `$${Number(currentConfig.maxTradeSize) / 1e6}`,
    volatilityMultiplier: currentConfig.volatilityMultiplier.toString()
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
