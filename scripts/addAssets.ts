import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const ORACLE_ADDR = "0x9A5Fec3b1999cCBfC3a33EF5cdf09fdecad52301";

  // Get Oracle contract
  const oracle = await ethers.getContractAt("ShadowOracle", ORACLE_ADDR);

  // Check owner
  const owner = await oracle.owner();
  console.log("Oracle owner:", owner);
  console.log("Is deployer owner?", owner.toLowerCase() === deployer.address.toLowerCase());

  // Try to get asset count first (view function test)
  try {
    const assetIds = await oracle.getAllAssetIds();
    console.log("Current assets:", assetIds.length);
  } catch (e: any) {
    console.log("getAllAssetIds failed:", e.message);
  }

  console.log("\nAdding Pre-IPO Assets to Oracle...\n");

  // Categories: 0=AI, 1=AEROSPACE, 2=FINTECH, 3=DATA, 4=SOCIAL
  const assets = [
    { name: "OpenAI", symbol: "OPENAI", price: 250_000_000, category: 0 },
    { name: "Anthropic", symbol: "ANTHROPIC", price: 95_000_000, category: 0 },
    { name: "SpaceX", symbol: "SPACEX", price: 180_000_000, category: 1 },
    { name: "Stripe", symbol: "STRIPE", price: 48_000_000, category: 2 },
    { name: "Databricks", symbol: "DATABRICKS", price: 55_000_000, category: 3 },
    { name: "ByteDance", symbol: "BYTEDANCE", price: 165_000_000, category: 4 },
  ];

  for (const asset of assets) {
    try {
      console.log(`Adding ${asset.name}...`);
      const tx = await oracle.addAssetWithCategory(
        asset.name,
        asset.symbol,
        asset.price,
        asset.category,
        { gasLimit: 500000 }
      );
      console.log(`  TX: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  ✅ ${asset.name} added! Gas used: ${receipt?.gasUsed}`);
    } catch (e: any) {
      console.log(`  ❌ ${asset.name} failed: ${e.message}`);
    }
  }

  // Verify assets were added
  try {
    const assetIds = await oracle.getAllAssetIds();
    console.log("\nTotal assets after:", assetIds.length);

    for (const id of assetIds) {
      const asset = await oracle.getAsset(id);
      console.log(`  - ${asset.symbol}: $${Number(asset.basePrice) / 1e6}`);
    }
  } catch (e: any) {
    console.log("Final check failed:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
