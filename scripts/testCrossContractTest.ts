/**
 * Test cross-contract FHE calls
 * This simulates exactly what ShadowVault does with ShadowUSD
 */

import { ethers } from "hardhat";

const MOCK_VAULT_ADDRESS = "0x8C5fe1a141c86cA62D3aae170804A138f3a64ED2";

const MOCK_VAULT_ABI = [
  "function testCrossContractFHE(bytes32 encryptedAmount, bytes calldata inputProof) external"
];

async function main() {
  if (!MOCK_VAULT_ADDRESS) {
    console.log("❌ Please deploy CrossContractTest first and update MOCK_VAULT_ADDRESS");
    console.log("   Run: npx hardhat run scripts/deployCrossContractTest.ts --network sepolia");
    return;
  }

  console.log("\n🧪 Testing Cross-Contract FHE Calls\n");
  console.log("=".repeat(70));
  console.log("This simulates ShadowVault → ShadowUSD flow:");
  console.log("1. User calls Vault with encrypted amount");
  console.log("2. Vault calls FHE.fromExternal()");
  console.log("3. Vault calls FHE.allowTransient() to Token");
  console.log("4. Vault calls Token.vaultDeposit() with encrypted amount");
  console.log("5. Token does FHE.ge(balance, amount) - THE CRITICAL PART");
  console.log("=".repeat(70));

  const [signer] = await ethers.getSigners();
  console.log("\nSigner:", signer.address);

  // Initialize Relayer SDK
  console.log("\n📡 Initializing Relayer SDK...");
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const { createInstance, SepoliaConfig } = sdk;
  const fhevm = await createInstance(SepoliaConfig);
  console.log("✅ FHEVM instance created");

  const vault = new ethers.Contract(MOCK_VAULT_ADDRESS, MOCK_VAULT_ABI, signer);

  // Create encrypted amount
  console.log("\n🔐 Creating encrypted input...");
  const input = fhevm.createEncryptedInput(MOCK_VAULT_ADDRESS, signer.address);
  input.add64(100 * 1000000); // 100 tokens with 6 decimals

  console.log("⏳ Encrypting...");
  const encrypted = await input.encrypt();

  console.log("✅ Encryption successful!");
  console.log("   Handle:", "0x" + Buffer.from(encrypted.handles[0]).toString("hex"));
  console.log("   Proof length:", encrypted.inputProof.length, "bytes");

  // Call the vault
  console.log("\n📤 Calling testCrossContractFHE...");

  try {
    const tx = await vault.testCrossContractFHE(
      encrypted.handles[0],
      encrypted.inputProof,
      { gasLimit: 5000000 }
    );

    console.log("⏳ TX submitted:", tx.hash);
    console.log("   Waiting for confirmation...");

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("\n✅ CROSS-CONTRACT FHE WORKS!");
      console.log("   Gas used:", receipt.gasUsed.toString());
      console.log("\n🎉 This means the issue is NOT with allowTransient!");
      console.log("   Something else in ShadowVault is failing.");
    } else {
      console.log("\n❌ Transaction failed (status 0)");
    }
  } catch (error: any) {
    console.log("\n❌ CROSS-CONTRACT FHE FAILED!");
    console.log("   Error:", error.message?.slice(0, 300));

    console.log("\n💡 This confirms the issue is with cross-contract FHE calls!");
    console.log("   Possible causes:");
    console.log("   1. allowTransient doesn't work as expected");
    console.log("   2. ACL check fails for the balance FHE.ge() operation");
    console.log("   3. Infrastructure issue with cross-contract FHE");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
