import { ethers } from "hardhat";

async function main() {
  console.log("\n🔍 Debug Failed Transaction\n");
  console.log("TX: 0x911f1c14299e409ac45bc73e748a77e96d9a435d1cb48117ae9658e796c4e5ad");
  console.log("=".repeat(70));

  // Contract addresses
  const SHADOW_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";
  const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";
  const WALLET_MANAGER = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";
  const SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
  const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";
  const SPACEX_ASSET_ID = "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab";

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  // ABIs
  const vaultABI = [
    "function walletManager() view returns (address)",
    "function oracle() view returns (address)",
    "function shadowUsd() view returns (address)",
    "function liquidityPool() view returns (address)",
    "function positionCounter() view returns (uint256)",
  ];

  const wmABI = [
    "function isValidSession(address) view returns (bool)",
    "function getMainWallet(address) view returns (address)",
    "function isAllowedContract(address) view returns (bool)",
  ];

  const oracleABI = [
    "function isAssetTradeable(bytes32 assetId) view returns (bool)",
    "function authorizedContracts(address) view returns (bool)",
  ];

  const sUsdABI = [
    "function vault() view returns (address)",
    "function isBalanceInitialized(address) view returns (bool)",
    "function totalSupply() view returns (uint256)",
  ];

  const vault = new ethers.Contract(SHADOW_VAULT, vaultABI, provider);
  const wm = new ethers.Contract(WALLET_MANAGER, wmABI, provider);
  const oracle = new ethers.Contract(SHADOW_ORACLE, oracleABI, provider);
  const sUsd = new ethers.Contract(SHADOW_USD, sUsdABI, provider);

  console.log("\n1️⃣  VAULT CONTRACT REFERENCES");
  console.log("=".repeat(70));
  try {
    const vaultWM = await vault.walletManager();
    const vaultOracle = await vault.oracle();
    const vaultSUsd = await vault.shadowUsd();
    const vaultLP = await vault.liquidityPool();
    const positionCounter = await vault.positionCounter();

    console.log(`   walletManager: ${vaultWM}`);
    console.log(`   oracle: ${vaultOracle}`);
    console.log(`   shadowUsd: ${vaultSUsd}`);
    console.log(`   liquidityPool: ${vaultLP}`);
    console.log(`   positionCounter: ${positionCounter}`);

    if (vaultWM.toLowerCase() !== WALLET_MANAGER.toLowerCase()) {
      console.log("   ❌ WalletManager MISMATCH!");
    } else {
      console.log("   ✅ WalletManager correct");
    }
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  console.log("\n2️⃣  SESSION WALLET VALIDATION");
  console.log("=".repeat(70));
  try {
    const isValid = await wm.isValidSession(SESSION_WALLET);
    console.log(`   isValidSession(${SESSION_WALLET}): ${isValid}`);

    if (isValid) {
      const mainWallet = await wm.getMainWallet(SESSION_WALLET);
      console.log(`   getMainWallet: ${mainWallet}`);

      if (mainWallet.toLowerCase() !== MAIN_WALLET.toLowerCase()) {
        console.log("   ⚠️ Main wallet mismatch!");
        console.log(`      Expected: ${MAIN_WALLET}`);
      } else {
        console.log("   ✅ Correct main wallet mapping");
      }
    } else {
      console.log("   ❌ SESSION NOT VALID!");
    }

    const isVaultAllowed = await wm.isAllowedContract(SHADOW_VAULT);
    console.log(`   isAllowedContract(vault): ${isVaultAllowed}`);
    if (!isVaultAllowed) {
      console.log("   ❌ VAULT NOT ALLOWED IN WALLET MANAGER!");
    }
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  console.log("\n3️⃣  ORACLE CHECKS");
  console.log("=".repeat(70));
  try {
    const isTradeable = await oracle.isAssetTradeable(SPACEX_ASSET_ID);
    console.log(`   SpaceX tradeable: ${isTradeable}`);
    if (!isTradeable) {
      console.log("   ❌ ASSET NOT TRADEABLE!");
    }

    const isVaultAuthorized = await oracle.authorizedContracts(SHADOW_VAULT);
    console.log(`   Vault authorized in Oracle: ${isVaultAuthorized}`);
    if (!isVaultAuthorized) {
      console.log("   ❌ VAULT NOT AUTHORIZED IN ORACLE!");
    }
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  console.log("\n4️⃣  SHADOW USD CHECKS");
  console.log("=".repeat(70));
  try {
    const vaultInSUsd = await sUsd.vault();
    console.log(`   vault in ShadowUSD: ${vaultInSUsd}`);

    if (vaultInSUsd.toLowerCase() !== SHADOW_VAULT.toLowerCase()) {
      console.log("   ❌ VAULT ADDRESS MISMATCH IN SHADOWUSD!");
      console.log(`      Expected: ${SHADOW_VAULT}`);
    } else {
      console.log("   ✅ Correct vault in ShadowUSD");
    }

    const mainBalanceInit = await sUsd.isBalanceInitialized(MAIN_WALLET);
    console.log(`   Main wallet balance initialized: ${mainBalanceInit}`);
    if (!mainBalanceInit) {
      console.log("   ❌ MAIN WALLET HAS NO sUSD BALANCE!");
    }

    const totalSupply = await sUsd.totalSupply();
    console.log(`   Total sUSD supply: ${ethers.formatUnits(totalSupply, 6)}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 SUMMARY - POSSIBLE REVERT REASONS:");
  console.log("=".repeat(70));
  console.log(`
1. FHE.fromExternal() - Input proof validation failed
   → Session wallet address must match encryption user address

2. shadowUsd.vaultDeposit() - sUSD transfer failed
   → Check if main wallet has enough sUSD balance
   → Check if vault is set correctly in ShadowUSD

3. oracle.updateOpenInterest() - ACL permission denied
   → Even with allowTransient, Oracle might need something else

4. Leverage validation (1-10x) or collateral minimum
   → Check if leverage/collateral values are valid

5. FHE operation limit exceeded (HCU limit)
   → Too many FHE operations in single transaction
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
