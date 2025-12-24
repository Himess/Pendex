/**
 * Test simple Oracle functions to see if contract is working
 */

import { ethers } from "hardhat";

const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";

async function main() {
  console.log("\n🔍 Testing Oracle Simple Functions\n");

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  // Try minimal ABI with just constants and simple views
  const oracleAbi = [
    "function owner() view returns (address)",
    "function PRICE_PRECISION() view returns (uint64)",
    "function MAX_DEMAND_MODIFIER() view returns (uint64)",
    "function getAllAssetIds() view returns (bytes32[])",
    "function pendingOwner() view returns (address)"
  ];

  const oracle = new ethers.Contract(SHADOW_ORACLE, oracleAbi, provider);

  console.log(`Oracle: ${SHADOW_ORACLE}\n`);

  // Test 1: owner()
  console.log("Testing owner()...");
  try {
    const owner = await oracle.owner();
    console.log(`  ✅ owner(): ${owner}`);
  } catch (e) {
    console.log(`  ❌ owner() failed:`, e);
  }

  // Test 2: PRICE_PRECISION()
  console.log("\nTesting PRICE_PRECISION()...");
  try {
    const precision = await oracle.PRICE_PRECISION();
    console.log(`  ✅ PRICE_PRECISION(): ${precision}`);
  } catch (e) {
    console.log(`  ❌ PRICE_PRECISION() failed:`, e);
  }

  // Test 3: getAllAssetIds()
  console.log("\nTesting getAllAssetIds()...");
  try {
    const assetIds = await oracle.getAllAssetIds();
    console.log(`  ✅ getAllAssetIds(): ${assetIds.length} assets`);
    for (const id of assetIds) {
      console.log(`     - ${id}`);
    }
  } catch (e) {
    console.log(`  ❌ getAllAssetIds() failed:`, e);
  }

  // Test 4: pendingOwner()
  console.log("\nTesting pendingOwner()...");
  try {
    const pending = await oracle.pendingOwner();
    console.log(`  ✅ pendingOwner(): ${pending}`);
  } catch (e) {
    console.log(`  ❌ pendingOwner() failed:`, e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
