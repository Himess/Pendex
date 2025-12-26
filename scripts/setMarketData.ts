import { ethers } from "hardhat";

/**
 * Set Market Data Script
 * Sets Open Interest for demo/video purposes
 * Liquidity Score is calculated dynamically from OI + volume
 */

// Current contract addresses
const ORACLE_ADDR = "0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81";

// Asset IDs (keccak256 hashes)
const ASSET_IDS: Record<string, string> = {
  OPENAI: "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9",
  ANTHROPIC: "0xee2176d5e35f81b98746f5f98677beb44f0167ae70b6518fbb5b5bdc65da8fdd",
  SPACEX: "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab",
  STRIPE: "0x8eddee8eb3ba76411ebdccf6d0ad00841d58a803916546a295c2b0346ea86a11",
  DATABRICKS: "0x0bf812f25cacc694be173fe6fd2b56e3f94f71dcee99e1f1280b2ce7fba46fca",
  BYTEDANCE: "0x7a8e8d0c5008129e8077f29f2b784b6f889f3420f121d5b70b5b3326476bbce1",
};

// Market data to set (OI in USD with 6 decimals)
const marketData = [
  { asset: "SPACEX", oi: 8_000_000, targetLs: 75 },
  { asset: "OPENAI", oi: 12_000_000, targetLs: 82 },
  { asset: "ANTHROPIC", oi: 5_000_000, targetLs: 68 },
  { asset: "BYTEDANCE", oi: 10_000_000, targetLs: 78 },
  { asset: "STRIPE", oi: 6_000_000, targetLs: 65 },
  { asset: "DATABRICKS", oi: 4_000_000, targetLs: 58 },
];

async function main() {
  console.log("\n📊 Setting Market Data for Demo\n");
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);

  // Get Oracle contract
  const oracle = await ethers.getContractAt("ShadowOracle", ORACLE_ADDR);
  console.log(`📍 Oracle: ${ORACLE_ADDR}`);

  // Check if deployer is authorized
  const isAuth = await oracle.authorizedContracts(deployer.address);
  console.log(`🔑 Deployer authorized: ${isAuth}`);

  // Authorize deployer if needed
  if (!isAuth) {
    console.log("\n🔐 Authorizing deployer...");
    const authTx = await oracle.setAuthorizedContract(deployer.address, true);
    await authTx.wait();
    console.log("   ✅ Deployer authorized");
  }

  console.log("\n📈 Setting Open Interest for each asset...\n");

  for (const data of marketData) {
    const assetId = ASSET_IDS[data.asset];
    if (!assetId) {
      console.log(`   ⚠️  ${data.asset}: Asset ID not found, skipping`);
      continue;
    }

    try {
      // Get current OI
      const currentOI = await oracle.getTotalOI(assetId);
      console.log(`   ${data.asset}:`);
      console.log(`      Current OI: $${Number(currentOI) / 1e6}`);
      console.log(`      Target OI:  $${data.oi}`);

      // Calculate delta (convert to 6 decimals)
      const targetOI = BigInt(data.oi) * BigInt(1e6);
      const currentOIBig = BigInt(currentOI.toString());

      if (targetOI > currentOIBig) {
        // Need to increase
        const delta = targetOI - currentOIBig;
        const halfDelta = delta / BigInt(2);

        console.log(`      Increasing by: $${Number(delta) / 1e6}`);

        const tx = await oracle.updateOpenInterestLegacy(
          assetId,
          halfDelta,  // longDelta
          halfDelta,  // shortDelta (balanced)
          true        // isIncrease
        );
        await tx.wait();
        console.log(`      ✅ Updated`);
      } else if (targetOI < currentOIBig) {
        // Need to decrease
        const delta = currentOIBig - targetOI;
        const halfDelta = delta / BigInt(2);

        console.log(`      Decreasing by: $${Number(delta) / 1e6}`);

        const tx = await oracle.updateOpenInterestLegacy(
          assetId,
          halfDelta,
          halfDelta,
          false  // isIncrease = false
        );
        await tx.wait();
        console.log(`      ✅ Updated`);
      } else {
        console.log(`      ⏭️  Already at target`);
      }

      // Verify new OI
      const newOI = await oracle.getTotalOI(assetId);
      console.log(`      New OI: $${Number(newOI) / 1e6}`);

      // Get liquidity score
      const [ls, cat] = await oracle.getLiquidityScore(assetId);
      console.log(`      Liquidity Score: ${ls} (${cat === 0 ? "LOW" : cat === 1 ? "MEDIUM" : "HIGH"})`);
      console.log();

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
    }
  }

  console.log("=".repeat(60));
  console.log("✅ Market data setup complete!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
