import { ethers } from "hardhat";

async function main() {
  console.log("\n🔍 Trade Revert Debug\n");
  console.log("=".repeat(60));

  // Addresses
  const SHADOW_VAULT = "0x0EBC28B9e41474c015Aab15B9a2046F4d54FD3D6";
  const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";
  const WALLET_MANAGER = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";
  const SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
  const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";

  // SpaceX asset ID
  const SPACEX_ASSET_ID = "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab";

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  // ABIs
  const oracleABI = ["function isAssetTradeable(bytes32 assetId) view returns (bool)"];
  const vaultABI = [
    "function walletManager() view returns (address)",
    "function oracle() view returns (address)",
    "function shadowUsd() view returns (address)",
  ];
  const wmABI = [
    "function isValidSession(address) view returns (bool)",
    "function getMainWallet(address) view returns (address)",
  ];
  const sUsdABI = [
    "function vault() view returns (address)",
    "function isBalanceInitialized(address) view returns (bool)",
  ];

  const oracle = new ethers.Contract(SHADOW_ORACLE, oracleABI, provider);
  const vault = new ethers.Contract(SHADOW_VAULT, vaultABI, provider);
  const wm = new ethers.Contract(WALLET_MANAGER, wmABI, provider);
  const sUsd = new ethers.Contract(SHADOW_USD, sUsdABI, provider);

  console.log("\n1️⃣  Oracle Check");
  console.log("=".repeat(60));
  try {
    const isTradeable = await oracle.isAssetTradeable(SPACEX_ASSET_ID);
    console.log(`   SpaceX tradeable: ${isTradeable}`);
    if (!isTradeable) {
      console.log("   ❌ SORUN: Asset tradeable DEĞİL!");
    } else {
      console.log("   ✅ Asset tradeable");
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  console.log("\n2️⃣  Vault Contract References");
  console.log("=".repeat(60));
  try {
    const vaultWM = await vault.walletManager();
    const vaultOracle = await vault.oracle();
    const vaultSUsd = await vault.shadowUsd();

    console.log(`   walletManager: ${vaultWM}`);
    console.log(`   oracle: ${vaultOracle}`);
    console.log(`   shadowUsd: ${vaultSUsd}`);

    if (vaultWM.toLowerCase() !== WALLET_MANAGER.toLowerCase()) {
      console.log("   ❌ WalletManager YANLIŞ!");
    }
    if (vaultOracle.toLowerCase() !== SHADOW_ORACLE.toLowerCase()) {
      console.log("   ❌ Oracle YANLIŞ!");
    }
    if (vaultSUsd.toLowerCase() !== SHADOW_USD.toLowerCase()) {
      console.log("   ❌ ShadowUSD YANLIŞ!");
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  console.log("\n3️⃣  Session Wallet Check");
  console.log("=".repeat(60));
  try {
    const isValid = await wm.isValidSession(SESSION_WALLET);
    console.log(`   isValidSession: ${isValid}`);

    if (isValid) {
      const mainWallet = await wm.getMainWallet(SESSION_WALLET);
      console.log(`   mainWallet: ${mainWallet}`);

      if (mainWallet.toLowerCase() !== MAIN_WALLET.toLowerCase()) {
        console.log("   ⚠️ Main wallet eşleşmiyor!");
      } else {
        console.log("   ✅ Doğru main wallet'a bağlı");
      }
    } else {
      console.log("   ❌ SORUN: Session geçerli DEĞİL!");
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  console.log("\n4️⃣  ShadowUSD Check");
  console.log("=".repeat(60));
  try {
    const vaultAddr = await sUsd.vault();
    console.log(`   vault in ShadowUSD: ${vaultAddr}`);

    if (vaultAddr.toLowerCase() !== SHADOW_VAULT.toLowerCase()) {
      console.log("   ❌ SORUN: Vault adresi YANLIŞ!");
    } else {
      console.log("   ✅ Vault doğru set edilmiş");
    }

    const mainBalanceInit = await sUsd.isBalanceInitialized(MAIN_WALLET);
    console.log(`   Main wallet balance initialized: ${mainBalanceInit}`);

    if (!mainBalanceInit) {
      console.log("   ❌ SORUN: Main wallet'ta sUSD bakiyesi YOK!");
    } else {
      console.log("   ✅ Bakiye initialized");
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  console.log("\n5️⃣  Function Selector Check");
  console.log("=".repeat(60));

  // Calculate function selector for openPosition
  const iface = new ethers.Interface([
    "function openPosition(bytes32 assetId, bytes32 encryptedCollateral, bytes32 encryptedLeverage, bytes32 encryptedIsLong, bytes inputProof) returns (uint256)"
  ]);
  const selector = iface.getFunction("openPosition")?.selector;
  console.log(`   Expected selector (bytes32 types): ${selector}`);
  console.log(`   Actual selector from TX: 0xfe2514ba`);

  if (selector === "0xfe2514ba") {
    console.log("   ✅ Selector eşleşiyor");
  } else {
    console.log("   ⚠️ Selector FARKLI - ABI güncel değil olabilir!");
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 ÖZET");
  console.log("=".repeat(60));
  console.log("\nOlası revert sebepleri:");
  console.log("1. FHE.fromExternal() - InputProof geçersiz");
  console.log("2. Leverage validation - 1-10 arası değil");
  console.log("3. sUSD balance check - Encrypted comparison failed");
  console.log("4. ACL permission - FHE.allow eksik");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
