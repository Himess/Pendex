import { ethers } from "hardhat";

async function main() {
  console.log("\n🔑 Deploying WalletManager for Session Wallet Support\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // Current contract addresses
  const SHADOW_VAULT_ADDRESS = "0x7a4D60498083Bc2dCC0490d0B95fc9D07940B0FD";

  // Deploy WalletManager (no constructor args - uses msg.sender as owner)
  console.log("\n1️⃣ Deploying WalletManager...");
  const WalletManager = await ethers.getContractFactory("WalletManager");
  const walletManager = await WalletManager.deploy();
  await walletManager.waitForDeployment();
  const walletManagerAddress = await walletManager.getAddress();
  console.log(`   ✅ WalletManager: ${walletManagerAddress}`);

  // Set WalletManager in ShadowVault
  console.log("\n2️⃣ Setting WalletManager in ShadowVault...");
  const ShadowVault = await ethers.getContractFactory("ShadowVault");
  const vault = ShadowVault.attach(SHADOW_VAULT_ADDRESS);

  try {
    const tx = await vault.setWalletManager(walletManagerAddress);
    await tx.wait();
    console.log("   ✅ WalletManager set in ShadowVault");
  } catch (error) {
    console.log("   ⚠️ Could not set WalletManager in ShadowVault (may need owner)");
    console.log("   Manual command: vault.setWalletManager('" + walletManagerAddress + "')");
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 WALLET MANAGER DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Address:");
  console.log(`   WalletManager: ${walletManagerAddress}`);
  console.log("\n📝 Update frontend/src/lib/session-wallet/manager.ts:");
  console.log(`   WALLET_MANAGER_ADDRESS = "${walletManagerAddress}"`);
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
