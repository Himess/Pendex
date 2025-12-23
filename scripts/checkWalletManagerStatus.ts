import { ethers } from "hardhat";

async function main() {
  console.log("\n🔍 WalletManager & ShadowVault Bağlantı Kontrolü\n");
  console.log("=".repeat(60));

  // Contract addresses (Session 9)
  const SHADOW_VAULT = "0x0EBC28B9e41474c015Aab15B9a2046F4d54FD3D6";
  const WALLET_MANAGER = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";
  const SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
  const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";

  // Minimal ABIs for view functions
  const vaultABI = [
    "function walletManager() view returns (address)",
    "function owner() view returns (address)",
  ];

  const walletManagerABI = [
    "function isValidSession(address sessionWallet) view returns (bool)",
    "function getMainWallet(address sessionWallet) view returns (address)",
    "function sessionToMain(address) view returns (address)",
    "function mainToSession(address) view returns (address)",
  ];

  // Connect to Sepolia
  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const vault = new ethers.Contract(SHADOW_VAULT, vaultABI, provider);
  const wm = new ethers.Contract(WALLET_MANAGER, walletManagerABI, provider);

  console.log("\n📋 Contract Adresleri:");
  console.log(`   ShadowVault:    ${SHADOW_VAULT}`);
  console.log(`   WalletManager:  ${WALLET_MANAGER}`);
  console.log(`   Session Wallet: ${SESSION_WALLET}`);
  console.log(`   Main Wallet:    ${MAIN_WALLET}`);

  // 1. Check ShadowVault.walletManager()
  console.log("\n" + "=".repeat(60));
  console.log("1️⃣  ShadowVault.walletManager() Kontrolü");
  console.log("=".repeat(60));

  try {
    const wmAddress = await vault.walletManager();
    console.log(`   Dönen değer: ${wmAddress}`);

    if (wmAddress === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ SORUN: WalletManager SET EDİLMEMİŞ!");
      console.log("   📝 Çözüm: vault.setWalletManager('0x547481AC8130e985288BD36Cb9ba81204656eB7A')");
    } else if (wmAddress.toLowerCase() === WALLET_MANAGER.toLowerCase()) {
      console.log("   ✅ WalletManager doğru ayarlanmış!");
    } else {
      console.log(`   ⚠️ Farklı WalletManager: ${wmAddress}`);
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // 1b. Check ShadowVault owner
  console.log("\n   📋 ShadowVault Owner:");
  try {
    const owner = await vault.owner();
    console.log(`   Owner: ${owner}`);
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // 2. Check WalletManager.isValidSession()
  console.log("\n" + "=".repeat(60));
  console.log("2️⃣  WalletManager.isValidSession() Kontrolü");
  console.log("=".repeat(60));

  try {
    const isValid = await wm.isValidSession(SESSION_WALLET);
    console.log(`   isValidSession(${SESSION_WALLET.slice(0, 10)}...): ${isValid}`);

    if (isValid) {
      console.log("   ✅ Session wallet kayıtlı ve geçerli!");
    } else {
      console.log("   ❌ SORUN: Session wallet kayıtlı DEĞİL veya geçersiz!");
      console.log("   📝 Çözüm: Session wallet WalletManager'a register edilmeli");
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // 3. Check WalletManager.sessionToMain() and getMainWallet()
  console.log("\n" + "=".repeat(60));
  console.log("3️⃣  WalletManager Session → Main Mapping Kontrolü");
  console.log("=".repeat(60));

  try {
    const mainFromSession = await wm.sessionToMain(SESSION_WALLET);
    console.log(`   sessionToMain(${SESSION_WALLET.slice(0, 10)}...): ${mainFromSession}`);

    if (mainFromSession === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ SORUN: Session → Main mapping boş!");
    } else if (mainFromSession.toLowerCase() === MAIN_WALLET.toLowerCase()) {
      console.log("   ✅ Doğru main wallet'a bağlı!");
    } else {
      console.log(`   ⚠️ Farklı main wallet: ${mainFromSession}`);
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // 4. Check reverse mapping (main → session)
  console.log("\n" + "=".repeat(60));
  console.log("4️⃣  WalletManager Main → Session Mapping Kontrolü");
  console.log("=".repeat(60));

  try {
    const sessionFromMain = await wm.mainToSession(MAIN_WALLET);
    console.log(`   mainToSession(${MAIN_WALLET.slice(0, 10)}...): ${sessionFromMain}`);

    if (sessionFromMain === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ SORUN: Main → Session mapping boş!");
    } else if (sessionFromMain.toLowerCase() === SESSION_WALLET.toLowerCase()) {
      console.log("   ✅ Doğru session wallet'a bağlı!");
    } else {
      console.log(`   ⚠️ Farklı session wallet: ${sessionFromMain}`);
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 ÖZET");
  console.log("=".repeat(60));
  console.log("\nKontrol tamamlandı. Yukarıdaki sonuçlara göre:");
  console.log("- ❌ işaretli olanlar düzeltilmeli");
  console.log("- ✅ işaretli olanlar doğru");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
