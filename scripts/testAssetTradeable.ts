/**
 * Test isAssetTradeable with correct asset ID
 */

import { ethers } from "hardhat";

const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";

// Asset IDs from getAllAssetIds
const OPENAI_ID = "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9";
const SPACEX_ID = "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab";

async function main() {
  console.log("\n🔍 Testing isAssetTradeable\n");

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const oracleAbi = [
    "function isAssetTradeable(bytes32 assetId) view returns (bool)",
    "function assets(bytes32) view returns (string name, string symbol, uint64 basePrice, bool isActive, uint256 totalOI, uint64 lastPrice, uint256 volume24h, uint256 lastTradeTime, uint256 lpPoolSize)",
    "function getCurrentPrice(bytes32 assetId) view returns (uint64)"
  ];

  const oracle = new ethers.Contract(SHADOW_ORACLE, oracleAbi, provider);

  // Test OpenAI
  console.log("Testing OpenAI asset...");
  console.log(`  ID: ${OPENAI_ID}`);
  try {
    const tradeable = await oracle.isAssetTradeable(OPENAI_ID);
    console.log(`  ✅ isAssetTradeable(): ${tradeable}`);

    const asset = await oracle.assets(OPENAI_ID);
    console.log(`  Name: ${asset.name}`);
    console.log(`  Symbol: ${asset.symbol}`);
    console.log(`  Base Price: $${Number(asset.basePrice) / 1e6}`);
    console.log(`  Is Active: ${asset.isActive}`);

    const price = await oracle.getCurrentPrice(OPENAI_ID);
    console.log(`  Current Price: $${Number(price) / 1e6}`);
  } catch (e) {
    console.log(`  ❌ Error:`, e);
  }

  // Test SpaceX
  console.log("\nTesting SpaceX asset...");
  console.log(`  ID: ${SPACEX_ID}`);
  try {
    const tradeable = await oracle.isAssetTradeable(SPACEX_ID);
    console.log(`  ✅ isAssetTradeable(): ${tradeable}`);

    const asset = await oracle.assets(SPACEX_ID);
    console.log(`  Name: ${asset.name}`);
    console.log(`  Symbol: ${asset.symbol}`);
    console.log(`  Base Price: $${Number(asset.basePrice) / 1e6}`);
    console.log(`  Is Active: ${asset.isActive}`);
  } catch (e) {
    console.log(`  ❌ Error:`, e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
