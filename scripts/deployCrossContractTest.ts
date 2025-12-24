/**
 * Deploy CrossContractTest contracts to Sepolia
 */

import { ethers } from "hardhat";

async function main() {
  console.log("\n🚀 Deploying CrossContractTest to Sepolia\n");
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy MockToken
  console.log("\n📦 Deploying MockTokenForTest...");
  const MockToken = await ethers.getContractFactory("MockTokenForTest");
  const token = await MockToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ MockToken deployed to:", tokenAddress);

  // Deploy MockVault
  console.log("\n📦 Deploying MockVaultForTest...");
  const MockVault = await ethers.getContractFactory("MockVaultForTest");
  const vault = await MockVault.deploy(tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ MockVault deployed to:", vaultAddress);

  // Set vault address in token
  console.log("\n📦 Setting vault in token...");
  const setVaultTx = await token.setVault(vaultAddress);
  await setVaultTx.wait();
  console.log("✅ Vault set in token");

  // Mint tokens to deployer
  console.log("\n📦 Minting 10000 tokens to deployer...");
  const mintTx = await token.mint(deployer.address, 10000n * 1000000n); // 10000 with 6 decimals
  await mintTx.wait();
  console.log("✅ Tokens minted to deployer");

  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`
MockToken: ${tokenAddress}
MockVault: ${vaultAddress}

Update testCrossContractTest.ts with MockVault address:
const MOCK_VAULT_ADDRESS = "${vaultAddress}";
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
