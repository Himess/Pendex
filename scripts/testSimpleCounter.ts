/**
 * Test SimpleCounter with FHE.fromExternal
 *
 * This script tests if FHE.fromExternal works with the Relayer SDK
 */

import { ethers } from "hardhat";

// You'll need to update this after deploying
const SIMPLE_COUNTER_ADDRESS = "0x4FE42d98b2DBA557585f0a8f757866178688BC31";

const SIMPLE_COUNTER_ABI = [
  "function increment(bytes32 inputEuint32, bytes calldata inputProof) external",
  "function decrement(bytes32 inputEuint32, bytes calldata inputProof) external",
  "function getCount() external view returns (bytes32)"
];

async function main() {
  if (!SIMPLE_COUNTER_ADDRESS) {
    console.log("❌ Please deploy SimpleCounter first and update SIMPLE_COUNTER_ADDRESS");
    console.log("   Run: npx hardhat run scripts/deploySimpleCounter.ts --network sepolia");
    return;
  }

  console.log("\n🧪 Testing SimpleCounter FHE.fromExternal\n");
  console.log("=".repeat(60));

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Initialize Relayer SDK
  console.log("\n📡 Initializing Relayer SDK...");

  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const { createInstance, SepoliaConfig } = sdk;
  console.log("✅ SDK imported (node version)");

  const fhevm = await createInstance(SepoliaConfig);
  console.log("✅ FHEVM instance created with SepoliaConfig");

  // Log the config being used
  console.log("\n📋 SepoliaConfig:");
  console.log("   chainId:", SepoliaConfig.chainId);
  console.log("   gatewayChainId:", SepoliaConfig.gatewayChainId);
  console.log("   aclContractAddress:", SepoliaConfig.aclContractAddress);
  console.log("   inputVerifierContractAddress:", SepoliaConfig.inputVerifierContractAddress);

  // Create encrypted input
  console.log("\n🔐 Creating encrypted input...");
  console.log("   Contract:", SIMPLE_COUNTER_ADDRESS);
  console.log("   User:", signer.address);

  const input = fhevm.createEncryptedInput(SIMPLE_COUNTER_ADDRESS, signer.address);
  input.add32(1); // Add value 1

  console.log("⏳ Encrypting...");
  const encrypted = await input.encrypt();

  console.log("✅ Encryption successful!");
  console.log("   Handle:", "0x" + Buffer.from(encrypted.handles[0]).toString("hex"));
  console.log("   Proof length:", encrypted.inputProof.length, "bytes");

  // Call increment
  console.log("\n📤 Calling increment...");

  const counter = new ethers.Contract(SIMPLE_COUNTER_ADDRESS, SIMPLE_COUNTER_ABI, signer);

  try {
    const tx = await counter.increment(
      encrypted.handles[0],
      encrypted.inputProof,
      { gasLimit: 5000000 }
    );

    console.log("⏳ TX submitted:", tx.hash);
    console.log("   Waiting for confirmation...");

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("\n✅ SUCCESS! FHE.fromExternal WORKS!");
      console.log("   Gas used:", receipt.gasUsed.toString());
      console.log("\n🎉 The issue is NOT with the SDK/infrastructure!");
      console.log("   The problem is likely in your ShadowVault contract.");
    } else {
      console.log("\n❌ Transaction failed (status 0)");
    }
  } catch (error) {
    console.log("\n❌ Transaction reverted!");
    console.log("   Error:", error);
    console.log("\n💡 This confirms the SDK/Coprocessor mismatch issue.");
    console.log("   The infrastructure doesn't support FHE.fromExternal currently.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
