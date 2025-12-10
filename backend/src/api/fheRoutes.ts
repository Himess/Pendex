/**
 * FHE API Routes - Decryption & Position Endpoints
 *
 * Zolymarket'ten farkımız:
 * 1. RESTful API design
 * 2. Two-step claiming flow endpoints
 * 3. Relayer callback endpoint
 * 4. Detailed error responses
 */

import { Router, Request, Response } from "express";
import { DecryptionManager } from "../fhe/DecryptionManager";
import { PositionManager } from "../fhe/PositionManager";

export function createFHERoutes(
  decryptionManager: DecryptionManager,
  positionManager: PositionManager
): Router {
  const router = Router();

  // ==================== DECRYPTION ENDPOINTS ====================

  /**
   * POST /api/fhe/decrypt/request
   * Yeni decryption isteği oluştur
   */
  router.post("/decrypt/request", async (req: Request, res: Response) => {
    try {
      const { userAddress, contractAddress, handles, signature, publicKey } = req.body;

      // Validation
      if (!userAddress || !contractAddress || !handles || !signature || !publicKey) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: userAddress, contractAddress, handles, signature, publicKey"
        });
      }

      if (!Array.isArray(handles) || handles.length === 0) {
        return res.status(400).json({
          success: false,
          error: "handles must be a non-empty array"
        });
      }

      const request = decryptionManager.createRequest({
        userAddress,
        contractAddress,
        handles,
        signature,
        publicKey,
      });

      res.json({
        success: true,
        data: {
          requestId: request.id,
          status: request.status,
          expiresAt: request.expiresAt,
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/fhe/decrypt/status/:requestId
   * Decryption isteği durumunu sorgula
   */
  router.get("/decrypt/status/:requestId", (req: Request, res: Response) => {
    const request = decryptionManager.getRequest(req.params.requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Request not found"
      });
    }

    res.json({
      success: true,
      data: {
        requestId: request.id,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        expiresAt: request.expiresAt,
        hasValues: request.status === "READY" || request.status === "CLAIMED",
        errorMessage: request.errorMessage,
      }
    });
  });

  /**
   * POST /api/fhe/decrypt/claim
   * Decrypted değerleri claim et (Two-step flow'un 2. adımı)
   */
  router.post("/decrypt/claim", (req: Request, res: Response) => {
    try {
      const { requestId, userAddress, signature } = req.body;

      if (!requestId || !userAddress || !signature) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: requestId, userAddress, signature"
        });
      }

      const result = decryptionManager.claimDecryptedValues({
        requestId,
        userAddress,
        signature,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          clearValues: result.clearValues?.map(v => v.toString()),
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/fhe/decrypt/user/:userAddress
   * Kullanıcının tüm decrypt isteklerini getir
   */
  router.get("/decrypt/user/:userAddress", (req: Request, res: Response) => {
    const requests = decryptionManager.getUserRequests(req.params.userAddress);

    res.json({
      success: true,
      data: requests.map(r => ({
        requestId: r.id,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        expiresAt: r.expiresAt,
        hasValues: r.status === "READY" || r.status === "CLAIMED",
      }))
    });
  });

  /**
   * POST /api/fhe/decrypt/callback
   * Zama Relayer callback endpoint
   * Bu endpoint Zama Gateway tarafından çağrılır
   */
  router.post("/decrypt/callback", (req: Request, res: Response) => {
    try {
      const { requestId, clearValues, signature, txHash } = req.body;

      if (!requestId || !clearValues || !signature) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: requestId, clearValues, signature"
        });
      }

      const request = decryptionManager.handleRelayerCallback({
        requestId,
        clearValues,
        signature,
        txHash,
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          error: "Request not found or invalid status"
        });
      }

      res.json({
        success: true,
        data: {
          requestId: request.id,
          status: request.status,
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ==================== POSITION ENDPOINTS ====================

  /**
   * POST /api/fhe/position/track
   * Yeni pozisyon takibe al (event listener'dan çağrılır)
   */
  router.post("/position/track", (req: Request, res: Response) => {
    try {
      const {
        positionId,
        owner,
        assetId,
        encryptedCollateral,
        encryptedSize,
        encryptedEntryPrice,
        encryptedLeverage,
        encryptedIsLong,
        txHash,
      } = req.body;

      if (!positionId || !owner || !assetId || !txHash) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields"
        });
      }

      const position = positionManager.trackPosition({
        positionId: Number(positionId),
        owner,
        assetId,
        encryptedCollateral,
        encryptedSize,
        encryptedEntryPrice,
        encryptedLeverage,
        encryptedIsLong,
        txHash,
      });

      res.json({
        success: true,
        data: {
          positionId: position.positionId,
          owner: position.owner,
          isOpen: position.isOpen,
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/fhe/position/close
   * Pozisyon kapandı
   */
  router.post("/position/close", (req: Request, res: Response) => {
    const { positionId, txHash } = req.body;

    if (!positionId || !txHash) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: positionId, txHash"
      });
    }

    const position = positionManager.closePosition(Number(positionId), txHash);

    if (!position) {
      return res.status(404).json({
        success: false,
        error: "Position not found"
      });
    }

    res.json({
      success: true,
      data: {
        positionId: position.positionId,
        isOpen: position.isOpen,
        closedAt: position.closedAt,
      }
    });
  });

  /**
   * POST /api/fhe/position/decrypt
   * Pozisyon decrypt isteği başlat
   */
  router.post("/position/decrypt", (req: Request, res: Response) => {
    try {
      const { positionId, userAddress, contractAddress, signature, publicKey } = req.body;

      if (!positionId || !userAddress || !contractAddress || !signature || !publicKey) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields"
        });
      }

      const request = positionManager.requestPositionDecryption({
        positionId: Number(positionId),
        userAddress,
        contractAddress,
        signature,
        publicKey,
      });

      if (!request) {
        return res.status(400).json({
          success: false,
          error: "Failed to create decrypt request. Check ownership."
        });
      }

      res.json({
        success: true,
        data: {
          requestId: request.requestId,
          positionId: request.positionId,
          status: request.status,
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/fhe/position/:positionId
   * Pozisyon bilgisi getir (encrypted handles)
   */
  router.get("/position/:positionId", (req: Request, res: Response) => {
    const position = positionManager.getPosition(Number(req.params.positionId));

    if (!position) {
      return res.status(404).json({
        success: false,
        error: "Position not found"
      });
    }

    res.json({
      success: true,
      data: {
        positionId: position.positionId,
        owner: position.owner,
        assetId: position.assetId,
        isOpen: position.isOpen,
        openedAt: position.openedAt,
        closedAt: position.closedAt,
        // NOT: Encrypted handles gösterilmez - sadece owner decrypt edebilir
      }
    });
  });

  /**
   * GET /api/fhe/position/user/:userAddress
   * Kullanıcının pozisyonlarını getir
   */
  router.get("/position/user/:userAddress", (req: Request, res: Response) => {
    const positions = positionManager.getUserPositions(req.params.userAddress);

    res.json({
      success: true,
      data: positions.map(p => ({
        positionId: p.positionId,
        assetId: p.assetId,
        isOpen: p.isOpen,
        openedAt: p.openedAt,
        closedAt: p.closedAt,
      }))
    });
  });

  /**
   * GET /api/fhe/position/user/:userAddress/decrypts
   * Kullanıcının decrypt isteklerini getir
   */
  router.get("/position/user/:userAddress/decrypts", (req: Request, res: Response) => {
    const requests = positionManager.getUserDecryptRequests(req.params.userAddress);

    res.json({
      success: true,
      data: requests.map(r => ({
        requestId: r.requestId,
        positionId: r.positionId,
        status: r.status,
        createdAt: r.createdAt,
        decryptedPosition: r.decryptedPosition ? {
          collateral: r.decryptedPosition.collateral.toString(),
          size: r.decryptedPosition.size.toString(),
          entryPrice: r.decryptedPosition.entryPrice.toString(),
          leverage: r.decryptedPosition.leverage.toString(),
          isLong: r.decryptedPosition.isLong,
        } : undefined,
      }))
    });
  });

  // ==================== STATS ENDPOINTS ====================

  /**
   * GET /api/fhe/stats
   * FHE sistem istatistikleri
   */
  router.get("/stats", (req: Request, res: Response) => {
    const decryptStats = decryptionManager.getStats();
    const positionStats = positionManager.getStats();

    res.json({
      success: true,
      data: {
        decryption: decryptStats,
        positions: positionStats,
        timestamp: Date.now(),
      }
    });
  });

  return router;
}
