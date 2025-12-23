"use client";

// ============================================
// FHEVM Relayer SDK Integration
// ============================================
// Uses @zama-fhe/relayer-sdk for real FHE operations on Sepolia
// Documentation: https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer

// Types are imported statically for TypeScript
import type {
  FhevmInstance,
  FhevmInstanceConfig,
  HandleContractPair,
} from "@zama-fhe/relayer-sdk/web";

// Re-export types
export type { FhevmInstance, FhevmInstanceConfig, HandleContractPair };

// Singleton instance
let fhevmInstance: FhevmInstance | null = null;
let initializationPromise: Promise<FhevmInstance> | null = null;
let sdkInitialized = false;

// Manual Sepolia configuration (fallback if SepoliaConfig doesn't work)
// From: https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization
// Updated with latest contract addresses from Zama docs
const SEPOLIA_MANUAL_CONFIG = {
  aclContractAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D" as const,
  kmsContractAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A" as const,
  inputVerifierContractAddress: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0" as const,
  verifyingContractAddressDecryption: "0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478" as const,
  verifyingContractAddressInputVerification: "0x483b9dE06E4E4C7D35CCf5837A1668487406D955" as const,
  chainId: 11155111,
  gatewayChainId: 10901, // Correct gateway chain ID (from Zama docs & FHEIGHT)
  network: "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a",
  relayerUrl: "https://relayer.testnet.zama.org",
};

/**
 * Initialize the FHEVM instance using Relayer SDK
 * Must be called before any encryption operations
 *
 * Two options:
 * 1. SepoliaConfig - Uses predefined Sepolia configuration
 * 2. Manual config - Uses explicit contract addresses
 */
export async function initFheInstance(): Promise<FhevmInstance> {
  // Return existing instance if available
  if (fhevmInstance) {
    return fhevmInstance;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization with dynamic import
  initializationPromise = (async () => {
    try {
      console.log("🔐 Initializing FHEVM Relayer SDK instance...");

      // Dynamic import to avoid SSR/WASM issues
      const sdk = await import("@zama-fhe/relayer-sdk/web");
      const { createInstance, SepoliaConfig, initSDK } = sdk;

      // CRITICAL: Initialize WASM modules first before createInstance
      if (!sdkInitialized) {
        console.log("🔄 Initializing WASM modules via initSDK()...");
        try {
          await initSDK();
          sdkInitialized = true;
          console.log("✅ WASM modules initialized successfully");
        } catch (wasmError) {
          console.warn("⚠️ initSDK warning (may be already initialized):", wasmError);
          sdkInitialized = true; // Continue anyway, might already be initialized
        }
      }

      // Try using SepoliaConfig first (simpler approach)
      let instance: FhevmInstance;
      try {
        console.log("📡 Attempting createInstance with SepoliaConfig...");
        instance = await createInstance(SepoliaConfig);
        console.log("✅ FHEVM instance initialized with SepoliaConfig");
      } catch (sepoliaError) {
        console.warn("⚠️ SepoliaConfig failed, trying manual config:", sepoliaError);
        // Fallback to manual configuration
        console.log("📡 Attempting createInstance with manual config...");
        instance = await createInstance(SEPOLIA_MANUAL_CONFIG);
        console.log("✅ FHEVM instance initialized with manual config");
      }

      fhevmInstance = instance;
      console.log("🔐 FHEVM Relayer SDK ready for encryption operations");
      return instance;
    } catch (error) {
      console.error("❌ Failed to initialize FHEVM instance:", error);
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Get the FHEVM instance (must be initialized first)
 */
export function getFheInstance(): FhevmInstance {
  if (!fhevmInstance) {
    throw new Error("FHEVM instance not initialized. Call initFheInstance() first.");
  }
  return fhevmInstance;
}

/**
 * Check if FHEVM is initialized
 */
export function isFheInitialized(): boolean {
  return fhevmInstance !== null;
}

/**
 * Convert Uint8Array to hex string
 */
function toHexString(bytes: Uint8Array): `0x${string}` {
  return ("0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

/**
 * Encrypt a uint64 value for contract interaction
 */
export async function encryptUint64(
  value: bigint | number,
  contractAddress: string,
  userAddress: string
): Promise<{ encryptedAmount: `0x${string}`; inputProof: `0x${string}` }> {
  const instance = getFheInstance();

  // Create encrypted input
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(BigInt(value));

  // Encrypt and get handles + proof
  const encrypted = await input.encrypt();

  return {
    encryptedAmount: toHexString(encrypted.handles[0]),
    inputProof: toHexString(encrypted.inputProof),
  };
}

/**
 * Encrypt a boolean value
 */
export async function encryptBool(
  value: boolean,
  contractAddress: string,
  userAddress: string
): Promise<{ encryptedBool: `0x${string}`; inputProof: `0x${string}` }> {
  const instance = getFheInstance();

  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.addBool(value);

  const encrypted = await input.encrypt();

  return {
    encryptedBool: toHexString(encrypted.handles[0]),
    inputProof: toHexString(encrypted.inputProof),
  };
}

/**
 * Encrypt position parameters (collateral, leverage, isLong) with shared proof
 */
export async function encryptPositionParams(
  collateral: bigint | number,
  leverage: bigint | number,
  isLong: boolean,
  contractAddress: string,
  userAddress: string
): Promise<{
  encryptedCollateral: `0x${string}`;
  encryptedLeverage: `0x${string}`;
  encryptedIsLong: `0x${string}`;
  inputProof: `0x${string}`;
}> {
  const instance = getFheInstance();

  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(BigInt(collateral));
  input.add64(BigInt(leverage));
  input.addBool(isLong);

  const encrypted = await input.encrypt();

  return {
    encryptedCollateral: toHexString(encrypted.handles[0]),
    encryptedLeverage: toHexString(encrypted.handles[1]),
    encryptedIsLong: toHexString(encrypted.handles[2]),
    inputProof: toHexString(encrypted.inputProof),
  };
}

/**
 * Encrypt multiple uint64 values with a shared proof
 */
export async function encryptMultipleUint64(
  values: (bigint | number)[],
  contractAddress: string,
  userAddress: string
): Promise<{ encryptedValues: `0x${string}`[]; inputProof: `0x${string}` }> {
  const instance = getFheInstance();

  const input = instance.createEncryptedInput(contractAddress, userAddress);

  for (const value of values) {
    input.add64(BigInt(value));
  }

  const encrypted = await input.encrypt();

  return {
    encryptedValues: encrypted.handles.map(h => toHexString(h)),
    inputProof: toHexString(encrypted.inputProof),
  };
}

/**
 * Request user decryption of encrypted values
 * Uses EIP-712 signature for authorization
 *
 * NEW SDK API (v0.3+):
 * - generateKeypair() → { publicKey, privateKey }
 * - createEIP712(publicKey, contractAddresses, startTimeStamp, durationDays)
 * - userDecrypt(handleContractPairs, privateKey, publicKey, signature, contractAddresses, signerAddress, startTimeStamp, durationDays)
 */
export async function requestUserDecryption(
  handles: { handle: `0x${string}`; contractAddress: string }[],
  userAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any
): Promise<Record<string, bigint | boolean | `0x${string}`>> {
  const instance = getFheInstance();

  // Generate keypair for decryption
  const keypair = instance.generateKeypair();

  // Get contract addresses from handles
  const contractAddresses = Array.from(new Set(handles.map((h) => h.contractAddress)));

  // Time parameters for EIP-712 signature
  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = "1"; // 1 day validity

  // Create EIP-712 message for reencryption authorization (NEW API)
  const eip712 = instance.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimeStamp,
    durationDays
  );

  // Sign the EIP-712 message
  // Viem uses object format, not separate parameters like ethers.js
  const signature = await signer.signTypedData({
    domain: eip712.domain,
    types: eip712.types,
    primaryType: eip712.primaryType,
    message: eip712.message,
  });

  // Prepare handle-contract pairs for userDecrypt
  // HandleContractPair expects handle as string or Uint8Array
  const handleContractPairs: HandleContractPair[] = handles.map(({ handle, contractAddress }) => ({
    handle: handle, // hex string is accepted
    contractAddress,
  }));

  try {
    // Use new userDecrypt API
    const results = await instance.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      userAddress,
      startTimeStamp,
      durationDays
    );

    // Convert results to expected format
    // Results keys are `0x${string}` format
    const formattedResults: Record<string, bigint | boolean | `0x${string}`> = {};
    for (const { handle } of handles) {
      // Try both original handle and lowercase version
      const result = results[handle as `0x${string}`] ?? results[handle.toLowerCase() as `0x${string}`];
      if (result !== undefined) {
        formattedResults[handle] = result;
      }
    }
    return formattedResults;
  } catch (error) {
    console.error("❌ userDecrypt failed:", error);
    throw error;
  }
}

/**
 * Decrypt a single encrypted value
 * Uses new Relayer SDK userDecrypt API
 */
export async function decryptValue(
  handle: `0x${string}`,
  contractAddress: string,
  userAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any
): Promise<bigint> {
  const results = await requestUserDecryption(
    [{ handle, contractAddress }],
    userAddress,
    signer
  );

  const result = results[handle];
  if (result === undefined) {
    throw new Error(`Failed to decrypt handle: ${handle}`);
  }

  return BigInt(result.toString());
}

/**
 * Encrypt an Ethereum address for anonymous trading
 */
export async function encryptAddress(
  address: string,
  contractAddress: string,
  userAddress: string
): Promise<{ encryptedAddress: `0x${string}`; inputProof: `0x${string}` }> {
  const instance = getFheInstance();

  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.addAddress(address);

  const encrypted = await input.encrypt();

  return {
    encryptedAddress: toHexString(encrypted.handles[0]),
    inputProof: toHexString(encrypted.inputProof),
  };
}

/**
 * Encrypt various integer sizes (8, 16, 32, 64)
 */
export async function encryptUint(
  value: bigint | number,
  bits: 8 | 16 | 32 | 64,
  contractAddress: string,
  userAddress: string
): Promise<{ encryptedValue: `0x${string}`; inputProof: `0x${string}` }> {
  const instance = getFheInstance();

  const input = instance.createEncryptedInput(contractAddress, userAddress);

  switch (bits) {
    case 8:
      input.add8(Number(value));
      break;
    case 16:
      input.add16(Number(value));
      break;
    case 32:
      input.add32(Number(value));
      break;
    case 64:
      input.add64(BigInt(value));
      break;
  }

  const encrypted = await input.encrypt();

  return {
    encryptedValue: toHexString(encrypted.handles[0]),
    inputProof: toHexString(encrypted.inputProof),
  };
}
