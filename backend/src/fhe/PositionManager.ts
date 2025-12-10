/**
 * PositionManager - Encrypted Position Tracking
 *
 * Pozisyonların encrypted handle'larını takip eder
 * User decryption flow'unu yönetir
 */

import { EventEmitter } from "events";
import { DecryptionManager, DecryptionRequest } from "./DecryptionManager";

export interface EncryptedPosition {
  positionId: number;
  owner: string;
  assetId: string;
  encryptedCollateral: string;  // bytes32 handle
  encryptedSize: string;  // bytes32 handle
  encryptedEntryPrice: string;  // bytes32 handle
  encryptedLeverage: string;  // bytes32 handle
  encryptedIsLong: string;  // bytes32 handle
  isOpen: boolean;
  openedAt: number;
  closedAt?: number;
  openTxHash: string;
  closeTxHash?: string;
}

export interface DecryptedPosition {
  positionId: number;
  owner: string;
  assetId: string;
  collateral: bigint;
  size: bigint;
  entryPrice: bigint;
  leverage: bigint;
  isLong: boolean;
  isOpen: boolean;
  currentPrice?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface PositionDecryptRequest {
  requestId: string;
  positionId: number;
  userAddress: string;
  status: "PENDING" | "READY" | "CLAIMED";
  decryptedPosition?: DecryptedPosition;
  createdAt: number;
}

export class PositionManager extends EventEmitter {
  private positions: Map<number, EncryptedPosition> = new Map();
  private userPositions: Map<string, Set<number>> = new Map();  // owner -> positionIds
  private decryptRequests: Map<string, PositionDecryptRequest> = new Map();
  private decryptionManager: DecryptionManager;

  constructor(decryptionManager: DecryptionManager) {
    super();
    this.decryptionManager = decryptionManager;
    this.setupDecryptionListeners();
    console.log("📊 PositionManager başlatıldı");
  }

  // ==================== POSITION TRACKING ====================

  /**
   * Yeni pozisyon kaydet (PositionOpened event'inden)
   */
  trackPosition(params: {
    positionId: number;
    owner: string;
    assetId: string;
    encryptedCollateral: string;
    encryptedSize: string;
    encryptedEntryPrice: string;
    encryptedLeverage: string;
    encryptedIsLong: string;
    txHash: string;
  }): EncryptedPosition {
    const position: EncryptedPosition = {
      positionId: params.positionId,
      owner: params.owner.toLowerCase(),
      assetId: params.assetId,
      encryptedCollateral: params.encryptedCollateral,
      encryptedSize: params.encryptedSize,
      encryptedEntryPrice: params.encryptedEntryPrice,
      encryptedLeverage: params.encryptedLeverage,
      encryptedIsLong: params.encryptedIsLong,
      isOpen: true,
      openedAt: Date.now(),
      openTxHash: params.txHash,
    };

    this.positions.set(params.positionId, position);

    // User index güncelle
    if (!this.userPositions.has(position.owner)) {
      this.userPositions.set(position.owner, new Set());
    }
    this.userPositions.get(position.owner)!.add(params.positionId);

    console.log(`📈 Pozisyon takibe alındı: #${params.positionId} (${position.owner.slice(0, 10)}...)`);

    this.emit("positionTracked", position);
    return position;
  }

  /**
   * Pozisyon kapandı (PositionClosed event'inden)
   */
  closePosition(positionId: number, txHash: string): EncryptedPosition | null {
    const position = this.positions.get(positionId);
    if (!position) return null;

    position.isOpen = false;
    position.closedAt = Date.now();
    position.closeTxHash = txHash;

    console.log(`📉 Pozisyon kapandı: #${positionId}`);

    this.emit("positionClosed", position);
    return position;
  }

  // ==================== DECRYPTION FLOW ====================

  /**
   * Kullanıcı kendi pozisyonunu decrypt etmek istiyor
   * Two-step flow başlat
   */
  requestPositionDecryption(params: {
    positionId: number;
    userAddress: string;
    contractAddress: string;
    signature: string;
    publicKey: string;
  }): PositionDecryptRequest | null {
    const position = this.positions.get(params.positionId);
    if (!position) {
      console.error(`❌ Pozisyon bulunamadı: #${params.positionId}`);
      return null;
    }

    // Owner kontrolü
    if (position.owner !== params.userAddress.toLowerCase()) {
      console.error(`❌ Yetkisiz erişim: ${params.userAddress} != ${position.owner}`);
      return null;
    }

    // Encrypted handle'ları topla
    const handles = [
      position.encryptedCollateral,
      position.encryptedSize,
      position.encryptedEntryPrice,
      position.encryptedLeverage,
      position.encryptedIsLong,
    ];

    // DecryptionManager'a istek gönder
    const decryptRequest = this.decryptionManager.createRequest({
      userAddress: params.userAddress,
      contractAddress: params.contractAddress,
      handles,
      signature: params.signature,
      publicKey: params.publicKey,
    });

    // Position decrypt request oluştur
    const positionRequest: PositionDecryptRequest = {
      requestId: decryptRequest.id,
      positionId: params.positionId,
      userAddress: params.userAddress.toLowerCase(),
      status: "PENDING",
      createdAt: Date.now(),
    };

    this.decryptRequests.set(decryptRequest.id, positionRequest);

    console.log(`🔓 Pozisyon decrypt isteği: #${params.positionId} → ${decryptRequest.id}`);

    this.emit("decryptionRequested", positionRequest);
    return positionRequest;
  }

  /**
   * DecryptionManager event'lerini dinle
   */
  private setupDecryptionListeners() {
    this.decryptionManager.on("requestUpdated", (request: DecryptionRequest) => {
      const positionRequest = this.decryptRequests.get(request.id);
      if (!positionRequest) return;

      if (request.status === "READY" && request.clearValues) {
        positionRequest.status = "READY";

        // Clear values'ı DecryptedPosition'a dönüştür
        const position = this.positions.get(positionRequest.positionId);
        if (position && request.clearValues.length >= 5) {
          positionRequest.decryptedPosition = {
            positionId: positionRequest.positionId,
            owner: position.owner,
            assetId: position.assetId,
            collateral: request.clearValues[0],
            size: request.clearValues[1],
            entryPrice: request.clearValues[2],
            leverage: request.clearValues[3],
            isLong: request.clearValues[4] === 1n,
            isOpen: position.isOpen,
          };
        }

        this.emit("decryptionReady", positionRequest);
      }
    });

    this.decryptionManager.on("valuesClaimed", ({ request }) => {
      const positionRequest = this.decryptRequests.get(request.id);
      if (positionRequest) {
        positionRequest.status = "CLAIMED";
        this.emit("decryptionClaimed", positionRequest);
      }
    });
  }

  // ==================== QUERIES ====================

  getPosition(positionId: number): EncryptedPosition | undefined {
    return this.positions.get(positionId);
  }

  getUserPositions(userAddress: string): EncryptedPosition[] {
    const positionIds = this.userPositions.get(userAddress.toLowerCase());
    if (!positionIds) return [];

    return Array.from(positionIds)
      .map(id => this.positions.get(id))
      .filter((p): p is EncryptedPosition => p !== undefined)
      .sort((a, b) => b.openedAt - a.openedAt);
  }

  getOpenPositions(userAddress?: string): EncryptedPosition[] {
    let positions = Array.from(this.positions.values());

    if (userAddress) {
      positions = positions.filter(p => p.owner === userAddress.toLowerCase());
    }

    return positions.filter(p => p.isOpen);
  }

  getDecryptRequest(requestId: string): PositionDecryptRequest | undefined {
    return this.decryptRequests.get(requestId);
  }

  getUserDecryptRequests(userAddress: string): PositionDecryptRequest[] {
    return Array.from(this.decryptRequests.values())
      .filter(r => r.userAddress === userAddress.toLowerCase())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // ==================== STATS ====================

  getStats(): {
    totalPositions: number;
    openPositions: number;
    closedPositions: number;
    uniqueTraders: number;
    pendingDecryptions: number;
  } {
    const positions = Array.from(this.positions.values());
    const decrypts = Array.from(this.decryptRequests.values());

    return {
      totalPositions: positions.length,
      openPositions: positions.filter(p => p.isOpen).length,
      closedPositions: positions.filter(p => !p.isOpen).length,
      uniqueTraders: this.userPositions.size,
      pendingDecryptions: decrypts.filter(d => d.status === "PENDING").length,
    };
  }
}
