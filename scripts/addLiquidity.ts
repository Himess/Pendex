import { ethers } from "hardhat";

/**
 * Add Test Liquidity Script
 * Adds initial liquidity to the ShadowLiquidityPool for demo purposes
 */

const LP_ADDR = "0xB0a1fb939C017f17d79F6049A21b4b2fB9423d73";
const USD_ADDR = "0xa1FFdD728C13Eb72F928491d3E6D9245AE614cf6";

async function main() {
  console.log("💧 Adding Test Liquidity...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);

  // Get contracts
  const lp = await ethers.getContractAt("ShadowLiquidityPool", LP_ADDR);
  const usd = await ethers.getContractAt("ShadowUSD", USD_ADDR);

  // Check current pool stats
  console.log("\n📊 Current Pool Stats:");
  const stats = await lp.getPoolStats();
  console.log(`   Total Liquidity: $${Number(stats._totalLiquidity) / 1e6}`);
  console.log(`   Total LP Tokens: ${Number(stats._totalLpTokens) / 1e6}`);
  console.log(`   Current Utilization: $${Number(stats._currentUtilization) / 1e6}`);
  console.log(`   Utilization Rate: ${Number(stats._utilizationRate) / 100}%`);
  console.log(`   Current Epoch: ${stats._currentEpoch}`);

  // Amount to add (100,000 USD = 100_000_000_000 with 6 decimals)
  const AMOUNT = 100_000 * 1e6; // $100,000

  console.log(`\n💰 Adding $${AMOUNT / 1e6} liquidity...`);

  try {
    // Add liquidity
    const tx = await lp.addLiquidity(AMOUNT, { gasLimit: 500000 });
    console.log(`   TX: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`   ✅ Transaction confirmed! Gas used: ${receipt?.gasUsed}`);

    // Check updated stats
    console.log("\n📊 Updated Pool Stats:");
    const newStats = await lp.getPoolStats();
    console.log(`   Total Liquidity: $${Number(newStats._totalLiquidity) / 1e6}`);
    console.log(`   Total LP Tokens: ${Number(newStats._totalLpTokens) / 1e6}`);
    console.log(`   Current APY: ~${(await lp.getCurrentApy()) / 100}%`);

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);

    // If the error is about approval, try that first
    if (error.message.includes("approve") || error.message.includes("allowance")) {
      console.log("\n🔑 Trying to approve first...");
      try {
        const approveTx = await usd.approve(LP_ADDR, ethers.MaxUint256);
        await approveTx.wait();
        console.log("   ✅ Approved!");

        // Retry add liquidity
        const tx = await lp.addLiquidity(AMOUNT, { gasLimit: 500000 });
        await tx.wait();
        console.log("   ✅ Liquidity added!");
      } catch (approveError: any) {
        console.error(`   ❌ Approve error: ${approveError.message}`);
      }
    }
  }

  console.log("\n✅ Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
