/**
 * Decode the last failed transaction to analyze the input data
 */

import { ethers } from "hardhat";

const SHADOW_VAULT_ABI = [
  "function openPosition(bytes32 assetId, bytes32 encryptedCollateral, bytes32 encryptedLeverage, bytes32 encryptedIsLong, bytes calldata inputProof)"
];

const TX_HASH = "0x8f4816af0f89c7c1d6ee1b5bd18121f8b340ad3f92be384c3bafb196045cef66";

async function main() {
  console.log("\n🔍 Decoding Failed Transaction\n");
  console.log("=".repeat(70));

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const tx = await provider.getTransaction(TX_HASH);

  if (!tx) {
    console.log("Transaction not found!");
    return;
  }

  console.log(`TX Hash: ${TX_HASH}`);
  console.log(`From: ${tx.from}`);
  console.log(`To: ${tx.to}`);
  console.log(`Data Length: ${tx.data.length} chars`);
  console.log(`Gas Limit: ${tx.gasLimit}`);

  // First 4 bytes = function selector
  const selector = tx.data.slice(0, 10);
  console.log(`\nFunction Selector: ${selector}`);

  // Calculate expected selector for openPosition
  const iface = new ethers.Interface(SHADOW_VAULT_ABI);
  const expectedSelector = iface.getFunction("openPosition")?.selector;
  console.log(`Expected Selector: ${expectedSelector}`);
  console.log(`Selector Match: ${selector === expectedSelector ? '✅ YES' : '❌ NO'}`);

  // Decode the calldata
  try {
    const decoded = iface.parseTransaction({ data: tx.data });

    if (decoded) {
      console.log(`\n📋 Decoded Arguments:`);
      console.log(`   assetId: ${decoded.args[0]}`);
      console.log(`   encryptedCollateral: ${decoded.args[1]}`);
      console.log(`   encryptedLeverage: ${decoded.args[2]}`);
      console.log(`   encryptedIsLong: ${decoded.args[3]}`);
      console.log(`   inputProof length: ${(decoded.args[4] as string).length} chars`);
      console.log(`   inputProof (first 200): ${(decoded.args[4] as string).slice(0, 200)}...`);

      // Check if handles look valid (should be 32 bytes = 64 hex chars + 0x)
      const collateralHandle = decoded.args[1] as string;
      const leverageHandle = decoded.args[2] as string;
      const isLongHandle = decoded.args[3] as string;

      console.log(`\n📋 Handle Analysis:`);
      console.log(`   Collateral handle length: ${collateralHandle.length} (expected 66)`);
      console.log(`   Leverage handle length: ${leverageHandle.length} (expected 66)`);
      console.log(`   IsLong handle length: ${isLongHandle.length} (expected 66)`);

      // Check if they're all zeros (invalid)
      const allZeros = "0x" + "0".repeat(64);
      console.log(`   Collateral is all zeros: ${collateralHandle === allZeros ? '❌ YES (invalid!)' : '✅ NO'}`);
      console.log(`   Leverage is all zeros: ${leverageHandle === allZeros ? '❌ YES (invalid!)' : '✅ NO'}`);
      console.log(`   IsLong is all zeros: ${isLongHandle === allZeros ? '❌ YES (invalid!)' : '✅ NO'}`);
    }
  } catch (e) {
    console.log(`\n❌ Error decoding: ${e}`);

    // Manual decode attempt
    console.log(`\n📋 Raw Data Analysis:`);
    console.log(`   Raw data (first 500): ${tx.data.slice(0, 500)}...`);
  }

  // Get transaction trace if possible
  try {
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    if (receipt) {
      console.log(`\n📋 Receipt:`);
      console.log(`   Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Gas Used: ${receipt.gasUsed}`);
      console.log(`   Logs: ${receipt.logs.length}`);
    }
  } catch (e) {
    console.log(`Error getting receipt: ${e}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
