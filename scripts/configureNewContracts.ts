/**
 * Configure the new contracts after deployment
 */

import { ethers } from "hardhat";

// NEW contract addresses
const SHADOW_ORACLE = "0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81";
const SHADOW_USD = "0x6ABe3F3791B4Cee0f47dA1F10B4106c50C0EE6BC";
const SHADOW_LP = "0x548F8CbA6Fa4717BC6890D0f3175094c1FEeaa87";
const SHADOW_VAULT = "0x6E1BE2fd9023FD8F3c9C27b35f57Aa74ec984E9c";

async function main() {
  console.log("\n⚙️ Configuring new contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. Authorize vault in Oracle
  console.log("\n1️⃣ Authorizing ShadowVault in Oracle...");
  const oracleAbi = [
    "function setAuthorizedContract(address _contract, bool _authorized) external",
    "function authorizedContracts(address) view returns (bool)"
  ];
  const oracle = new ethers.Contract(SHADOW_ORACLE, oracleAbi, deployer);

  const isAuthorized = await oracle.authorizedContracts(SHADOW_VAULT);
  if (!isAuthorized) {
    const tx = await oracle.setAuthorizedContract(SHADOW_VAULT, true);
    await tx.wait();
    console.log("   ✅ ShadowVault authorized in Oracle");
  } else {
    console.log("   ✅ Already authorized");
  }

  // 2. Deploy WalletManager if needed (using new contracts)
  console.log("\n2️⃣ Deploying new WalletManager...");
  const WalletManager = await ethers.getContractFactory("WalletManager");
  const wm = await WalletManager.deploy();  // No constructor args
  await wm.waitForDeployment();
  const wmAddress = await wm.getAddress();
  console.log("   ✅ WalletManager deployed:", wmAddress);

  // 3. Set WalletManager in ShadowVault
  console.log("\n3️⃣ Setting WalletManager in ShadowVault...");
  const vaultAbi = [
    "function setWalletManager(address _walletManager) external",
    "function walletManager() view returns (address)"
  ];
  const vault = new ethers.Contract(SHADOW_VAULT, vaultAbi, deployer);
  const tx = await vault.setWalletManager(wmAddress);
  await tx.wait();
  console.log("   ✅ WalletManager set in ShadowVault");

  // 4. Set ShadowVault as allowed in WalletManager
  console.log("\n4️⃣ Setting ShadowVault as allowed in WalletManager...");
  const wmAbi = [
    "function setAllowedContract(address _contract, bool _allowed) external"
  ];
  const walletManager = new ethers.Contract(wmAddress, wmAbi, deployer);
  const tx2 = await walletManager.setAllowedContract(SHADOW_VAULT, true);
  await tx2.wait();
  console.log("   ✅ ShadowVault allowed in WalletManager");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ CONFIGURATION COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log(`   ShadowOracle:        ${SHADOW_ORACLE}`);
  console.log(`   ShadowUSD:           ${SHADOW_USD}`);
  console.log(`   ShadowLiquidityPool: ${SHADOW_LP}`);
  console.log(`   ShadowVault:         ${SHADOW_VAULT}`);
  console.log(`   WalletManager:       ${wmAddress}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
