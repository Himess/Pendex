"use client";

import { ethers } from "ethers";
import { getFheInstance, initFheInstance, isFheInitialized } from "../fhe/client";

// WalletManager contract address (deployed to Sepolia)
export const WALLET_MANAGER_ADDRESS = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";

// WalletManager ABI (minimal for session wallet operations)
export const WALLET_MANAGER_ABI = [
  {
    inputs: [
      { name: "encryptedKey", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "sessionAddress", type: "address" },
    ],
    name: "storeSessionKey",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getSessionKey",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "mainWallet", type: "address" }],
    name: "getSessionInfo",
    outputs: [
      { name: "sessionAddress", type: "address" },
      { name: "createdAt", type: "uint256" },
      { name: "lastUsedAt", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "sessionAddress", type: "address" }],
    name: "isValidSession",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "mainWallet", type: "address" }],
    name: "hasSessionWallet",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "revokeSessionWallet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "sessionAddress", type: "address" }],
    name: "getMainWallet",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface SessionWalletData {
  mainWallet: string;
  sessionAddress: string;
  sessionPrivateKey: string; // Only in memory, NEVER stored!
  createdAt: number;
}

/**
 * Convert Uint8Array to hex string
 */
function toHexString(bytes: Uint8Array): `0x${string}` {
  return ("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

/**
 * SessionWalletManager - Manages popup-free trading with session wallets
 *
 * Flow:
 * 1. User creates session wallet locally
 * 2. Private key is encrypted with FHE
 * 3. Encrypted key stored on-chain
 * 4. Each session, user decrypts key using FHE ACL
 * 5. Session wallet signs trades (no MetaMask popup!)
 */
export class SessionWalletManager {
  private static instance: SessionWalletManager;
  private sessionData: SessionWalletData | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fheKeyPair: any = null; // FHE SDK keypair (type varies by SDK version)

  private constructor() {}

  static getInstance(): SessionWalletManager {
    if (!SessionWalletManager.instance) {
      SessionWalletManager.instance = new SessionWalletManager();
    }
    return SessionWalletManager.instance;
  }

  // ============ SETUP FUNCTIONS ============

  /**
   * Create a new session wallet (SETUP - runs once)
   * @param mainWalletSigner The connected main wallet signer
   * @param _provider Ethereum provider (reserved for future use)
   */
  async createSessionWallet(
    mainWalletSigner: ethers.Signer,
    _provider: ethers.Provider
  ): Promise<{
    sessionAddress: string;
    sessionPrivateKey: string;
  }> {
    // 1. Generate random session wallet
    const sessionWallet = ethers.Wallet.createRandom();
    const sessionPrivateKey = sessionWallet.privateKey;
    const sessionAddress = sessionWallet.address;

    console.log("🔑 Session wallet created:", sessionAddress);

    // 2. Ensure FHE is initialized
    if (!isFheInitialized()) {
      await initFheInstance();
    }
    const fheInstance = getFheInstance();

    // 3. Get main wallet address
    const mainAddress = await mainWalletSigner.getAddress();

    // 4. Encrypt private key with FHE
    // Convert hex private key to BigInt (remove 0x prefix)
    const privateKeyBigInt = BigInt(sessionPrivateKey);

    // Create encrypted input for uint256
    const input = fheInstance.createEncryptedInput(WALLET_MANAGER_ADDRESS, mainAddress);
    input.add256(privateKeyBigInt);

    // Encrypt and get handles + proof
    const encrypted = await input.encrypt();
    const encryptedKeyHandle = toHexString(encrypted.handles[0]);
    const inputProof = toHexString(encrypted.inputProof);

    console.log("🔐 Private key encrypted with FHE");

    // 5. Store encrypted key on-chain
    const walletManager = new ethers.Contract(
      WALLET_MANAGER_ADDRESS,
      WALLET_MANAGER_ABI,
      mainWalletSigner
    );

    console.log("📝 Storing encrypted key on-chain...");
    const tx = await walletManager.storeSessionKey(encryptedKeyHandle, inputProof, sessionAddress);
    await tx.wait();

    console.log("✅ Session key stored on-chain");

    return { sessionAddress, sessionPrivateKey };
  }

  /**
   * Fund session wallet with ETH for gas
   * @param mainWalletSigner Main wallet signer
   * @param sessionAddress Session wallet address
   * @param amount Amount in ETH
   */
  async fundSessionWallet(
    mainWalletSigner: ethers.Signer,
    sessionAddress: string,
    amount: string = "0.01" // Default 0.01 ETH
  ): Promise<void> {
    console.log(`💰 Funding session wallet with ${amount} ETH...`);

    const tx = await mainWalletSigner.sendTransaction({
      to: sessionAddress,
      value: ethers.parseEther(amount),
    });

    await tx.wait();
    console.log(`✅ Funded session wallet with ${amount} ETH`);
  }

  // ============ SESSION FUNCTIONS ============

  /**
   * Check if user has a session wallet on-chain
   * @param mainAddress Main wallet address
   * @param provider Ethereum provider
   */
  async hasExistingSession(mainAddress: string, provider: ethers.Provider): Promise<boolean> {
    try {
      const walletManager = new ethers.Contract(WALLET_MANAGER_ADDRESS, WALLET_MANAGER_ABI, provider);
      return await walletManager.hasSessionWallet(mainAddress);
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  }

  /**
   * Get session info from contract
   * @param mainAddress Main wallet address
   * @param provider Ethereum provider
   */
  async getSessionInfo(
    mainAddress: string,
    provider: ethers.Provider
  ): Promise<{
    sessionAddress: string;
    createdAt: number;
    lastUsedAt: number;
    isActive: boolean;
  } | null> {
    try {
      const walletManager = new ethers.Contract(WALLET_MANAGER_ADDRESS, WALLET_MANAGER_ABI, provider);
      const info = await walletManager.getSessionInfo(mainAddress);

      if (!info.isActive) {
        return null;
      }

      return {
        sessionAddress: info.sessionAddress,
        createdAt: Number(info.createdAt),
        lastUsedAt: Number(info.lastUsedAt),
        isActive: info.isActive,
      };
    } catch (error) {
      console.error("Error getting session info:", error);
      return null;
    }
  }

  /**
   * Initialize session (LOGIN - each session)
   * Decrypts the session key from on-chain storage
   * @param mainWalletSigner Main wallet signer (for EIP-712 signature)
   * @param provider Ethereum provider
   */
  async initializeSession(
    mainWalletSigner: ethers.Signer,
    provider: ethers.Provider
  ): Promise<boolean> {
    try {
      const mainAddress = await mainWalletSigner.getAddress();

      // 1. Check if session wallet exists
      const sessionInfo = await this.getSessionInfo(mainAddress, provider);

      if (!sessionInfo || !sessionInfo.isActive) {
        console.log("❌ No session wallet found");
        return false;
      }

      // 2. Ensure FHE is initialized
      if (!isFheInitialized()) {
        await initFheInstance();
      }
      const fheInstance = getFheInstance();

      // 3. Generate FHE keypair for decryption (or get from cache)
      await this.ensureFheKeyPair();

      // 4. Get encrypted key handle from contract
      const walletManager = new ethers.Contract(WALLET_MANAGER_ADDRESS, WALLET_MANAGER_ABI, provider);
      const encryptedKeyHandle = await walletManager.getSessionKey({ from: mainAddress });

      // 5. Create EIP-712 message for decryption authorization
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "1";

      const eip712 = fheInstance.createEIP712(
        this.fheKeyPair!.publicKey,
        [WALLET_MANAGER_ADDRESS],
        startTimeStamp,
        durationDays
      );

      // 6. Sign with main wallet (MetaMask popup for authorization)
      console.log("📝 Requesting signature for session key decryption...");

      // ethers.js v6 requires removing EIP712Domain from types (handles it internally)
      // and only passing the message types
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { EIP712Domain, ...typesWithoutDomain } = eip712.types;

      const signature = await mainWalletSigner.signTypedData(
        eip712.domain,
        typesWithoutDomain as Record<string, ethers.TypedDataField[]>,
        eip712.message
      );

      // 7. Decrypt the session key using FHE
      const results = await fheInstance.userDecrypt(
        [{ handle: encryptedKeyHandle, contractAddress: WALLET_MANAGER_ADDRESS }],
        this.fheKeyPair!.privateKey,
        this.fheKeyPair!.publicKey,
        signature.replace("0x", ""),
        [WALLET_MANAGER_ADDRESS],
        mainAddress,
        startTimeStamp,
        durationDays
      );

      // 8. Get decrypted private key
      const decryptedValue = results[encryptedKeyHandle];
      if (!decryptedValue || typeof decryptedValue !== "bigint") {
        throw new Error("Failed to decrypt session key");
      }

      // 9. Convert BigInt back to hex private key
      const sessionPrivateKey = "0x" + decryptedValue.toString(16).padStart(64, "0");

      // 10. Verify by deriving address
      const sessionWallet = new ethers.Wallet(sessionPrivateKey);

      if (sessionWallet.address.toLowerCase() !== sessionInfo.sessionAddress.toLowerCase()) {
        throw new Error("Session key verification failed - address mismatch");
      }

      // 11. Store in memory (NOT localStorage!)
      this.sessionData = {
        mainWallet: mainAddress,
        sessionAddress: sessionInfo.sessionAddress,
        sessionPrivateKey: sessionPrivateKey,
        createdAt: sessionInfo.createdAt,
      };

      console.log("✅ Session initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize session:", error);
      return false;
    }
  }

  /**
   * Generate fresh FHE keypair for decryption
   * NOTE: We don't cache keypairs anymore because the SDK's internal format
   * is not serializable to JSON. Generating a new keypair is fast and reliable.
   */
  private async ensureFheKeyPair(): Promise<void> {
    // Always generate a fresh keypair to ensure correct SDK format
    const fheInstance = getFheInstance();
    this.fheKeyPair = fheInstance.generateKeypair();
    console.log("🔑 Generated fresh FHE keypair for decryption");
  }

  // ============ TRADING FUNCTIONS ============

  /**
   * Get session wallet signer for popup-free TX
   * @param provider Ethereum provider
   */
  getSessionSigner(provider: ethers.Provider): ethers.Wallet {
    if (!this.sessionData) {
      throw new Error("Session not initialized. Call initializeSession() first.");
    }

    return new ethers.Wallet(this.sessionData.sessionPrivateKey, provider);
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.sessionData !== null;
  }

  /**
   * Get session address
   */
  getSessionAddress(): string | null {
    return this.sessionData?.sessionAddress || null;
  }

  /**
   * Get main wallet address for this session
   */
  getMainWallet(): string | null {
    return this.sessionData?.mainWallet || null;
  }

  /**
   * Clear session (logout)
   * Keep FHE keypair for next session
   */
  clearSession(): void {
    this.sessionData = null;
    console.log("🔓 Session cleared");
  }

  /**
   * Full logout (clear everything)
   */
  fullLogout(): void {
    this.sessionData = null;
    this.fheKeyPair = null;
    console.log("🔓 Full logout - all session data cleared");
  }

  /**
   * Get session wallet ETH balance
   */
  async getSessionBalance(provider: ethers.Provider): Promise<string> {
    if (!this.sessionData) {
      return "0";
    }

    const balance = await provider.getBalance(this.sessionData.sessionAddress);
    return ethers.formatEther(balance);
  }

  /**
   * Check if session wallet has enough gas
   */
  async hasEnoughGas(provider: ethers.Provider, minEth: string = "0.001"): Promise<boolean> {
    const balance = await this.getSessionBalance(provider);
    return parseFloat(balance) >= parseFloat(minEth);
  }
}

// Export singleton instance
export const sessionWalletManager = SessionWalletManager.getInstance();
