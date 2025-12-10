/**
 * FHENotifier - Real-time FHE Event Notifications via WebSocket
 *
 * Zolymarket'ten farkımız:
 * 1. Real-time decrypt status güncellemeleri
 * 2. Position event notifications
 * 3. User-specific notification filtering
 */

import { WebSocket } from "ws";
import { DecryptionManager, DecryptionRequest } from "../fhe/DecryptionManager";
import { PositionManager, PositionDecryptRequest, EncryptedPosition } from "../fhe/PositionManager";

interface WSClient {
  ws: WebSocket;
  userAddress?: string;
  subscriptions: Set<string>;  // "all", "user:{address}", "position:{id}"
}

export class FHENotifier {
  private clients: Map<WebSocket, WSClient> = new Map();
  private decryptionManager: DecryptionManager;
  private positionManager: PositionManager;

  constructor(
    decryptionManager: DecryptionManager,
    positionManager: PositionManager
  ) {
    this.decryptionManager = decryptionManager;
    this.positionManager = positionManager;
    this.setupListeners();
    console.log("🔔 FHENotifier başlatıldı");
  }

  // ==================== CLIENT MANAGEMENT ====================

  addClient(ws: WebSocket): void {
    this.clients.set(ws, {
      ws,
      subscriptions: new Set(["all"]),
    });
    console.log("📱 FHE client bağlandı");
  }

  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
    console.log("📴 FHE client ayrıldı");
  }

  /**
   * Client authenticate ve subscribe
   */
  handleMessage(ws: WebSocket, message: any): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case "FHE_AUTH":
        // Kullanıcı authenticate oldu
        if (message.data?.userAddress) {
          const userAddr = message.data.userAddress.toLowerCase();
          client.userAddress = userAddr;
          client.subscriptions.add(`user:${userAddr}`);

          this.send(ws, {
            type: "FHE_AUTH_SUCCESS",
            data: { userAddress: userAddr }
          });

          // Kullanıcının pending decrypt'lerini gönder
          this.sendPendingDecrypts(ws, userAddr);
        }
        break;

      case "FHE_SUBSCRIBE_POSITION":
        if (message.data?.positionId) {
          client.subscriptions.add(`position:${message.data.positionId}`);
        }
        break;

      case "FHE_UNSUBSCRIBE_POSITION":
        if (message.data?.positionId) {
          client.subscriptions.delete(`position:${message.data.positionId}`);
        }
        break;

      case "FHE_GET_STATUS":
        // Decrypt durumu sorgula
        if (message.data?.requestId) {
          const request = this.decryptionManager.getRequest(message.data.requestId);
          if (request) {
            this.send(ws, {
              type: "FHE_DECRYPT_STATUS",
              data: this.formatDecryptRequest(request)
            });
          }
        }
        break;

      case "FHE_GET_POSITIONS":
        // Kullanıcının pozisyonlarını getir
        if (client.userAddress) {
          const positions = this.positionManager.getUserPositions(client.userAddress);
          this.send(ws, {
            type: "FHE_POSITIONS",
            data: positions.map(p => this.formatPosition(p))
          });
        }
        break;

      case "FHE_GET_STATS":
        // FHE istatistiklerini getir
        this.send(ws, {
          type: "FHE_STATS",
          data: {
            decryption: this.decryptionManager.getStats(),
            positions: this.positionManager.getStats(),
          }
        });
        break;
    }
  }

  // ==================== EVENT LISTENERS ====================

  private setupListeners(): void {
    // Decrypt request oluşturuldu
    this.decryptionManager.on("requestCreated", (request: DecryptionRequest) => {
      this.broadcastToUser(request.userAddress, {
        type: "FHE_DECRYPT_CREATED",
        data: this.formatDecryptRequest(request)
      });
    });

    // Decrypt request güncellendi
    this.decryptionManager.on("requestUpdated", (request: DecryptionRequest) => {
      this.broadcastToUser(request.userAddress, {
        type: "FHE_DECRYPT_UPDATED",
        data: this.formatDecryptRequest(request)
      });

      // READY durumunda özel notification
      if (request.status === "READY") {
        this.broadcastToUser(request.userAddress, {
          type: "FHE_DECRYPT_READY",
          data: {
            requestId: request.id,
            message: "Decryption complete! You can now claim your values.",
          }
        });
      }
    });

    // Değerler claim edildi
    this.decryptionManager.on("valuesClaimed", ({ request, claim }) => {
      this.broadcastToUser(request.userAddress, {
        type: "FHE_DECRYPT_CLAIMED",
        data: {
          requestId: request.id,
          claimedAt: claim.claimedAt,
        }
      });
    });

    // Pozisyon takibe alındı
    this.positionManager.on("positionTracked", (position: EncryptedPosition) => {
      this.broadcastToUser(position.owner, {
        type: "FHE_POSITION_OPENED",
        data: this.formatPosition(position)
      });

      // Genel broadcast (pozisyon sayısı güncellemesi için)
      this.broadcastAll({
        type: "FHE_POSITION_COUNT_UPDATE",
        data: {
          totalPositions: this.positionManager.getStats().totalPositions,
          openPositions: this.positionManager.getStats().openPositions,
        }
      });
    });

    // Pozisyon kapandı
    this.positionManager.on("positionClosed", (position: EncryptedPosition) => {
      this.broadcastToUser(position.owner, {
        type: "FHE_POSITION_CLOSED",
        data: this.formatPosition(position)
      });

      this.broadcastToPosition(position.positionId, {
        type: "FHE_POSITION_CLOSED",
        data: this.formatPosition(position)
      });
    });

    // Pozisyon decrypt hazır
    this.positionManager.on("decryptionReady", (request: PositionDecryptRequest) => {
      this.broadcastToUser(request.userAddress, {
        type: "FHE_POSITION_DECRYPT_READY",
        data: {
          requestId: request.requestId,
          positionId: request.positionId,
          decryptedPosition: request.decryptedPosition ? {
            collateral: request.decryptedPosition.collateral.toString(),
            size: request.decryptedPosition.size.toString(),
            entryPrice: request.decryptedPosition.entryPrice.toString(),
            leverage: request.decryptedPosition.leverage.toString(),
            isLong: request.decryptedPosition.isLong,
          } : undefined,
        }
      });
    });
  }

  // ==================== BROADCASTING ====================

  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastAll(message: any): void {
    this.clients.forEach((client) => {
      if (client.subscriptions.has("all")) {
        this.send(client.ws, message);
      }
    });
  }

  private broadcastToUser(userAddress: string, message: any): void {
    const normalizedAddress = userAddress.toLowerCase();
    this.clients.forEach((client) => {
      if (client.userAddress === normalizedAddress ||
          client.subscriptions.has(`user:${normalizedAddress}`)) {
        this.send(client.ws, message);
      }
    });
  }

  private broadcastToPosition(positionId: number, message: any): void {
    this.clients.forEach((client) => {
      if (client.subscriptions.has(`position:${positionId}`)) {
        this.send(client.ws, message);
      }
    });
  }

  // ==================== HELPERS ====================

  private sendPendingDecrypts(ws: WebSocket, userAddress: string): void {
    const requests = this.decryptionManager.getUserRequests(userAddress);
    const pending = requests.filter(r =>
      r.status === "PENDING" || r.status === "PROCESSING" || r.status === "READY"
    );

    if (pending.length > 0) {
      this.send(ws, {
        type: "FHE_PENDING_DECRYPTS",
        data: pending.map(r => this.formatDecryptRequest(r))
      });
    }
  }

  private formatDecryptRequest(request: DecryptionRequest): any {
    return {
      requestId: request.id,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      expiresAt: request.expiresAt,
      hasValues: request.status === "READY" || request.status === "CLAIMED",
      errorMessage: request.errorMessage,
    };
  }

  private formatPosition(position: EncryptedPosition): any {
    return {
      positionId: position.positionId,
      owner: position.owner,
      assetId: position.assetId,
      isOpen: position.isOpen,
      openedAt: position.openedAt,
      closedAt: position.closedAt,
    };
  }

  getConnectedClients(): number {
    return this.clients.size;
  }

  getAuthenticatedClients(): number {
    let count = 0;
    this.clients.forEach(client => {
      if (client.userAddress) count++;
    });
    return count;
  }
}
