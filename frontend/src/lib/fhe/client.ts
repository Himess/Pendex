"use client";

// ============================================
// FHEVM Client SDK Integration
// ============================================
// Uses @zama-fhe/relayer-sdk for real FHE operations on Sepolia

import { createInstance, FhevmInstance } from "fhevmjs";

// Re-export FhevmInstance type
export type { FhevmInstance };

// Singleton instance
let fhevmInstance: FhevmInstance | null = null;
let initializationPromise: Promise<FhevmInstance> | null = null;

// Sepolia FHE configuration (Zama's deployed contracts on Sepolia)
// These addresses are from Zama's official Sepolia deployment
const SEPOLIA_CONFIG = {
  networkUrl: "https://sepolia.infura.io/v3/84842078b09946638c03157f83405213",
  gatewayUrl: "https://gateway.sepolia.zama.ai",
  // Zama contract addresses on Sepolia
  kmsContractAddress: "0x9D6891A6240D6130c54ae243d8005063D05fE14b",
  aclContractAddress: "0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5",
  chainId: 11155111,
};

/**
 * Initialize the FHEVM instance
 * Must be called before any encryption operations
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
      console.log("Initializing FHEVM instance...");

      // Create fhevmjs instance
      const instance = await createInstance({
        kmsContractAddress: SEPOLIA_CONFIG.kmsContractAddress,
        aclContractAddress: SEPOLIA_CONFIG.aclContractAddress,
        networkUrl: SEPOLIA_CONFIG.networkUrl,
        gatewayUrl: SEPOLIA_CONFIG.gatewayUrl,
        chainId: SEPOLIA_CONFIG.chainId,
      });

      fhevmInstance = instance;
      console.log("FHEVM instance initialized successfully");
      return instance;
    } catch (error) {
      console.error("Failed to initialize FHEVM instance:", error);
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
 */
export async function requestUserDecryption(
  handles: { handle: `0x${string}`; contractAddress: string }[],
  userAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any
): Promise<Record<string, bigint | boolean>> {
  const instance = getFheInstance();

  // Generate keypair for decryption
  const { publicKey, privateKey } = instance.generateKeypair();

  // Get contract addresses from handles
  const contractAddresses = Array.from(new Set(handles.map((h) => h.contractAddress)));

  // Create EIP-712 message for reencryption authorization
  // Note: createEIP712 takes (publicKey, contractAddress, delegatedAccount?)
  const firstContractAddress = contractAddresses[0];
  const eip712 = instance.createEIP712(
    publicKey,
    firstContractAddress,
    userAddress // delegatedAccount (user address for self-decryption)
  );

  // Sign the EIP-712 message
  const signature = await signer.signTypedData(
    eip712.domain,
    eip712.types,
    eip712.message
  );

  // Request decryption for each handle
  const results: Record<string, bigint | boolean> = {};

  for (const { handle, contractAddress } of handles) {
    try {
      // Convert hex handle to bigint for reencrypt
      const handleBigInt = BigInt(handle);
      const decrypted = await instance.reencrypt(
        handleBigInt,
        privateKey,
        publicKey,
        signature,
        contractAddress,
        userAddress
      );
      results[handle] = decrypted;
    } catch (error) {
      console.error(`Failed to decrypt handle ${handle}:`, error);
    }
  }

  return results;
}

/**
 * Decrypt a single encrypted value
 */
export async function decryptValue(
  handle: `0x${string}`,
  contractAddress: string,
  userAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any
): Promise<bigint> {
  const instance = getFheInstance();

  const { publicKey, privateKey } = instance.generateKeypair();

  // createEIP712 takes (publicKey, contractAddress, delegatedAccount?)
  const eip712 = instance.createEIP712(
    publicKey,
    contractAddress,
    userAddress // delegatedAccount
  );

  const signature = await signer.signTypedData(
    eip712.domain,
    eip712.types,
    eip712.message
  );

  // Convert hex handle to bigint for reencrypt
  const handleBigInt = BigInt(handle);
  const decrypted = await instance.reencrypt(
    handleBigInt,
    privateKey,
    publicKey,
    signature,
    contractAddress,
    userAddress
  );

  return BigInt(decrypted.toString());
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
