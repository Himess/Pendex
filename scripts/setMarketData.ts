import { ethers } from "hardhat";

/**
 * Set Market Data Script
 * Sets Open Interest, Volume, and LP Pool for target Liquidity Scores
 *
 * Score Formula:
 * - LP Pool: (lpPoolSize * 40) / $10M = max 40 points
 * - Volume: (volume24h * 30) / $5M = max 30 points
 * - OI: (totalOI * 20) / $20M = max 20 points
 * - Activity: 10 points (if trade in last hour)
 * Total: 100 points max
 */

const ORACLE_ADDR = "0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81";

const ASSET_IDS: Record<string, string> = {
  OPENAI: "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9",
  ANTHROPIC: "0xee2176d5e35f81b98746f5f98677beb44f0167ae70b6518fbb5b5bdc65da8fdd",
  SPACEX: "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab",
  STRIPE: "0x8eddee8eb3ba76411ebdccf6d0ad00841d58a803916546a295c2b0346ea86a11",
  DATABRICKS: "0x0bf812f25cacc694be173fe6fd2b56e3f94f71dcee99e1f1280b2ce7fba46fca",
  BYTEDANCE: "0x7a8e8d0c5008129e8077f29f2b784b6f889f3420f121d5b70b5b3326476bbce1",
};

// Target scores and calculated values (in USD, will multiply by 1e6)
// Activity bonus (+10) will be added by updateMarketData call
const marketData = [
  { asset: "SPACEX",     targetScore: 88, lp: 7_500_000, vol: 4_600_000, oi: 20_000_000 },
  { asset: "OPENAI",     targetScore: 91, lp: 10_000_000, vol: 4_200_000, oi: 16_000_000 },
  { asset: "ANTHROPIC",  targetScore: 45, lp: 3_750_000, vol: 1_700_000, oi: 10_000_000 },
  { asset: "BYTEDANCE",  targetScore: 74, lp: 7_500_000, vol: 3_300_000, oi: 14_000_000 },
  { asset: "STRIPE",     targetScore: 15, lp: 500_000, vol: 300_000, oi: 1_000_000 },
  { asset: "DATABRICKS", targetScore: 61, lp: 6_250_000, vol: 2_500_000, oi: 11_000_000 },
];

async function main() {
  console.log("\n📊 Setting Market Data for Target Liquidity Scores\n");
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);

  const oracle = await ethers.getContractAt("ShadowOracle", ORACLE_ADDR);
  console.log(`📍 Oracle: ${ORACLE_ADDR}`);

  // Check/set authorization
  const isAuth = await oracle.authorizedContracts(deployer.address);
  if (!isAuth) {
    console.log("\n🔐 Authorizing deployer...");
    const authTx = await oracle.setAuthorizedContract(deployer.address, true);
    await authTx.wait();
    console.log("   ✅ Deployer authorized");
  }

  console.log("\n📈 Setting market data for each asset...\n");

  for (const data of marketData) {
    const assetId = ASSET_IDS[data.asset];
    if (!assetId) continue;

    console.log(`   ${data.asset} (target: ${data.targetScore}):`);

    try {
      // 1. Set LP Pool Size
      const lpSize = BigInt(data.lp) * BigInt(1e6);
      const lpTx = await oracle.updateLpPoolSize(assetId, lpSize);
      await lpTx.wait();
      console.log(`      LP Pool: $${data.lp.toLocaleString()}`);

      // 2. Set Volume via updateMarketData (also triggers activity bonus)
      const volSize = BigInt(data.vol) * BigInt(1e6);
      const price = 100 * 1e6; // dummy price
      const volTx = await oracle.updateMarketData(assetId, price, volSize);
      await volTx.wait();
      console.log(`      Volume:  $${data.vol.toLocaleString()}`);

      // 3. Set OI
      const currentOI = await oracle.getTotalOI(assetId);
      const targetOI = BigInt(data.oi) * BigInt(1e6);
      const currentOIBig = BigInt(currentOI.toString());

      if (targetOI > currentOIBig) {
        const delta = targetOI - currentOIBig;
        const halfDelta = delta / BigInt(2);
        const oiTx = await oracle.updateOpenInterestLegacy(assetId, halfDelta, halfDelta, true);
        await oiTx.wait();
      } else if (targetOI < currentOIBig) {
        const delta = currentOIBig - targetOI;
        const halfDelta = delta / BigInt(2);
        const oiTx = await oracle.updateOpenInterestLegacy(assetId, halfDelta, halfDelta, false);
        await oiTx.wait();
      }
      console.log(`      OI:      $${data.oi.toLocaleString()}`);

      // Verify final score
      const [score, category] = await oracle.getLiquidityScore(assetId);
      console.log(`      ✅ Score: ${score} (${category})`);
      console.log();

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}\n`);
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
