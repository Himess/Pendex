/**
 * Debug Oracle Configuration
 *
 * Checks if the asset IDs are tradeable
 */

import { ethers } from "hardhat";

// Contract addresses
const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";

// Asset IDs from frontend config
const ASSET_IDS = {
  spacex: "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab",
  bytedance: "0x7a8e8d0c5008129e8077f29f2b784b6f889f3420f121d5b70b5b3326476bbce1",
  openai: "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9",
  stripe: "0x8eddee8eb3ba76411ebdccf6d0ad00841d58a803916546a295c2b0346ea86a11",
  databricks: "0x0bf812f25cacc694be173fe6fd2b56e3f94f71dcee99e1f1280b2ce7fca46fca",
  anthropic: "0xee2176d5e35f81b98746f5f98677beb44f0167ae70b6518fbb5b5bdc65da8fdd",
};

async function main() {
  console.log("\n🔍 DEBUG: Oracle Asset Configuration\n");
  console.log("=".repeat(70));

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const oracleAbi = [
    "function isAssetTradeable(bytes32) view returns (bool)",
    "function getAssetPrice(bytes32) view returns (uint256)",
    "function owner() view returns (address)"
  ];

  const oracle = new ethers.Contract(SHADOW_ORACLE, oracleAbi, provider);

  console.log(`\n📋 Checking assets on Oracle: ${SHADOW_ORACLE}`);
  console.log("-".repeat(50));

  for (const [name, id] of Object.entries(ASSET_IDS)) {
    try {
      const isTradeable = await oracle.isAssetTradeable(id);
      const price = await oracle.getAssetPrice(id);
      const priceFormatted = ethers.formatUnits(price, 6);

      console.log(`   ${name.padEnd(12)} | ID: ${id.slice(0, 10)}... | Tradeable: ${isTradeable ? '✅' : '❌'} | Price: $${priceFormatted}`);
    } catch (error) {
      console.log(`   ${name.padEnd(12)} | ID: ${id.slice(0, 10)}... | ❌ Error: ${error}`);
    }
  }

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
