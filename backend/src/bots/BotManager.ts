// Bot Manager - Otomatik trade ve senaryo yönetimi

import { EventEmitter } from "events";
import { MarketEngine, Trade, Sentiment, Asset } from "../engine/MarketEngine";

export type Scenario = "PUMP" | "DUMP" | "SIDEWAYS" | "VOLATILE" | "WHALE_ACCUMULATION" | "WHALE_DISTRIBUTION";

interface ScenarioParams {
  buyProbability: number;
  retailAvgSize: number;
  whaleAvgSize: number;
  tradeFrequency: number; // ms
}

interface NewsEvent {
  assetId: string;
  headline: string;
  sentiment: Sentiment;
  impact: number; // 1-10
}

const SCENARIO_CONFIGS: Record<Scenario, ScenarioParams> = {
  PUMP: { buyProbability: 0.75, retailAvgSize: 50000, whaleAvgSize: 2000000, tradeFrequency: 2000 },
  DUMP: { buyProbability: 0.25, retailAvgSize: 50000, whaleAvgSize: 2000000, tradeFrequency: 2000 },
  SIDEWAYS: { buyProbability: 0.50, retailAvgSize: 30000, whaleAvgSize: 500000, tradeFrequency: 3000 },
  VOLATILE: { buyProbability: 0.50, retailAvgSize: 80000, whaleAvgSize: 3000000, tradeFrequency: 1500 },
  WHALE_ACCUMULATION: { buyProbability: 0.70, retailAvgSize: 20000, whaleAvgSize: 5000000, tradeFrequency: 4000 },
  WHALE_DISTRIBUTION: { buyProbability: 0.30, retailAvgSize: 20000, whaleAvgSize: 5000000, tradeFrequency: 4000 },
};

const NEWS_EVENTS: NewsEvent[] = [
  // SpaceX
  { assetId: "spacex", headline: "SpaceX Starship test successful!", sentiment: "BULLISH", impact: 7 },
  { assetId: "spacex", headline: "SpaceX launch delayed due to weather", sentiment: "BEARISH", impact: 3 },
  { assetId: "spacex", headline: "SpaceX secures $2B NASA contract", sentiment: "EXTREME_GREED", impact: 9 },

  // Stripe
  { assetId: "stripe", headline: "Stripe IPO rumors intensify", sentiment: "BULLISH", impact: 8 },
  { assetId: "stripe", headline: "Stripe expands to 10 new countries", sentiment: "BULLISH", impact: 5 },
  { assetId: "stripe", headline: "Stripe faces regulatory scrutiny", sentiment: "BEARISH", impact: 4 },

  // OpenAI
  { assetId: "openai", headline: "OpenAI announces GPT-5!", sentiment: "EXTREME_GREED", impact: 10 },
  { assetId: "openai", headline: "OpenAI leadership changes", sentiment: "BEARISH", impact: 6 },
  { assetId: "openai", headline: "Microsoft increases OpenAI investment", sentiment: "BULLISH", impact: 7 },

  // Databricks
  { assetId: "databricks", headline: "Databricks lands major enterprise deal", sentiment: "BULLISH", impact: 6 },

  // Discord
  { assetId: "discord", headline: "Discord hits 200M monthly users", sentiment: "BULLISH", impact: 5 },

  // Revolut
  { assetId: "revolut", headline: "Revolut obtains UK banking license", sentiment: "EXTREME_GREED", impact: 8 },

  // Anthropic
  { assetId: "anthropic", headline: "Anthropic raises $4B in new funding", sentiment: "EXTREME_GREED", impact: 9 },
  { assetId: "anthropic", headline: "Claude 4 benchmarks exceed GPT-5", sentiment: "BULLISH", impact: 8 },

  // General market
  { assetId: "all", headline: "Tech sector rally continues", sentiment: "BULLISH", impact: 4 },
  { assetId: "all", headline: "Market volatility increases", sentiment: "NEUTRAL", impact: 5 },
  { assetId: "all", headline: "Pre-IPO valuations under pressure", sentiment: "BEARISH", impact: 5 },
];

export class BotManager extends EventEmitter {
  private engine: MarketEngine;
  private isRunning: boolean = false;
  private currentScenario: Scenario = "SIDEWAYS";
  private tradeInterval: NodeJS.Timeout | null = null;
  private scenarioInterval: NodeJS.Timeout | null = null;
  private newsInterval: NodeJS.Timeout | null = null;

  constructor(engine: MarketEngine) {
    super();
    this.engine = engine;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("🤖 BotManager başlatıldı");

    // Trade döngüsü
    this.startTradeLoop();

    // Senaryo değiştirici (3-10 dakika)
    this.startScenarioChanger();

    // Haber/event tetikleyici (5-15 dakika)
    this.startNewsEvents();
  }

  stop() {
    this.isRunning = false;
    if (this.tradeInterval) clearInterval(this.tradeInterval);
    if (this.scenarioInterval) clearTimeout(this.scenarioInterval);
    if (this.newsInterval) clearTimeout(this.newsInterval);
    console.log("🛑 BotManager durduruldu");
  }

  // ==================== TRADE LOOP ====================

  private startTradeLoop() {
    const executeTrades = () => {
      if (!this.isRunning) return;

      const params = SCENARIO_CONFIGS[this.currentScenario];

      // Rastgele asset seç
      const assets = this.engine.getAllAssets();
      const asset = assets[Math.floor(Math.random() * assets.length)];

      // Whale mı retail mı?
      const isWhale = Math.random() < 0.05; // %5 whale

      // Trade yönü
      const isBuy = Math.random() < params.buyProbability;

      // Trade büyüklüğü
      const baseSize = isWhale ? params.whaleAvgSize : params.retailAvgSize;
      const size = Math.floor(baseSize * (0.5 + Math.random()));

      // Trade çalıştır
      const trade = this.engine.executeTrade({
        assetId: asset.id,
        side: isBuy ? "BUY" : "SELL",
        size,
        isEncrypted: Math.random() < 0.7,
        botType: isWhale ? "WHALE" : "RETAIL",
      });

      if (trade) {
        // Event emit
        this.emit("trade", trade);

        this.emit("priceUpdate", {
          assetId: asset.id,
          price: this.engine.getAsset(asset.id)?.price,
          change24h: this.engine.getAsset(asset.id)?.change24h,
          timestamp: Date.now(),
        });

        // Whale alert
        if (isWhale && size > 1000000) {
          this.emit("whaleAlert", {
            assetId: asset.id,
            side: trade.side,
            size: trade.size,
            priceImpact: ((trade.price - asset.price) / asset.price) * 100,
            timestamp: Date.now(),
          });
        }
      }

      // Sonraki trade
      const nextTradeDelay = params.tradeFrequency * (0.5 + Math.random());
      this.tradeInterval = setTimeout(executeTrades, nextTradeDelay);
    };

    executeTrades();
  }

  // ==================== SCENARIO CHANGER ====================

  private startScenarioChanger() {
    const changeScenario = () => {
      if (!this.isRunning) return;

      const scenarios: Scenario[] = ["PUMP", "DUMP", "SIDEWAYS", "VOLATILE", "WHALE_ACCUMULATION", "WHALE_DISTRIBUTION"];
      const weights = [0.15, 0.15, 0.40, 0.15, 0.075, 0.075];

      this.currentScenario = this.weightedRandom(scenarios, weights);

      console.log(`🎭 Senaryo değişti: ${this.currentScenario}`);

      this.emit("scenarioChange", {
        scenario: this.currentScenario,
        timestamp: Date.now(),
      });

      // Sonraki değişim (3-10 dakika)
      const nextChange = 180000 + Math.random() * 420000;
      this.scenarioInterval = setTimeout(changeScenario, nextChange);
    };

    // İlk değişim 1-2 dakika içinde
    setTimeout(changeScenario, 60000 + Math.random() * 60000);
  }

  // ==================== NEWS EVENTS ====================

  private startNewsEvents() {
    const triggerNews = () => {
      if (!this.isRunning) return;

      const event = NEWS_EVENTS[Math.floor(Math.random() * NEWS_EVENTS.length)];

      console.log(`📰 HABER: ${event.headline}`);

      // Sentiment güncelle
      if (event.assetId === "all") {
        // Tüm assetleri etkile
        this.engine.getAllAssets().forEach(asset => {
          this.engine.setSentiment(asset.id, event.sentiment, event.headline);
        });
      } else {
        this.engine.setSentiment(event.assetId, event.sentiment, event.headline);
      }

      this.emit("news", {
        ...event,
        timestamp: Date.now(),
      });

      // Büyük haberler için ekstra trade'ler
      if (event.impact >= 7) {
        const targetAssets = event.assetId === "all"
          ? this.engine.getAllAssets()
          : [this.engine.getAsset(event.assetId)].filter(Boolean) as Asset[];

        targetAssets.forEach(asset => {
          // 3-5 büyük trade
          for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
            setTimeout(() => {
              const isBullish = event.sentiment === "BULLISH" || event.sentiment === "EXTREME_GREED";
              this.engine.executeTrade({
                assetId: asset.id,
                side: isBullish ? "BUY" : "SELL",
                size: 500000 + Math.random() * 1500000,
                botType: "WHALE",
              });
            }, i * 500);
          }
        });
      }

      // Sonraki haber (5-15 dakika)
      const nextNews = 300000 + Math.random() * 600000;
      this.newsInterval = setTimeout(triggerNews, nextNews);
    };

    // İlk haber 2-5 dakika içinde
    setTimeout(triggerNews, 120000 + Math.random() * 180000);
  }

  // ==================== HELPERS ====================

  private weightedRandom<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }

    return items[items.length - 1];
  }

  // ==================== GETTERS ====================

  getCurrentScenario(): Scenario {
    return this.currentScenario;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
