"use client";

// ============================================
// FHEVM Relayer SDK Integration
// ============================================
// Uses @zama-fhe/relayer-sdk for real FHE operations on Sepolia
// Documentation: https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer

import {
  createInstance,
  SepoliaConfig,
  type FhevmInstance,
  type FhevmInstanceConfig,
  type HandleContractPair,
} from "@zama-fhe/relayer-sdk/web";

// Re-export types
export type { FhevmInstance, FhevmInstanceConfig, HandleContractPair };

// Singleton instance
let fhevmInstance: FhevmInstance | null = null;
let initializationPromise: Promise<FhevmInstance> | null = null;

// Manual Sepolia configuration (fallback if SepoliaConfig doesn't work)
// From: https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization
// Updated December 2025 - Zama updated their infrastructure
const SEPOLIA_MANUAL_CONFIG = {
  aclContractAddress: "0x687820221192C5B662b25367F70076A37bc79b6c" as const,
  kmsContractAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC" as const,
  inputVerifierContractAddress: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4" as const,
  verifyingContractAddressDecryption: "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1" as const,
  verifyingContractAddressInputVerification: "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F" as const,
  chainId: 11155111,
  gatewayChainId: 55815,
  network: "https://eth-sepolia.public.blastapi.io",
  relayerUrl: "https://relayer.testnet.zama.cloud",
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

  // Start initialization
  initializationPromise = (async () => {
    try {
      console.log("🔐 Initializing FHEVM Relayer SDK instance...");

      // Try using SepoliaConfig first (simpler approach)
      let instance: FhevmInstance;
      try {
        instance = await createInstance(SepoliaConfig);
        console.log("✅ FHEVM instance initialized with SepoliaConfig");
      } catch (sepoliaError) {
        console.warn("⚠️ SepoliaConfig failed, trying manual config:", sepoliaError);
        // Fallback to manual configuration
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
  const signature = await signer.signTypedData(
    eip712.domain,
    eip712.types,
    eip712.message
  );

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
