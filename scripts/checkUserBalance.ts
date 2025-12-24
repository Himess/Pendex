/**
 * Check if a specific user has sUSD balance
 */

import { ethers } from "hardhat";

const SHADOW_USD = "0x6ABe3F3791B4Cee0f47dA1F10B4106c50C0EE6BC";  // NEW
const USER_ADDRESS = "0xd28c2f90e483E75077DA119659a2f31b1a5B5f88";

const SHADOW_USD_ABI = [
  "function isBalanceInitialized(address) view returns (bool)",
  "function totalSupply() view returns (uint256)"
];

async function main() {
  console.log("\n🔍 Checking sUSD balance for:", USER_ADDRESS);

  const [deployer] = await ethers.getSigners();
  const susd = new ethers.Contract(SHADOW_USD, SHADOW_USD_ABI, deployer);

  const isInit = await susd.isBalanceInitialized(USER_ADDRESS);
  console.log("Balance initialized:", isInit ? "✅ YES" : "❌ NO");

  const totalSupply = await susd.totalSupply();
  console.log("\nTotal sUSD supply:", ethers.formatUnits(totalSupply, 6));

  if (!isInit) {
    console.log("\n⚠️ Bu kullanıcının yeni ShadowUSD'de bakiyesi YOK!");
    console.log("   Faucet'ten sUSD alması gerekiyor.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
