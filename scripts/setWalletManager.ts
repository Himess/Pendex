import { ethers } from "hardhat";

async function main() {
  console.log("\n🔧 Setting WalletManager in ShadowVault\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Signer: ${deployer.address}`);

  const SHADOW_VAULT_ADDRESS = "0x7a4D60498083Bc2dCC0490d0B95fc9D07940B0FD";
  const WALLET_MANAGER_ADDRESS = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";

  // Get ShadowVault contract
  const ShadowVault = await ethers.getContractFactory("ShadowVault");
  const vault = ShadowVault.attach(SHADOW_VAULT_ADDRESS);

  console.log(`ShadowVault: ${SHADOW_VAULT_ADDRESS}`);
  console.log(`WalletManager: ${WALLET_MANAGER_ADDRESS}`);

  try {
    console.log("\n📝 Calling setWalletManager...");
    const tx = await vault.setWalletManager(WALLET_MANAGER_ADDRESS);
    console.log(`TX Hash: ${tx.hash}`);
    await tx.wait();
    console.log("✅ WalletManager set successfully!");
  } catch (error: any) {
    console.error("❌ Error:", error.message);

    // Check if function exists on deployed contract
    console.log("\n⚠️ The deployed ShadowVault may not have setWalletManager function.");
    console.log("You may need to redeploy ShadowVault with the updated code.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
