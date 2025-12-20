import { ethers } from "hardhat";

async function main() {
  const SHADOW_USD_ADDRESS = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const SHADOW_VAULT_ADDRESS = "0x7a4D60498083Bc2dCC0490d0B95fc9D07940B0FD";

  console.log("Setting vault address on ShadowUSD...");
  console.log(`ShadowUSD: ${SHADOW_USD_ADDRESS}`);
  console.log(`ShadowVault: ${SHADOW_VAULT_ADDRESS}`);

  const shadowUSD = await ethers.getContractAt("ShadowUSD", SHADOW_USD_ADDRESS);

  // Check current vault
  const currentVault = await shadowUSD.vault();
  console.log(`Current vault: ${currentVault}`);

  if (currentVault.toLowerCase() === SHADOW_VAULT_ADDRESS.toLowerCase()) {
    console.log("Vault already set correctly!");
    return;
  }

  // Set vault
  const tx = await shadowUSD.setVault(SHADOW_VAULT_ADDRESS);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  console.log("Vault set successfully!");

  // Verify
  const newVault = await shadowUSD.vault();
  console.log(`New vault: ${newVault}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
