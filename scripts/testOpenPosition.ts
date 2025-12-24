/**
 * Test openPosition directly with FHE encryption
 * This simulates what the frontend does
 */

import { ethers } from "hardhat";

const SHADOW_VAULT = "0x6E1BE2fd9023FD8F3c9C27b35f57Aa74ec984E9c";  // NEW VAULT - Full redeploy
const ASSET_ID = "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9"; // OpenAI

const SHADOW_VAULT_ABI = [
  "function openPosition(bytes32 assetId, bytes32 encryptedCollateral, bytes32 encryptedLeverage, bytes32 encryptedIsLong, bytes calldata inputProof) external returns (uint256)"
];

async function main() {
  console.log("\n🧪 Testing ShadowVault.openPosition with FHE\n");
  console.log("=".repeat(70));

  const [signer] = await ethers.getSigners();
  console.log("Signer (simulating session wallet):", signer.address);

  // Initialize Relayer SDK
  console.log("\n📡 Initializing Relayer SDK...");
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const { createInstance, SepoliaConfig } = sdk;
  const fhevm = await createInstance(SepoliaConfig);
  console.log("✅ FHEVM instance created");

  // Create encrypted inputs
  console.log("\n🔐 Creating encrypted inputs for openPosition...");
  console.log("   Contract:", SHADOW_VAULT);
  console.log("   User:", signer.address);

  const input = fhevm.createEncryptedInput(SHADOW_VAULT, signer.address);
  input.add64(100 * 1000000);  // 100 sUSD collateral (6 decimals)
  input.add64(2);              // 2x leverage
  input.addBool(true);         // long

  console.log("⏳ Encrypting...");
  const encrypted = await input.encrypt();

  console.log("✅ Encryption successful!");
  console.log("   Handles: ", encrypted.handles.length);
  console.log("   Handle 0 (collateral):", "0x" + Buffer.from(encrypted.handles[0]).toString("hex"));
  console.log("   Handle 1 (leverage):", "0x" + Buffer.from(encrypted.handles[1]).toString("hex"));
  console.log("   Handle 2 (isLong):", "0x" + Buffer.from(encrypted.handles[2]).toString("hex"));
  console.log("   Proof length:", encrypted.inputProof.length, "bytes");

  // Create vault contract instance
  const vault = new ethers.Contract(SHADOW_VAULT, SHADOW_VAULT_ABI, signer);

  // Call openPosition
  console.log("\n📤 Calling openPosition...");
  console.log("   Asset ID:", ASSET_ID);

  try {
    // First try to estimate gas to get better error message
    console.log("⏳ Estimating gas...");
    try {
      const gasEstimate = await vault.openPosition.estimateGas(
        ASSET_ID,
        encrypted.handles[0],
        encrypted.handles[1],
        encrypted.handles[2],
        encrypted.inputProof
      );
      console.log("   Gas estimate:", gasEstimate.toString());
    } catch (estError: any) {
      console.log("❌ Gas estimation failed:");
      console.log("   Error:", estError.message?.slice(0, 500));

      // Try to decode the revert reason
      if (estError.data) {
        console.log("   Revert data:", estError.data);
      }
    }

    // Try to send anyway with high gas limit
    console.log("\n⏳ Sending transaction with fixed gas limit...");
    const tx = await vault.openPosition(
      ASSET_ID,
      encrypted.handles[0],
      encrypted.handles[1],
      encrypted.handles[2],
      encrypted.inputProof,
      { gasLimit: 15000000 }
    );

    console.log("   TX Hash:", tx.hash);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("\n✅ SUCCESS! Position opened!");
      console.log("   Gas used:", receipt.gasUsed.toString());
      console.log("   Block:", receipt.blockNumber);
    } else {
      console.log("\n❌ Transaction failed (status 0)");
    }
  } catch (error: any) {
    console.log("\n❌ Transaction REVERTED!");
    console.log("   Error:", error.message?.slice(0, 500));

    if (error.data) {
      console.log("   Revert data:", error.data);
    }

    console.log("\n💡 Possible causes:");
    console.log("   1. Signer doesn't have sUSD balance (call faucet first)");
    console.log("   2. FHE.fromExternal failing (proof verification)");
    console.log("   3. FHE.ge in ShadowUSD._transfer failing (ACL issue)");
    console.log("   4. Oracle.updateOpenInterest failing (ACL issue)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
