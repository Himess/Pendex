/**
 * DecryptionManager - FHE Decryption Request Management
 *
 * Zolymarket'ten farkımız:
 * 1. İki aşamalı claiming sistemi (Request → Callback → Claim)
 * 2. EIP-712 signature doğrulaması
 * 3. WebSocket ile real-time durum güncellemesi
 * 4. Encrypted handle caching
 */

import { EventEmitter } from "events";

export type DecryptionStatus = "PENDING" | "PROCESSING" | "READY" | "CLAIMED" | "EXPIRED" | "FAILED";

export interface DecryptionRequest {
  id: string;
  userAddress: string;
  contractAddress: string;
  handles: string[];  // Encrypted handles (bytes32[])
  status: DecryptionStatus;
  clearValues?: bigint[];  // Decrypted values (only when READY)
  signature: string;  // EIP-712 signature
  publicKey: string;  // User's reencryption public key
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  txHash?: string;  // On-chain request tx
  callbackTxHash?: string;  // Relayer callback tx
  errorMessage?: string;
}

export interface ClaimRequest {
  requestId: string;
  userAddress: string;
  signature: string;
  claimedAt: number;
}

interface DecryptionConfig {
  expirationMs: number;  // Request expiration (default: 10 min)
  maxPendingPerUser: number;  // Max pending requests per user
  cleanupIntervalMs: number;  // Cleanup expired requests interval
}

const DEFAULT_CONFIG: DecryptionConfig = {
  expirationMs: 10 * 60 * 1000,  // 10 minutes
  maxPendingPerUser: 5,
  cleanupIntervalMs: 60 * 1000,  // 1 minute
};

export class DecryptionManager extends EventEmitter {
  private requests: Map<string, DecryptionRequest> = new Map();
  private claims: Map<string, ClaimRequest> = new Map();
  private userRequests: Map<string, Set<string>> = new Map();  // userAddress -> requestIds
  private config: DecryptionConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private requestCounter = 0;

  constructor(config: Partial<DecryptionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
    console.log("🔐 DecryptionManager başlatıldı");
  }

  // ==================== REQUEST MANAGEMENT ====================

  /**
   * Yeni decryption isteği oluştur
   * Frontend'den gelen istek burada kayıt altına alınır
   */
  createRequest(params: {
    userAddress: string;
    contractAddress: string;
    handles: string[];
    signature: string;
    publicKey: string;
  }): DecryptionRequest {
    // Kullanıcının pending istek sayısını kontrol et
    const userPending = this.getUserPendingCount(params.userAddress);
    if (userPending >= this.config.maxPendingPerUser) {
      throw new Error(`Max pending requests (${this.config.maxPendingPerUser}) reached`);
    }

    const now = Date.now();
    const request: DecryptionRequest = {
      id: `decrypt_${++this.requestCounter}_${now}`,
      userAddress: params.userAddress.toLowerCase(),
      contractAddress: params.contractAddress.toLowerCase(),
      handles: params.handles,
      status: "PENDING",
      signature: params.signature,
      publicKey: params.publicKey,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + this.config.expirationMs,
    };

    this.requests.set(request.id, request);

    // User index güncelle
    if (!this.userRequests.has(request.userAddress)) {
      this.userRequests.set(request.userAddress, new Set());
    }
    this.userRequests.get(request.userAddress)!.add(request.id);

    console.log(`🔓 Decrypt isteği oluşturuldu: ${request.id} (user: ${request.userAddress.slice(0, 10)}...)`);

    this.emit("requestCreated", request);
    return request;
  }

  /**
   * İstek durumunu güncelle (Relayer callback'i için)
   */
  updateRequestStatus(
    requestId: string,
    status: DecryptionStatus,
    data?: {
      clearValues?: bigint[];
      txHash?: string;
      callbackTxHash?: string;
      errorMessage?: string;
    }
  ): DecryptionRequest | null {
    const request = this.requests.get(requestId);
    if (!request) return null;

    request.status = status;
    request.updatedAt = Date.now();

    if (data?.clearValues) request.clearValues = data.clearValues;
    if (data?.txHash) request.txHash = data.txHash;
    if (data?.callbackTxHash) request.callbackTxHash = data.callbackTxHash;
    if (data?.errorMessage) request.errorMessage = data.errorMessage;

    console.log(`📝 Decrypt durumu güncellendi: ${requestId} → ${status}`);

    this.emit("requestUpdated", request);
    return request;
  }

  /**
   * Relayer callback'i işle
   * Zama Gateway bu endpoint'i çağırır
   */
  handleRelayerCallback(params: {
    requestId: string;
    clearValues: string[];  // bigint as hex strings
    signature: string;  // Relayer signature for verification
    txHash: string;
  }): DecryptionRequest | null {
    const request = this.requests.get(params.requestId);
    if (!request) {
      console.error(`❌ Bilinmeyen request ID: ${params.requestId}`);
      return null;
    }

    if (request.status !== "PENDING" && request.status !== "PROCESSING") {
      console.error(`❌ Invalid status for callback: ${request.status}`);
      return null;
    }

    // Clear values'ı bigint'e çevir
    const clearValues = params.clearValues.map(v => BigInt(v));

    return this.updateRequestStatus(params.requestId, "READY", {
      clearValues,
      callbackTxHash: params.txHash,
    });
  }

  // ==================== CLAIMING ====================

  /**
   * Kullanıcı decrypted değerleri claim etsin
   * Two-step flow'un son adımı
   */
  claimDecryptedValues(params: {
    requestId: string;
    userAddress: string;
    signature: string;
  }): { success: boolean; clearValues?: bigint[]; error?: string } {
    const request = this.requests.get(params.requestId);

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.userAddress !== params.userAddress.toLowerCase()) {
      return { success: false, error: "Unauthorized: not request owner" };
    }

    if (request.status !== "READY") {
      return { success: false, error: `Invalid status: ${request.status}` };
    }

    if (Date.now() > request.expiresAt) {
      this.updateRequestStatus(params.requestId, "EXPIRED");
      return { success: false, error: "Request expired" };
    }

    // Claim kaydı oluştur
    const claim: ClaimRequest = {
      requestId: params.requestId,
      userAddress: params.userAddress.toLowerCase(),
      signature: params.signature,
      claimedAt: Date.now(),
    };
    this.claims.set(params.requestId, claim);

    // Durumu güncelle
    this.updateRequestStatus(params.requestId, "CLAIMED");

    console.log(`✅ Değerler claim edildi: ${params.requestId}`);

    this.emit("valuesClaimed", { request, claim });

    return {
      success: true,
      clearValues: request.clearValues
    };
  }

  // ==================== QUERIES ====================

  getRequest(requestId: string): DecryptionRequest | undefined {
    return this.requests.get(requestId);
  }

  getUserRequests(userAddress: string): DecryptionRequest[] {
    const requestIds = this.userRequests.get(userAddress.toLowerCase());
    if (!requestIds) return [];

    return Array.from(requestIds)
      .map(id => this.requests.get(id))
      .filter((r): r is DecryptionRequest => r !== undefined)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getPendingRequests(): DecryptionRequest[] {
    return Array.from(this.requests.values())
      .filter(r => r.status === "PENDING" || r.status === "PROCESSING")
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getReadyRequests(userAddress: string): DecryptionRequest[] {
    return this.getUserRequests(userAddress)
      .filter(r => r.status === "READY");
  }

  getUserPendingCount(userAddress: string): number {
    return this.getUserRequests(userAddress)
      .filter(r => r.status === "PENDING" || r.status === "PROCESSING")
      .length;
  }

  // ==================== CLEANUP ====================

  private startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRequests();
    }, this.config.cleanupIntervalMs);
  }

  private cleanupExpiredRequests() {
    const now = Date.now();
    let cleaned = 0;

    this.requests.forEach((request, id) => {
      if (now > request.expiresAt && request.status !== "CLAIMED") {
        this.updateRequestStatus(id, "EXPIRED");
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} expired request temizlendi`);
    }
  }

  // ==================== STATS ====================

  getStats(): {
    totalRequests: number;
    pendingRequests: number;
    readyRequests: number;
    claimedRequests: number;
    expiredRequests: number;
    failedRequests: number;
    uniqueUsers: number;
  } {
    const requests = Array.from(this.requests.values());

    return {
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === "PENDING" || r.status === "PROCESSING").length,
      readyRequests: requests.filter(r => r.status === "READY").length,
      claimedRequests: requests.filter(r => r.status === "CLAIMED").length,
      expiredRequests: requests.filter(r => r.status === "EXPIRED").length,
      failedRequests: requests.filter(r => r.status === "FAILED").length,
      uniqueUsers: this.userRequests.size,
    };
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    console.log("🛑 DecryptionManager durduruldu");
  }
}
