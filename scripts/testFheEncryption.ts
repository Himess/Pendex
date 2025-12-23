/**
 * Test FHE Encryption Flow
 *
 * This script tests if FHE encryption is working correctly by:
 * 1. Creating encrypted values using the SDK
 * 2. Simulating what the contract would receive
 * 3. Checking if the addresses and proofs look correct
 */

import { ethers } from "hardhat";

// Minimal FhevmInstance type for testing
interface EncryptedInput {
  add64(value: bigint): void;
  addBool(value: boolean): void;
  encrypt(): Promise<{
    handles: Uint8Array[];
    inputProof: Uint8Array;
  }>;
}

interface FhevmInstance {
  createEncryptedInput(contractAddress: string, userAddress: string): EncryptedInput;
}

// Convert Uint8Array to hex string
function toHexString(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  console.log("\n🔍 Testing FHE Encryption Flow\n");
  console.log("=".repeat(70));

  // Contract and wallet addresses
  const SHADOW_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";
  const SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
  const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";

  console.log("\n📍 ADDRESSES:");
  console.log(`   ShadowVault: ${SHADOW_VAULT}`);
  console.log(`   Session Wallet: ${SESSION_WALLET}`);
  console.log(`   Main Wallet: ${MAIN_WALLET}`);

  // Try to import and use the Relayer SDK
  console.log("\n📦 Loading Zama Relayer SDK...");

  try {
    // Dynamic import for the SDK
    const sdk = await import("@zama-fhe/relayer-sdk");
    const { createInstance, SepoliaConfig, initSDK } = sdk;

    console.log("\n📋 SepoliaConfig from SDK:");
    console.log(JSON.stringify(SepoliaConfig, null, 2));

    // Initialize SDK
    console.log("\n🔄 Initializing SDK...");
    await initSDK();
    console.log("✅ SDK initialized");

    // Create instance
    console.log("\n📡 Creating FhevmInstance with SepoliaConfig...");
    const instance = await createInstance(SepoliaConfig) as FhevmInstance;
    console.log("✅ FhevmInstance created");

    // Test encryption
    console.log("\n🔐 Testing encryption...");
    console.log(`   Contract Address: ${SHADOW_VAULT}`);
    console.log(`   User Address (msg.sender): ${SESSION_WALLET}`);

    const input = instance.createEncryptedInput(SHADOW_VAULT, SESSION_WALLET);

    // Add test values (same as what openPosition would use)
    const testCollateral = BigInt(1000 * 1e6); // $1000 with 6 decimals
    const testLeverage = BigInt(2); // 2x leverage
    const testIsLong = true;

    console.log(`   Collateral: ${testCollateral}`);
    console.log(`   Leverage: ${testLeverage}`);
    console.log(`   IsLong: ${testIsLong}`);

    input.add64(testCollateral);
    input.add64(testLeverage);
    input.addBool(testIsLong);

    console.log("\n⏳ Encrypting values (this calls the relayer)...");
    const encrypted = await input.encrypt();

    console.log("\n✅ Encryption successful!");
    console.log(`   Handle 0 (collateral): ${toHexString(encrypted.handles[0])}`);
    console.log(`   Handle 1 (leverage): ${toHexString(encrypted.handles[1])}`);
    console.log(`   Handle 2 (isLong): ${toHexString(encrypted.handles[2])}`);
    console.log(`   Input Proof Length: ${encrypted.inputProof.length} bytes`);
    console.log(`   Input Proof (first 100 chars): ${toHexString(encrypted.inputProof).slice(0, 100)}...`);

    // Now let's check if we can call the contract
    console.log("\n📞 Testing contract call simulation...");

    const provider = new ethers.JsonRpcProvider(
      "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
    );

    // Get the session wallet's code (should be 0x for EOA)
    const sessionCode = await provider.getCode(SESSION_WALLET);
    console.log(`   Session wallet code: ${sessionCode} (should be 0x for EOA)`);

    // Get session wallet balance
    const sessionBalance = await provider.getBalance(SESSION_WALLET);
    console.log(`   Session wallet ETH balance: ${ethers.formatEther(sessionBalance)} ETH`);

    // Check if vault exists
    const vaultCode = await provider.getCode(SHADOW_VAULT);
    console.log(`   Vault has code: ${vaultCode !== "0x" ? "YES" : "NO"}`);

    console.log("\n" + "=".repeat(70));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(70));
    console.log(`
If encryption succeeded but the transaction reverts, possible issues:
1. msg.sender mismatch - Session wallet must sign the TX
2. Contract address mismatch - Vault address must match encryption
3. Proof format issue - SDK version or config mismatch
4. Network issue - Gateway/Relayer connection problem

The encrypted values above should work if:
- TX is signed by: ${SESSION_WALLET}
- TX is sent to: ${SHADOW_VAULT}
`);

  } catch (error) {
    console.error("\n❌ Error:", error);

    if (error instanceof Error && error.message.includes("Cannot find module")) {
      console.log("\n💡 The Relayer SDK might not be installed in this project.");
      console.log("   This script is meant to verify the SDK configuration.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
