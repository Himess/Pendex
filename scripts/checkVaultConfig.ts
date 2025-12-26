/**
 * Check if ShadowUSD has the correct vault configured
 */

import { ethers } from "hardhat";

const SHADOW_USD_ADDRESS = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
const FRONTEND_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";
const SESSION_8_VAULT = "0x7a4D60498083Bc2dCC0490d0B95fc9D07940B0FD";

const SHADOW_USD_ABI = [
  "function vault() external view returns (address)"
];

async function main() {
  console.log("\n🔍 Checking Vault Configuration\n");
  console.log("=".repeat(60));

  const sUSD = new ethers.Contract(
    SHADOW_USD_ADDRESS,
    SHADOW_USD_ABI,
    await ethers.provider.getSigner()
  );

  const currentVault = await sUSD.vault();

  console.log("ShadowUSD address:", SHADOW_USD_ADDRESS);
  console.log("\n📋 Vault addresses:");
  console.log("   Current vault in ShadowUSD:", currentVault);
  console.log("   Frontend using (Session 10):", FRONTEND_VAULT);
  console.log("   Session 8 vault:", SESSION_8_VAULT);

  console.log("\n📋 Comparison:");

  if (currentVault.toLowerCase() === FRONTEND_VAULT.toLowerCase()) {
    console.log("   ✅ ShadowUSD vault matches frontend config");
  } else {
    console.log("   ❌ ShadowUSD vault DOES NOT match frontend!");
    console.log("   This means vaultDeposit() calls will fail with 'Only vault'");
  }

  if (currentVault.toLowerCase() === SESSION_8_VAULT.toLowerCase()) {
    console.log("   ✅ ShadowUSD vault matches Session 8 config");
  } else {
    console.log("   ❌ ShadowUSD vault DOES NOT match Session 8 config");
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 DIAGNOSIS:");
  console.log("=".repeat(60));

  if (currentVault.toLowerCase() !== FRONTEND_VAULT.toLowerCase()) {
    console.log(`
❌ THE PROBLEM IS FOUND!

The frontend is trying to call vault at: ${FRONTEND_VAULT}
But ShadowUSD has vault set to: ${currentVault}

When the vault calls shadowUsd.vaultDeposit(), it fails because:
  require(msg.sender == vault, "Only vault") → FAILS!

SOLUTION:
1. Either update ShadowUSD to point to the frontend vault:
   await sUSD.setVault("${FRONTEND_VAULT}")

2. Or update frontend to use the configured vault:
   shadowVault: "${currentVault}"
`);
  } else {
    console.log(`
✅ Vault configuration looks correct.
The issue must be elsewhere - check:
1. WalletManager configuration
2. Oracle authorization
3. User's sUSD balance
`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
