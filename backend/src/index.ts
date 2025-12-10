/**
 * Shadow Protocol - Enhanced Backend Server
 *
 * Features:
 * 1. Market Simulator (price feeds, bot trades)
 * 2. FHE Decryption Management (two-step claiming)
 * 3. Position Tracking
 * 4. WebSocket Real-time Updates
 * 5. RESTful API
 *
 * Zolymarket'ten farkımız:
 * - Daha iyi yapılandırılmış kod
 * - Two-step decrypt claiming
 * - Real-time WebSocket notifications
 * - Position decrypt flow
 */

import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";

// Market Simulator
import { MarketEngine } from "./engine/MarketEngine";
import { BotManager } from "./bots/BotManager";
import { WSServer } from "./websocket/WSServer";

// FHE Management
import { DecryptionManager } from "./fhe/DecryptionManager";
import { PositionManager } from "./fhe/PositionManager";
import { createFHERoutes } from "./api/fheRoutes";
import { FHENotifier } from "./websocket/FHENotifier";

const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3002;
const FHE_WS_PORT = process.env.FHE_WS_PORT ? parseInt(process.env.FHE_WS_PORT) : 3003;

async function main() {
  console.log("");
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║       🌑 SHADOW PROTOCOL - Enhanced Backend Server 🌑         ║");
  console.log("║           Private Pre-IPO Leverage Trading Platform           ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log("║  Features:                                                    ║");
  console.log("║  • Market Simulator with Bot Trading                          ║");
  console.log("║  • FHE Decryption Management (Two-Step Claiming)              ║");
  console.log("║  • Real-time WebSocket Notifications                          ║");
  console.log("║  • RESTful API for Frontend Integration                       ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");

  // ==================== MARKET SIMULATOR ====================
  console.log("🎮 Market Simulator başlatılıyor...");

  const engine = new MarketEngine();
  const botManager = new BotManager(engine);
  botManager.start();

  // Market WebSocket Server
  const marketWS = new WSServer(WS_PORT, engine, botManager);

  // ==================== FHE MANAGEMENT ====================
  console.log("🔐 FHE Management başlatılıyor...");

  const decryptionManager = new DecryptionManager({
    expirationMs: 10 * 60 * 1000,  // 10 minutes
    maxPendingPerUser: 5,
    cleanupIntervalMs: 60 * 1000,
  });

  const positionManager = new PositionManager(decryptionManager);

  // FHE WebSocket Server (ayrı port)
  const fheWss = new WebSocketServer({ port: FHE_WS_PORT });
  const fheNotifier = new FHENotifier(decryptionManager, positionManager);

  fheWss.on("connection", (ws: WebSocket) => {
    fheNotifier.addClient(ws);

    ws.on("message", (message: Buffer) => {
      try {
        const parsed = JSON.parse(message.toString());
        fheNotifier.handleMessage(ws, parsed);
      } catch (e) {
        console.error("Invalid FHE message:", e);
      }
    });

    ws.on("close", () => {
      fheNotifier.removeClient(ws);
    });

    ws.on("error", (error) => {
      console.error("FHE WebSocket error:", error);
      fheNotifier.removeClient(ws);
    });
  });

  console.log(`🔔 FHE WebSocket: ws://localhost:${FHE_WS_PORT}`);

  // ==================== REST API ====================
  console.log("🌐 REST API başlatılıyor...");

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      version: "2.0.0",
      uptime: process.uptime(),
      timestamp: Date.now(),
      services: {
        market: {
          clients: marketWS.getConnectedClients(),
          scenario: botManager.getCurrentScenario(),
          assets: engine.getAllAssets().length,
        },
        fhe: {
          clients: fheNotifier.getConnectedClients(),
          authenticatedClients: fheNotifier.getAuthenticatedClients(),
          stats: {
            ...decryptionManager.getStats(),
            ...positionManager.getStats(),
          },
        },
      },
    });
  });

  // ==================== MARKET API ====================
  // Get all assets
  app.get("/api/assets", (req, res) => {
    res.json({
      success: true,
      data: engine.getAllAssets()
    });
  });

  // Get single asset
  app.get("/api/assets/:assetId", (req, res) => {
    const asset = engine.getAsset(req.params.assetId);
    if (asset) {
      res.json({ success: true, data: asset });
    } else {
      res.status(404).json({ success: false, error: "Asset not found" });
    }
  });

  // Get candles
  app.get("/api/candles/:assetId", (req, res) => {
    const count = parseInt(req.query.count as string) || 100;
    res.json({
      success: true,
      data: engine.getCandles(req.params.assetId, count)
    });
  });

  // Get recent trades
  app.get("/api/trades", (req, res) => {
    const assetId = req.query.assetId as string | undefined;
    const count = parseInt(req.query.count as string) || 50;
    res.json({
      success: true,
      data: engine.getRecentTrades(assetId, count)
    });
  });

  // Get trades for specific asset
  app.get("/api/trades/:assetId", (req, res) => {
    const count = parseInt(req.query.count as string) || 50;
    res.json({
      success: true,
      data: engine.getRecentTrades(req.params.assetId, count)
    });
  });

  // ==================== FHE API ====================
  const fheRoutes = createFHERoutes(decryptionManager, positionManager);
  app.use("/api/fhe", fheRoutes);

  // ==================== BOT CONTROL API ====================
  app.get("/api/bot/status", (req, res) => {
    res.json({
      success: true,
      data: {
        isActive: botManager.isActive(),
        currentScenario: botManager.getCurrentScenario(),
      }
    });
  });

  app.post("/api/bot/start", (req, res) => {
    botManager.start();
    res.json({ success: true, message: "Bot started" });
  });

  app.post("/api/bot/stop", (req, res) => {
    botManager.stop();
    res.json({ success: true, message: "Bot stopped" });
  });

  // ==================== ERROR HANDLING ====================
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("API Error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Internal server error"
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: "Endpoint not found"
    });
  });

  // ==================== START SERVER ====================
  app.listen(HTTP_PORT, () => {
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  🚀 Server başlatıldı!");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log(`  📡 REST API:        http://localhost:${HTTP_PORT}`);
    console.log(`  🎮 Market WS:       ws://localhost:${WS_PORT}`);
    console.log(`  🔐 FHE WS:          ws://localhost:${FHE_WS_PORT}`);
    console.log(`  ❤️  Health Check:   http://localhost:${HTTP_PORT}/health`);
    console.log("");
    console.log("  API Endpoints:");
    console.log("  ├── GET  /api/assets          - Tüm asset'ler");
    console.log("  ├── GET  /api/candles/:id     - Mum verileri");
    console.log("  ├── GET  /api/trades          - Son işlemler");
    console.log("  ├── POST /api/fhe/decrypt/*   - FHE Decrypt işlemleri");
    console.log("  ├── GET  /api/fhe/position/*  - Pozisyon sorguları");
    console.log("  └── GET  /api/fhe/stats       - FHE istatistikleri");
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  Bot aktif - Fiyatlar canlı olarak güncelleniyor...");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
  });
}

main().catch(console.error);
