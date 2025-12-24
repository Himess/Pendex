/**
 * Check if deployer has sUSD balance
 */

import { ethers } from "hardhat";

const SHADOW_USD = "0x6ABe3F3791B4Cee0f47dA1F10B4106c50C0EE6BC";  // NEW

const SHADOW_USD_ABI = [
  "function isBalanceInitialized(address) view returns (bool)",
  "function faucet(uint64 amount) external",
  "function totalSupply() view returns (uint256)"
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🔍 Checking sUSD balance for:", deployer.address);

  const susd = new ethers.Contract(SHADOW_USD, SHADOW_USD_ABI, deployer);

  const isInit = await susd.isBalanceInitialized(deployer.address);
  console.log("Balance initialized:", isInit ? "✅ YES" : "❌ NO");

  if (!isInit) {
    console.log("\n💰 Calling faucet to get 1000 sUSD...");
    const tx = await susd.faucet(1000n * 1000000n); // 1000 sUSD with 6 decimals
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✅ Faucet called successfully!");

    const isInitAfter = await susd.isBalanceInitialized(deployer.address);
    console.log("Balance initialized after faucet:", isInitAfter ? "✅ YES" : "❌ NO");
  }

  const totalSupply = await susd.totalSupply();
  console.log("\nTotal sUSD supply:", ethers.formatUnits(totalSupply, 6));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
