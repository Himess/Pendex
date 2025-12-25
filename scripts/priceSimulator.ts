import { ethers } from "hardhat";

/**
 * Price Simulator Script
 * Randomly updates asset prices by ±1-2% every 30 seconds
 * Simulates realistic market price movements for demo
 */

// Session 12 - Updated Oracle address
const ORACLE_ADDR = "0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81";

// Asset base prices (in 6 decimals, so 250_000_000 = $250)
const ASSETS = [
  { symbol: "OPENAI", basePrice: 250_000_000 },
  { symbol: "ANTHROPIC", basePrice: 95_000_000 },
  { symbol: "SPACEX", basePrice: 180_000_000 },
  { symbol: "STRIPE", basePrice: 48_000_000 },
  { symbol: "DATABRICKS", basePrice: 55_000_000 },
  { symbol: "BYTEDANCE", basePrice: 165_000_000 },
];

// Current prices (will be modified)
const currentPrices: Map<string, number> = new Map();

// Initialize with base prices
ASSETS.forEach(a => currentPrices.set(a.symbol, a.basePrice));

/**
 * Generate random price change between -2% and +2%
 */
function getRandomPriceChange(): number {
  // Random between -2% and +2%
  const change = (Math.random() * 4 - 2) / 100;
  return change;
}

/**
 * Update a single asset's price
 */
async function updateAssetPrice(
  oracle: any,
  symbol: string,
  currentPrice: number
): Promise<number> {
  const change = getRandomPriceChange();
  const newPrice = Math.floor(currentPrice * (1 + change));

  // Ensure price doesn't go below 10% of base or above 200% of base
  const basePrice = ASSETS.find(a => a.symbol === symbol)?.basePrice || currentPrice;
  const minPrice = Math.floor(basePrice * 0.8);
  const maxPrice = Math.floor(basePrice * 1.2);

  const clampedPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

  // Get asset ID
  const assetId = ethers.keccak256(ethers.toUtf8Bytes(symbol));

  try {
    const tx = await oracle.updateBasePrice(assetId, clampedPrice, { gasLimit: 100000 });
    await tx.wait();

    const priceUsd = clampedPrice / 1_000_000;
    const changePercent = ((clampedPrice - currentPrice) / currentPrice * 100).toFixed(2);
    const direction = change >= 0 ? "📈" : "📉";

    console.log(`${direction} ${symbol}: $${priceUsd.toFixed(2)} (${changePercent}%)`);

    return clampedPrice;
  } catch (error: any) {
    console.error(`❌ Failed to update ${symbol}: ${error.message}`);
    return currentPrice;
  }
}

/**
 * Main simulation loop
 */
async function main() {
  console.log("🚀 Starting Price Simulator...");
  console.log(`📍 Oracle: ${ORACLE_ADDR}\n`);

  const [signer] = await ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}\n`);

  const oracle = await ethers.getContractAt("ShadowOracle", ORACLE_ADDR);

  // Verify ownership
  const owner = await oracle.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("❌ Signer is not the Oracle owner!");
    console.log(`   Owner: ${owner}`);
    console.log(`   Signer: ${signer.address}`);
    process.exit(1);
  }

  console.log("✅ Ownership verified\n");
  console.log("📊 Starting price updates (every 30 seconds)...\n");
  console.log("━".repeat(50));

  // Update prices every 30 seconds
  const UPDATE_INTERVAL = 30000; // 30 seconds

  let iteration = 0;

  const updateAllPrices = async () => {
    iteration++;
    console.log(`\n🔄 Update #${iteration} - ${new Date().toLocaleTimeString()}`);
    console.log("─".repeat(40));

    for (const asset of ASSETS) {
      const currentPrice = currentPrices.get(asset.symbol) || asset.basePrice;
      const newPrice = await updateAssetPrice(oracle, asset.symbol, currentPrice);
      currentPrices.set(asset.symbol, newPrice);

      // Small delay between updates to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("─".repeat(40));
    console.log("✅ All prices updated\n");
  };

  // Initial update
  await updateAllPrices();

  // Set up interval
  setInterval(updateAllPrices, UPDATE_INTERVAL);

  console.log("💡 Press Ctrl+C to stop the simulator\n");
}

// One-time update (for testing)
async function oneTimeUpdate() {
  console.log("🚀 Running one-time price update...\n");

  const [signer] = await ethers.getSigners();
  const oracle = await ethers.getContractAt("ShadowOracle", ORACLE_ADDR);

  console.log(`👤 Signer: ${signer.address}\n`);

  for (const asset of ASSETS) {
    const currentPrice = currentPrices.get(asset.symbol) || asset.basePrice;
    const newPrice = await updateAssetPrice(oracle, asset.symbol, currentPrice);
    currentPrices.set(asset.symbol, newPrice);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n✅ One-time update complete!");
}

// Check if running with --once flag
const args = process.argv.slice(2);
if (args.includes("--once")) {
  oneTimeUpdate()
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
