import { ethers } from "hardhat";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const txHash = "0x911f1c14299e409ac45bc73e748a77e96d9a435d1cb48117ae9658e796c4e5ad";

  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    console.log("TX not found!");
    return;
  }

  console.log("TX Input Data:", tx.data);
  console.log("\nFunction Selector:", tx.data.slice(0, 10));

  // openPosition signature
  const openPositionSig = "openPosition(bytes32,bytes32,bytes32,bytes32,bytes)";
  const expectedSelector = ethers.id(openPositionSig).slice(0, 10);
  console.log("Expected selector for openPosition:", expectedSelector);

  // Decode parameters
  const iface = new ethers.Interface([
    "function openPosition(bytes32 assetId, bytes32 encryptedCollateral, bytes32 encryptedLeverage, bytes32 encryptedIsLong, bytes inputProof) returns (uint256)"
  ]);

  try {
    const decoded = iface.parseTransaction({ data: tx.data });
    if (decoded) {
      console.log("\n📝 DECODED PARAMETERS:");
      console.log("=".repeat(50));
      console.log("assetId:", decoded.args[0]);
      console.log("encryptedCollateral:", decoded.args[1]);
      console.log("encryptedLeverage:", decoded.args[2]);
      console.log("encryptedIsLong:", decoded.args[3]);
      console.log("inputProof length:", decoded.args[4].length, "bytes");
      console.log("inputProof (first 100 chars):", decoded.args[4].slice(0, 100));

      // Check asset ID
      const SPACEX_ID = "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab";
      console.log("\n🎯 ASSET CHECK:");
      console.log("Is SpaceX?", decoded.args[0].toLowerCase() === SPACEX_ID.toLowerCase());
    }
  } catch (e: any) {
    console.log("Decode error:", e.message);
  }

  // Get receipt for more details
  const receipt = await provider.getTransactionReceipt(txHash);
  if (receipt) {
    console.log("\n📊 TX RECEIPT:");
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Logs count:", receipt.logs.length);

    if (receipt.logs.length > 0) {
      console.log("\n📜 LOGS:");
      receipt.logs.forEach((log, i) => {
        console.log(`Log ${i}: ${log.address} - topics: ${log.topics.length}`);
      });
    }
  }
}

main().catch(console.error);
