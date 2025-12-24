/**
 * Check if Vault is authorized in Oracle
 */

import { ethers } from "hardhat";

const SHADOW_ORACLE_ADDRESS = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";
const FRONTEND_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";

const SHADOW_ORACLE_ABI = [
  "function authorizedContracts(address) external view returns (bool)",
  "function owner() external view returns (address)"
];

async function main() {
  console.log("\n🔍 Checking Oracle Authorization\n");
  console.log("=".repeat(60));

  const oracle = new ethers.Contract(
    SHADOW_ORACLE_ADDRESS,
    SHADOW_ORACLE_ABI,
    await ethers.provider.getSigner()
  );

  const isVaultAuthorized = await oracle.authorizedContracts(FRONTEND_VAULT);
  const oracleOwner = await oracle.owner();

  console.log("Oracle address:", SHADOW_ORACLE_ADDRESS);
  console.log("Oracle owner:", oracleOwner);
  console.log("\n📋 Authorization check:");
  console.log("   Vault address:", FRONTEND_VAULT);
  console.log("   Is authorized:", isVaultAuthorized ? "✅ YES" : "❌ NO");

  if (!isVaultAuthorized) {
    console.log(`
❌ VAULT IS NOT AUTHORIZED IN ORACLE!

The vault at ${FRONTEND_VAULT} cannot call:
- oracle.updateOpenInterest()
- oracle.updateMarketData()

The transaction will revert with "Not authorized" when trying to open/close positions.

SOLUTION:
Run: await oracle.setAuthorizedContract("${FRONTEND_VAULT}", true)
`);
  } else {
    console.log("\n✅ Vault is authorized in Oracle");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
