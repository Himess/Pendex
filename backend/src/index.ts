// Shadow Protocol - Market Simulator
// Backend entry point

import express from "express";
import cors from "cors";
import { MarketEngine } from "./engine/MarketEngine";
import { BotManager } from "./bots/BotManager";
import { WSServer } from "./websocket/WSServer";

const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3002;

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║       🌑 SHADOW PROTOCOL - Market Simulator 🌑            ║");
  console.log("║           Pre-IPO Leverage Trading Platform               ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");

  // Market engine
  const engine = new MarketEngine();

  // Bot manager
  const botManager = new BotManager(engine);
  botManager.start();

  // WebSocket server
  const wsServer = new WSServer(WS_PORT, engine, botManager);

  // REST API (opsiyonel - debug ve healthcheck için)
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      clients: wsServer.getConnectedClients(),
      scenario: botManager.getCurrentScenario(),
    });
  });

  // Get all assets
  app.get("/api/assets", (req, res) => {
    res.json(engine.getAllAssets());
  });

  // Get single asset
  app.get("/api/assets/:assetId", (req, res) => {
    const asset = engine.getAsset(req.params.assetId);
    if (asset) {
      res.json(asset);
    } else {
      res.status(404).json({ error: "Asset not found" });
    }
  });

  // Get candles
  app.get("/api/candles/:assetId", (req, res) => {
    const count = parseInt(req.query.count as string) || 100;
    res.json(engine.getCandles(req.params.assetId, count));
  });

  // Get recent trades
  app.get("/api/trades", (req, res) => {
    const assetId = req.query.assetId as string | undefined;
    const count = parseInt(req.query.count as string) || 50;
    res.json(engine.getRecentTrades(assetId, count));
  });

  // Get trades for specific asset
  app.get("/api/trades/:assetId", (req, res) => {
    const count = parseInt(req.query.count as string) || 50;
    res.json(engine.getRecentTrades(req.params.assetId, count));
  });

  app.listen(HTTP_PORT, () => {
    console.log("");
    console.log(`📡 REST API:      http://localhost:${HTTP_PORT}`);
    console.log(`🌐 WebSocket:     ws://localhost:${WS_PORT}`);
    console.log(`❤️  Health Check: http://localhost:${HTTP_PORT}/health`);
    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  Bot aktif - Fiyatlar canlı olarak güncelleniyor...");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
  });
}

main().catch(console.error);
