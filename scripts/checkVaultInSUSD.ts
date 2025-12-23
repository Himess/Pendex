import { ethers } from "hardhat";

async function main() {
  console.log("\n🔍 ShadowUSD Vault Adresi Kontrolü\n");
  console.log("=".repeat(60));

  // Contract addresses
  const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const SHADOW_VAULT_NEW = "0x0EBC28B9e41474c015Aab15B9a2046F4d54FD3D6"; // Session 9
  const SHADOW_VAULT_OLD = "0x7a4D60498083Bc2dCC0490d0B95fc9D07940B0FD"; // Session 8
  const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";

  const sUsdABI = [
    "function vault() view returns (address)",
    "function owner() view returns (address)",
    "function isBalanceInitialized(address) view returns (bool)",
    "function totalSupply() view returns (uint256)",
  ];

  // Connect to Sepolia
  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const sUSD = new ethers.Contract(SHADOW_USD, sUsdABI, provider);

  // 1. Check vault address in ShadowUSD
  console.log("\n1️⃣  ShadowUSD.vault() Kontrolü");
  console.log("=".repeat(60));

  try {
    const vaultInSUSD = await sUSD.vault();
    console.log(`   ShadowUSD'deki vault adresi: ${vaultInSUSD}`);
    console.log(`   Session 9 ShadowVault:       ${SHADOW_VAULT_NEW}`);
    console.log(`   Session 8 ShadowVault:       ${SHADOW_VAULT_OLD}`);

    if (vaultInSUSD.toLowerCase() === SHADOW_VAULT_NEW.toLowerCase()) {
      console.log("\n   ✅ Vault adresi DOĞRU! (Session 9)");
    } else if (vaultInSUSD.toLowerCase() === SHADOW_VAULT_OLD.toLowerCase()) {
      console.log("\n   ❌ SORUN: ESKİ vault adresi set edilmiş! (Session 8)");
      console.log("   📝 Çözüm: sUSD.setVault('0x0EBC28B9e41474c015Aab15B9a2046F4d54FD3D6')");
    } else if (vaultInSUSD === "0x0000000000000000000000000000000000000000") {
      console.log("\n   ❌ SORUN: Vault adresi SET EDİLMEMİŞ!");
      console.log("   📝 Çözüm: sUSD.setVault('0x0EBC28B9e41474c015Aab15B9a2046F4d54FD3D6')");
    } else {
      console.log(`\n   ⚠️ BİLİNMEYEN vault adresi: ${vaultInSUSD}`);
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // 2. Check ShadowUSD owner
  console.log("\n2️⃣  ShadowUSD Owner");
  console.log("=".repeat(60));

  try {
    const owner = await sUSD.owner();
    console.log(`   Owner: ${owner}`);
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // 3. Check if main wallet has initialized balance
  console.log("\n3️⃣  Main Wallet Balance Initialized?");
  console.log("=".repeat(60));

  try {
    const isInit = await sUSD.isBalanceInitialized(MAIN_WALLET);
    console.log(`   Main wallet (${MAIN_WALLET.slice(0, 10)}...)`);
    console.log(`   Balance initialized: ${isInit}`);

    if (!isInit) {
      console.log("\n   ❌ SORUN: Main wallet'ta sUSD bakiyesi YOK!");
      console.log("   📝 Çözüm: Faucet'ten sUSD al: sUSD.faucet(10000000000)  // 10,000 sUSD");
    } else {
      console.log("\n   ✅ Bakiye initialized");
    }
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // 4. Check total supply
  console.log("\n4️⃣  Total Supply");
  console.log("=".repeat(60));

  try {
    const totalSupply = await sUSD.totalSupply();
    console.log(`   Total Supply: ${ethers.formatUnits(totalSupply, 6)} sUSD`);
  } catch (e: any) {
    console.log(`   ❌ Hata: ${e.message}`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 ÖZET - Olası Fail Sebepleri:");
  console.log("=".repeat(60));
  console.log("1. ShadowUSD.vault != Session 9 ShadowVault → 'Only vault' hatası");
  console.log("2. Main wallet balance not initialized → 'Insufficient balance' hatası");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
