/**
 * Deploy SimpleCounter to Sepolia for FHE.fromExternal testing
 */

import { ethers } from "hardhat";

async function main() {
  console.log("\n🚀 Deploying SimpleCounter to Sepolia\n");
  console.log("=".repeat(50));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  console.log("\n📦 Deploying SimpleCounter...");

  const SimpleCounter = await ethers.getContractFactory("SimpleCounter");
  const counter = await SimpleCounter.deploy();

  await counter.waitForDeployment();

  const address = await counter.getAddress();
  console.log("✅ SimpleCounter deployed to:", address);

  console.log("\n" + "=".repeat(50));
  console.log("📋 NEXT STEPS:");
  console.log("=".repeat(50));
  console.log(`
1. Run the test script:
   npx hardhat run scripts/testSimpleCounter.ts --network sepolia

2. Or test from frontend using this address:
   ${address}

3. If this works, the issue is in ShadowVault contract
   If this fails, the issue is infrastructure/SDK mismatch
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
