/**
 * Check WalletManager configuration in Vault
 */

import { ethers } from "hardhat";

const SHADOW_VAULT_ADDRESS = "0x1713d51049EA31c19545De7f47AcB909e1050a71";
const WALLET_MANAGER_ADDRESS = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";

const SHADOW_VAULT_ABI = [
  "function walletManager() external view returns (address)",
  "function shadowUsd() external view returns (address)",
  "function oracle() external view returns (address)"
];

async function main() {
  console.log("\n🔍 Checking Vault Configuration\n");
  console.log("=".repeat(60));

  const vault = new ethers.Contract(
    SHADOW_VAULT_ADDRESS,
    SHADOW_VAULT_ABI,
    await ethers.provider.getSigner()
  );

  const configuredWalletManager = await vault.walletManager();
  const configuredShadowUsd = await vault.shadowUsd();
  const configuredOracle = await vault.oracle();

  console.log("Vault address:", SHADOW_VAULT_ADDRESS);
  console.log("\n📋 Vault configuration:");
  console.log("   walletManager:", configuredWalletManager);
  console.log("   shadowUsd:", configuredShadowUsd);
  console.log("   oracle:", configuredOracle);

  console.log("\n📋 Expected values:");
  console.log("   walletManager (expected):", WALLET_MANAGER_ADDRESS);
  console.log("   shadowUsd (expected):", "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18");
  console.log("   oracle (expected):", "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE");

  console.log("\n📋 Comparison:");

  const wmMatch = configuredWalletManager.toLowerCase() === WALLET_MANAGER_ADDRESS.toLowerCase();
  const susdMatch = configuredShadowUsd.toLowerCase() === "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18".toLowerCase();
  const oracleMatch = configuredOracle.toLowerCase() === "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE".toLowerCase();

  console.log("   WalletManager:", wmMatch ? "✅ Match" : "❌ MISMATCH");
  console.log("   ShadowUSD:", susdMatch ? "✅ Match" : "❌ MISMATCH");
  console.log("   Oracle:", oracleMatch ? "✅ Match" : "❌ MISMATCH");

  if (!wmMatch || !susdMatch || !oracleMatch) {
    console.log("\n❌ Configuration mismatch found!");
  } else {
    console.log("\n✅ All vault configurations are correct!");
  }

  // Check if wallet manager is zero address
  if (configuredWalletManager === "0x0000000000000000000000000000000000000000") {
    console.log("\n⚠️ WalletManager is NOT set (zero address)!");
    console.log("   This means session wallet resolution will just return msg.sender");
    console.log("   This should still work if user is trading directly (not via session wallet)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
