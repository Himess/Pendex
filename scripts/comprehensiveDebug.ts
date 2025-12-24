/**
 * Comprehensive debug script for FHE transaction failures
 * Checks all possible failure points
 */

import { ethers } from "hardhat";

const SHADOW_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";
const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";
const WALLET_MANAGER = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";

// Known addresses from failed transaction
const SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";

// Test asset ID (OpenAI)
const ASSET_ID = "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9";

const VAULT_ABI = [
  "function walletManager() view returns (address)",
  "function shadowUsd() view returns (address)",
  "function oracle() view returns (address)",
];

const WALLET_MANAGER_ABI = [
  "function isValidSession(address) view returns (bool)",
  "function getMainWallet(address) view returns (address)",
  "function hasSessionWallet(address) view returns (bool)",
];

const SHADOW_USD_ABI = [
  "function vault() view returns (address)",
  "function isBalanceInitialized(address) view returns (bool)",
];

const ORACLE_ABI = [
  "function isAssetTradeable(bytes32) view returns (bool)",
  "function authorizedContracts(address) view returns (bool)",
];

async function main() {
  console.log("\n🔍 COMPREHENSIVE DEBUG FOR FHE TRANSACTION FAILURE\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Debug runner:", deployer.address);

  // ====================
  // 1. CHECK CONTRACTS CONFIGURATION
  // ====================
  console.log("\n📋 1. CONTRACT CONFIGURATION\n");

  const vault = new ethers.Contract(SHADOW_VAULT, VAULT_ABI, deployer);
  const wm = new ethers.Contract(WALLET_MANAGER, WALLET_MANAGER_ABI, deployer);
  const susd = new ethers.Contract(SHADOW_USD, SHADOW_USD_ABI, deployer);

  const vaultWm = await vault.walletManager();
  const vaultSusd = await vault.shadowUsd();
  const vaultOracle = await vault.oracle();
  const susdVault = await susd.vault();

  console.log("Vault.walletManager:", vaultWm);
  console.log("   Expected:", WALLET_MANAGER);
  console.log("   Match:", vaultWm.toLowerCase() === WALLET_MANAGER.toLowerCase() ? "✅" : "❌");

  console.log("\nVault.shadowUsd:", vaultSusd);
  console.log("   Expected:", SHADOW_USD);
  console.log("   Match:", vaultSusd.toLowerCase() === SHADOW_USD.toLowerCase() ? "✅" : "❌");

  console.log("\nVault.oracle:", vaultOracle);
  console.log("   Expected:", SHADOW_ORACLE);
  console.log("   Match:", vaultOracle.toLowerCase() === SHADOW_ORACLE.toLowerCase() ? "✅" : "❌");

  console.log("\nShadowUSD.vault:", susdVault);
  console.log("   Expected:", SHADOW_VAULT);
  console.log("   Match:", susdVault.toLowerCase() === SHADOW_VAULT.toLowerCase() ? "✅" : "❌");

  // ====================
  // 2. CHECK SESSION WALLET
  // ====================
  console.log("\n📋 2. SESSION WALLET STATUS\n");

  const isValidSession = await wm.isValidSession(SESSION_WALLET);
  const resolvedMain = await wm.getMainWallet(SESSION_WALLET);
  const mainHasSession = await wm.hasSessionWallet(MAIN_WALLET);

  console.log("Session wallet:", SESSION_WALLET);
  console.log("   isValidSession:", isValidSession ? "✅ YES" : "❌ NO");
  console.log("   getMainWallet:", resolvedMain);
  console.log("   Expected main:", MAIN_WALLET);
  console.log("   Match:", resolvedMain.toLowerCase() === MAIN_WALLET.toLowerCase() ? "✅" : "❌");

  console.log("\nMain wallet:", MAIN_WALLET);
  console.log("   hasSessionWallet:", mainHasSession ? "✅ YES" : "❌ NO");

  // ====================
  // 3. CHECK sUSD BALANCE
  // ====================
  console.log("\n📋 3. sUSD BALANCE STATUS\n");

  const sessionBalanceInit = await susd.isBalanceInitialized(SESSION_WALLET);
  const mainBalanceInit = await susd.isBalanceInitialized(MAIN_WALLET);

  console.log("Session wallet sUSD:");
  console.log("   Balance initialized:", sessionBalanceInit ? "✅ YES" : "❌ NO");

  console.log("\nMain wallet sUSD:");
  console.log("   Balance initialized:", mainBalanceInit ? "✅ YES" : "❌ NO");

  // ====================
  // 4. CHECK ORACLE
  // ====================
  console.log("\n📋 4. ORACLE STATUS\n");

  const oracle2 = new ethers.Contract(SHADOW_ORACLE, ORACLE_ABI, deployer);
  const isAssetTradeable = await oracle2.isAssetTradeable(ASSET_ID);
  const isVaultAuthorized = await oracle2.authorizedContracts(SHADOW_VAULT);

  console.log("Asset (OpenAI):", ASSET_ID.slice(0, 20) + "...");
  console.log("   Is tradeable:", isAssetTradeable ? "✅ YES" : "❌ NO");

  console.log("\nVault authorization in Oracle:");
  console.log("   Is authorized:", isVaultAuthorized ? "✅ YES" : "❌ NO");

  // ====================
  // SUMMARY
  // ====================
  console.log("\n" + "=".repeat(70));
  console.log("📊 DIAGNOSIS SUMMARY");
  console.log("=".repeat(70));

  let issues: string[] = [];

  if (vaultWm.toLowerCase() !== WALLET_MANAGER.toLowerCase()) {
    issues.push("❌ Vault.walletManager mismatch");
  }
  if (vaultSusd.toLowerCase() !== SHADOW_USD.toLowerCase()) {
    issues.push("❌ Vault.shadowUsd mismatch");
  }
  if (vaultOracle.toLowerCase() !== SHADOW_ORACLE.toLowerCase()) {
    issues.push("❌ Vault.oracle mismatch");
  }
  if (susdVault.toLowerCase() !== SHADOW_VAULT.toLowerCase()) {
    issues.push("❌ ShadowUSD.vault mismatch - THIS WILL CAUSE VAULTDEPOSIT TO FAIL!");
  }
  if (!isValidSession) {
    issues.push("❌ Session wallet not valid");
  }
  if (resolvedMain.toLowerCase() !== MAIN_WALLET.toLowerCase()) {
    issues.push("❌ Session → Main mapping incorrect");
  }
  if (!mainBalanceInit) {
    issues.push("⚠️ Main wallet has NO sUSD balance initialized - needs faucet!");
  }
  if (sessionBalanceInit && !mainBalanceInit) {
    issues.push("⚠️ Session wallet has balance but Main wallet does NOT - faucet called from wrong address!");
  }
  if (!isAssetTradeable) {
    issues.push("❌ Asset not tradeable");
  }
  if (!isVaultAuthorized) {
    issues.push("❌ Vault not authorized in Oracle");
  }

  if (issues.length === 0) {
    console.log("\n✅ All checks passed! Configuration looks correct.\n");
    console.log("If transactions are still failing, the issue is likely:");
    console.log("1. FHE.fromExternal proof verification failing");
    console.log("2. Some other FHE operation failing (ACL issue)");
    console.log("3. Gas estimation issue");
  } else {
    console.log("\n❌ ISSUES FOUND:\n");
    for (const issue of issues) {
      console.log("   " + issue);
    }
  }

  // Special check for balance issue
  if (!mainBalanceInit && sessionBalanceInit) {
    console.log(`
⚠️ IMPORTANT: Balance Issue Detected!

The SESSION wallet has sUSD balance initialized, but the MAIN wallet does NOT.

When trading via session wallet:
1. Session wallet signs the transaction
2. Vault calls _resolveTrader() → returns MAIN wallet address
3. Vault tries to transfer sUSD FROM the MAIN wallet
4. But MAIN wallet has no balance!

FIX: Call faucet FROM the MAIN wallet, not the session wallet!
Or call faucet from the connected wallet in the frontend.
`);
  } else if (!mainBalanceInit && !sessionBalanceInit) {
    console.log(`
⚠️ IMPORTANT: No Balance Found!

Neither wallet has sUSD balance initialized.

FIX: Call the faucet function:
1. Connect with the MAIN wallet in the frontend
2. Click the faucet button to get test sUSD
`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
