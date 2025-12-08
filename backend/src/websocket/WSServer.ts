// WebSocket Server - Canlı fiyat yayını

import { WebSocketServer, WebSocket } from "ws";
import { MarketEngine } from "../engine/MarketEngine";
import { BotManager } from "../bots/BotManager";

interface WSMessage {
  type: string;
  data: any;
}

export class WSServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Set<string>> = new Map();
  private engine: MarketEngine;

  constructor(port: number, engine: MarketEngine, botManager: BotManager) {
    this.engine = engine;
    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", (ws) => {
      console.log("📱 Yeni client bağlandı");
      this.clients.set(ws, new Set(["*"])); // Default: tüm assetlere abone

      // İlk bağlantıda tüm asset fiyatlarını gönder
      this.send(ws, {
        type: "INITIAL_STATE",
        data: {
          assets: engine.getAllAssets(),
          timestamp: Date.now(),
        },
      });

      ws.on("message", (message) => {
        try {
          const msg = JSON.parse(message.toString()) as WSMessage;
          this.handleMessage(ws, msg);
        } catch (e) {
          console.error("Invalid message:", e);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log("📴 Client ayrıldı");
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });
    });

    // Bot event'lerini dinle ve yayınla
    this.setupBotListeners(botManager);

    // Periyodik candle güncellemesi (her 5 saniye)
    setInterval(() => {
      this.broadcastCandleUpdates();
    }, 5000);

    console.log(`🌐 WebSocket server port ${port}'da çalışıyor`);
  }

  private handleMessage(ws: WebSocket, msg: WSMessage) {
    switch (msg.type) {
      case "SUBSCRIBE":
        const subs = this.clients.get(ws);
        if (subs && msg.data?.assetId) {
          subs.add(msg.data.assetId);

          // O asset'in mum geçmişini gönder
          this.send(ws, {
            type: "CANDLE_HISTORY",
            data: {
              assetId: msg.data.assetId,
              candles: this.engine.getCandles(msg.data.assetId, 100),
            },
          });

          // Son trade'leri gönder
          this.send(ws, {
            type: "TRADE_HISTORY",
            data: {
              assetId: msg.data.assetId,
              trades: this.engine.getRecentTrades(msg.data.assetId, 20),
            },
          });
        }
        break;

      case "UNSUBSCRIBE":
        this.clients.get(ws)?.delete(msg.data?.assetId);
        break;

      case "GET_ASSETS":
        this.send(ws, {
          type: "ASSETS",
          data: this.engine.getAllAssets(),
        });
        break;

      case "GET_CANDLES":
        if (msg.data?.assetId) {
          this.send(ws, {
            type: "CANDLE_HISTORY",
            data: {
              assetId: msg.data.assetId,
              candles: this.engine.getCandles(msg.data.assetId, msg.data.count || 100),
            },
          });
        }
        break;

      case "GET_TRADES":
        this.send(ws, {
          type: "TRADE_HISTORY",
          data: {
            assetId: msg.data?.assetId,
            trades: this.engine.getRecentTrades(msg.data?.assetId, msg.data?.count || 50),
          },
        });
        break;

      case "PING":
        this.send(ws, { type: "PONG", data: { timestamp: Date.now() } });
        break;
    }
  }

  private setupBotListeners(botManager: BotManager) {
    // Her trade'de
    botManager.on("trade", (trade) => {
      this.broadcast(
        {
          type: "TRADE",
          data: trade,
        },
        trade.assetId
      );
    });

    // Fiyat güncellemesi
    botManager.on("priceUpdate", (update) => {
      this.broadcast(
        {
          type: "PRICE_UPDATE",
          data: update,
        },
        update.assetId
      );
    });

    // Whale alert
    botManager.on("whaleAlert", (alert) => {
      this.broadcastAll({
        type: "WHALE_ALERT",
        data: alert,
      });
    });

    // Haber
    botManager.on("news", (news) => {
      this.broadcastAll({
        type: "NEWS",
        data: news,
      });
    });

    // Senaryo değişimi
    botManager.on("scenarioChange", (change) => {
      this.broadcastAll({
        type: "SCENARIO_CHANGE",
        data: change,
      });
    });
  }

  private broadcastCandleUpdates() {
    const assets = this.engine.getAllAssets();

    assets.forEach((asset) => {
      const currentCandle = this.engine.getCurrentCandle(asset.id);
      if (currentCandle) {
        this.broadcast(
          {
            type: "CANDLE_UPDATE",
            data: {
              assetId: asset.id,
              candle: currentCandle,
            },
          },
          asset.id
        );
      }
    });
  }

  private send(ws: WebSocket, msg: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: WSMessage, assetId: string) {
    this.clients.forEach((subs, ws) => {
      if (subs.has(assetId) || subs.has("*")) {
        this.send(ws, msg);
      }
    });
  }

  private broadcastAll(msg: WSMessage) {
    this.clients.forEach((_, ws) => {
      this.send(ws, msg);
    });
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}
