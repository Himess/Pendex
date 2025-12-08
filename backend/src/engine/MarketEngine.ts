// Market Engine - Fiyat hesaplama ve mum yönetimi

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  basePrice: number;
  volatility: number;
  sentiment: Sentiment;
  momentum: number;
  volume24h: number;
  change24h: number;
}

export type Sentiment = "EXTREME_FEAR" | "BEARISH" | "NEUTRAL" | "BULLISH" | "EXTREME_GREED";

export interface Trade {
  id: string;
  assetId: string;
  timestamp: number;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  isEncrypted: boolean;
  botType: "RETAIL" | "WHALE" | "MARKET_MAKER";
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Pre-IPO asset configurations
const ASSET_CONFIGS = [
  { id: "spacex", symbol: "SPACEX", name: "SpaceX", basePrice: 350, volatility: 0.025 },
  { id: "stripe", symbol: "STRIPE", name: "Stripe", basePrice: 65, volatility: 0.018 },
  { id: "openai", symbol: "OPENAI", name: "OpenAI", basePrice: 157, volatility: 0.030 },
  { id: "databricks", symbol: "DATABRICKS", name: "Databricks", basePrice: 62, volatility: 0.022 },
  { id: "discord", symbol: "DISCORD", name: "Discord", basePrice: 15, volatility: 0.020 },
  { id: "revolut", symbol: "REVOLUT", name: "Revolut", basePrice: 45, volatility: 0.019 },
  { id: "canva", symbol: "CANVA", name: "Canva", basePrice: 26, volatility: 0.017 },
  { id: "plaid", symbol: "PLAID", name: "Plaid", basePrice: 13.4, volatility: 0.021 },
  { id: "instacart", symbol: "INSTACART", name: "Instacart", basePrice: 30, volatility: 0.023 },
  { id: "figma", symbol: "FIGMA", name: "Figma", basePrice: 12.5, volatility: 0.019 },
  { id: "notion", symbol: "NOTION", name: "Notion", basePrice: 10, volatility: 0.020 },
  { id: "airtable", symbol: "AIRTABLE", name: "Airtable", basePrice: 11.6, volatility: 0.018 },
  { id: "reddit", symbol: "REDDIT", name: "Reddit", basePrice: 6.4, volatility: 0.028 },
  { id: "epic", symbol: "EPIC", name: "Epic Games", basePrice: 31.5, volatility: 0.024 },
  { id: "kraken", symbol: "KRAKEN", name: "Kraken", basePrice: 10.8, volatility: 0.032 },
  { id: "anthropic", symbol: "ANTHROPIC", name: "Anthropic", basePrice: 18.5, volatility: 0.035 },
  { id: "anduril", symbol: "ANDURIL", name: "Anduril", basePrice: 12.5, volatility: 0.026 },
];

export class MarketEngine {
  private assets: Map<string, Asset> = new Map();
  private candles: Map<string, Candle[]> = new Map();
  private currentCandle: Map<string, Candle> = new Map();
  private trades: Trade[] = [];
  private tradeCounter = 0;

  private readonly CANDLE_INTERVAL = 60000; // 1 dakika
  private readonly MAX_CANDLES = 500;
  private readonly MAX_TRADES = 1000;

  constructor() {
    this.initializeAssets();
    this.startCandleTimer();
    console.log(`📊 MarketEngine başlatıldı - ${this.assets.size} asset yüklendi`);
  }

  private initializeAssets() {
    ASSET_CONFIGS.forEach(config => {
      // Başlangıçta küçük rastgele sapma ekle
      const initialPrice = config.basePrice * (0.98 + Math.random() * 0.04);

      this.assets.set(config.id, {
        ...config,
        price: initialPrice,
        sentiment: "NEUTRAL",
        momentum: 0,
        volume24h: Math.floor(Math.random() * 50000000) + 10000000,
        change24h: (Math.random() - 0.5) * 10,
      });

      this.candles.set(config.id, []);
      this.startNewCandle(config.id);
    });
  }

  // ==================== TRADE EXECUTION ====================

  executeTrade(params: {
    assetId: string;
    side: "BUY" | "SELL";
    size: number;
    isEncrypted?: boolean;
    botType?: "RETAIL" | "WHALE" | "MARKET_MAKER";
  }): Trade | null {
    const asset = this.assets.get(params.assetId);
    if (!asset) return null;

    // Fiyat etkisini hesapla
    const impact = this.calculatePriceImpact(asset, params.size, params.side);

    // Yeni fiyat
    const oldPrice = asset.price;
    let newPrice: number;

    if (params.side === "BUY") {
      newPrice = oldPrice * (1 + impact);
    } else {
      newPrice = oldPrice * (1 - impact);
    }

    // Fiyatın çok sapmasını engelle (base price'ın %50'si ile %200'ü arası)
    newPrice = Math.max(asset.basePrice * 0.5, Math.min(asset.basePrice * 2, newPrice));

    asset.price = newPrice;

    // Momentum güncelle
    asset.momentum = this.updateMomentum(asset.momentum, params.side === "BUY" ? 0.1 : -0.1);

    // 24h change güncelle
    asset.change24h = ((newPrice - asset.basePrice) / asset.basePrice) * 100;

    // Volume güncelle
    asset.volume24h += params.size;

    // Trade kaydı oluştur
    const trade: Trade = {
      id: `trade_${++this.tradeCounter}_${Date.now()}`,
      assetId: params.assetId,
      timestamp: Date.now(),
      side: params.side,
      size: params.size,
      price: newPrice,
      isEncrypted: params.isEncrypted ?? Math.random() < 0.7,
      botType: params.botType ?? "RETAIL",
    };

    this.trades.push(trade);
    if (this.trades.length > this.MAX_TRADES) {
      this.trades.shift();
    }

    // Mevcut mumu güncelle
    this.updateCurrentCandle(params.assetId, newPrice, params.size);

    return trade;
  }

  private calculatePriceImpact(asset: Asset, size: number, side: "BUY" | "SELL"): number {
    // Temel etki: hacim * volatilite
    let baseImpact = (size / 10000000) * asset.volatility;

    // Sentiment çarpanı
    const sentimentMultiplier: Record<Sentiment, number> = {
      EXTREME_GREED: side === "BUY" ? 1.5 : 0.5,
      BULLISH: side === "BUY" ? 1.2 : 0.8,
      NEUTRAL: 1.0,
      BEARISH: side === "BUY" ? 0.8 : 1.2,
      EXTREME_FEAR: side === "BUY" ? 0.5 : 1.5,
    };

    baseImpact *= sentimentMultiplier[asset.sentiment];

    // Momentum etkisi
    if ((side === "BUY" && asset.momentum > 0) || (side === "SELL" && asset.momentum < 0)) {
      baseImpact *= 1 + Math.abs(asset.momentum) * 0.5;
    }

    // Rastgele gürültü
    baseImpact *= 0.8 + Math.random() * 0.4;

    // Max %5 tek trade etkisi
    return Math.min(baseImpact, 0.05);
  }

  private updateMomentum(current: number, change: number): number {
    const newMomentum = current * 0.95 + change;
    return Math.max(-1, Math.min(1, newMomentum));
  }

  // ==================== CANDLE MANAGEMENT ====================

  private startCandleTimer() {
    setInterval(() => {
      this.assets.forEach((_, assetId) => {
        this.closeCurrentCandle(assetId);
        this.startNewCandle(assetId);
      });
    }, this.CANDLE_INTERVAL);
  }

  private startNewCandle(assetId: string) {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    this.currentCandle.set(assetId, {
      timestamp: Date.now(),
      open: asset.price,
      high: asset.price,
      low: asset.price,
      close: asset.price,
      volume: 0,
    });
  }

  private updateCurrentCandle(assetId: string, price: number, volume: number) {
    const candle = this.currentCandle.get(assetId);
    if (!candle) return;

    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;
    candle.volume += volume;
  }

  private closeCurrentCandle(assetId: string) {
    const candle = this.currentCandle.get(assetId);
    if (!candle) return;

    const history = this.candles.get(assetId);
    if (!history) return;

    history.push({ ...candle });

    if (history.length > this.MAX_CANDLES) {
      history.shift();
    }
  }

  // ==================== SENTIMENT ====================

  setSentiment(assetId: string, sentiment: Sentiment, reason: string): void {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    const oldSentiment = asset.sentiment;
    asset.sentiment = sentiment;

    // Volatiliteyi ayarla
    if (sentiment === "EXTREME_FEAR" || sentiment === "EXTREME_GREED") {
      asset.volatility *= 2;
    } else if (oldSentiment === "EXTREME_FEAR" || oldSentiment === "EXTREME_GREED") {
      asset.volatility /= 2;
    }

    console.log(`🎭 ${asset.symbol} sentiment: ${oldSentiment} → ${sentiment} (${reason})`);
  }

  // ==================== GETTERS ====================

  getAsset(assetId: string): Asset | undefined {
    return this.assets.get(assetId);
  }

  getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  getCandles(assetId: string, count: number = 100): Candle[] {
    const history = this.candles.get(assetId) || [];
    const current = this.currentCandle.get(assetId);

    const result = history.slice(-count);
    if (current) {
      result.push({ ...current });
    }

    return result;
  }

  getCurrentCandle(assetId: string): Candle | undefined {
    return this.currentCandle.get(assetId);
  }

  getRecentTrades(assetId?: string, count: number = 50): Trade[] {
    let trades = this.trades;
    if (assetId) {
      trades = trades.filter(t => t.assetId === assetId);
    }
    return trades.slice(-count);
  }
}
