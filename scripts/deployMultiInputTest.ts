/**
 * Deploy MultiInputTest to Sepolia for multiple FHE.fromExternal testing
 */

import { ethers } from "hardhat";

async function main() {
  console.log("\n🚀 Deploying MultiInputTest to Sepolia\n");
  console.log("=".repeat(50));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  console.log("\n📦 Deploying MultiInputTest...");

  const MultiInputTest = await ethers.getContractFactory("MultiInputTest");
  const contract = await MultiInputTest.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ MultiInputTest deployed to:", address);

  console.log("\n" + "=".repeat(50));
  console.log("📋 NEXT STEPS:");
  console.log("=".repeat(50));
  console.log(`
1. Run the test script:
   npx hardhat run scripts/testMultiInputTest.ts --network sepolia

2. This tests if multiple FHE.fromExternal with same proof works
   - If testDoubleInput works but testTripleInput fails → ebool issue
   - If both fail → multiple fromExternal issue
   - If both work → issue is in cross-contract calls
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
