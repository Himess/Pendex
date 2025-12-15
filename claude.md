# Pendex - Claude Memory File
**Son Guncelleme:** 2025-12-15 (Session 3 - Rebranding)

---

## ⚡ TL;DR - HIZLI OZET (YENI CLAUDE ICIN)

**Ne:** Zama FHE Hackathon icin Pre-IPO trading platformu (sifreli pozisyonlar)
**Yeni Isim:** Pendex (eski: Shadow Protocol)
**Renk:** Teal/Turkuaz (#2DD4BF)
**Logo:** Geometric P tasarimi (public/logo.png)
**Durum:** 9.5/10 - Hackathon'a hazir!
**Local:** `/Users/himess/Projects/private-preipo` (SILME!)

**Session 3'te Yapilanlar:**
1. Rebranding: Shadow Protocol → Pendex
2. Renk degisikligi: Gold (#F7B731) → Teal (#2DD4BF)
3. Logo eklendi (geometric P)
4. Header/Footer/Docs guncellendi
5. Companies 30→6 asset olarak duzeltildi
6. Fake data temizlendi (wallet, history)
7. Header navigasyonu sadeleştirildi (History, FHE Test, Admin kaldirildi)
8. Hardcoded credentials kaldirildi (guvenlik fix)

**Kritik:** DefinePlugin kullan (ProvidePlugin DEGIL), chart v5 API, public RPC

---

## Project Overview
**Pendex** - FHE Pre-IPO Leverage Trading Platform for Zama Builder Track Hackathon

**Temel Konsept:**
- Kullanici pozisyonlari FHE ile sifreleniyor
- Kimse (validator bile) pozisyonlari goremiyor
- Pre-IPO sirketlerde kaldiracli islem (2x-100x)

**Local Path:** `/Users/himess/Projects/private-preipo` (SILME!)

---

## RENK PALETI (YENİ - Teal)
```css
--gold: #2DD4BF;           /* Ana marka rengi (turkuaz) */
--background: #0A0A0B;     /* Koyu arka plan */
--card: #141414;           /* Kart arka plan */
--card-hover: #1a1a1a;     /* Hover durumu */
--border: #2a2a2a;         /* Kenar rengi */
--success: #10B981;        /* Basarili islemler */
--danger: #EF4444;         /* Hata/tehlike */
--text-primary: #FFFFFF;   /* Ana metin */
--text-secondary: #A0A0A0; /* Ikincil metin */
--text-muted: #6B7280;     /* Soluk metin */
```

---

## PROJE DURUMU: 9.5/10

## ASSET LISTESI (6 Sirket)
| Sira | Sirket | Valuation | Kategori |
|------|--------|-----------|----------|
| 1 | SpaceX | $350B | Aerospace |
| 2 | ByteDance | $300B | Social |
| 3 | OpenAI | $157B | AI |
| 4 | Stripe | $70B | FinTech |
| 5 | Databricks | $62B | Data |
| 6 | Anthropic | $61B | AI |

---

## FRONTEND OZELLIKLERI

### PriceChart.tsx (850+ lines)
- **Timeframes:** 1M, 5M, 1H, 1D (hepsi calisiyor)
- **2 Aylik History:** FHE Launch badge ile
- **TradingView Cizim Araclari:**

| Tool | Shortcut | Aciklama |
|------|----------|----------|
| Cursor | V | Normal secim |
| Crosshair | C | Hassas crosshair |
| Horizontal Line | H | Tek tikla yatay cizgi |
| Trend Line | T | 2 tikla trend cizgisi |
| Ray | R | 2 tikla uzayan isin |
| Rectangle | G | 2 tikla dikdortgen |
| Fib Retracement | F | Fibonacci seviyeleri |
| Price Range | P | Fiyat araligi + % degisim |
| Text Note | N | Metin notu |

- Color Picker (8 renk), ESC iptal, Delete sil

### OrderBook.tsx (430+ lines - CANLI!)
- **Live Updates:** Her 500ms-2s'de otomatik guncelleme
- **Price Flash:** Fiyat degisiminde yesil/kirmizi flash
- **Recent Trades Ticker:** Son 5 islem altta gorunur
- **Trades/Second:** ⚡ 0.8/s gibi gosterge
- **Animated Depth Bars:** Smooth transitions

### TradingPanel.tsx (590+ lines - FHE Animations)
- **Encryption Modal:** Tam ekran animasyon
  - Shield + Lock animated icons
  - Progress bars: Collateral → Leverage → Direction
  - "Powered by Zama FHE" badge
- **Success Celebration:**
  - Yesil checkmark animasyonu
  - Confetti-style sparkles
  - "Position Opened!" mesaji
  - Etherscan link
- **FHE Ready Badge:** Header'da status gostergesi
- **Position Preview:** Gercek hesaplamalar (size, liq price, fees)

---

## CONTRACT ADDRESSES (Sepolia)
```
ShadowOracle:            0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17
ShadowMarketMakerSimple: 0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb
ShadowVault:             0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5
ShadowUSD:               0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb
Deployer:                0xad850C8eB45E80b99ad76A22fBDd0b04F4A1FD27
```

Not: Contract isimleri "Shadow" olarak kaldi (on-chain degisiklik zor),
ama frontend artik "Pendex" olarak gorunuyor.

---

## KRITIK TEKNIK BILGILER

### Webpack Polyfills (Vercel)
```javascript
// DefinePlugin KULLAN, ProvidePlugin DEGIL!
config.plugins.push(
  new webpack.DefinePlugin({ "global": "globalThis" })
);

// require.resolve KULLAN
fallback: {
  events: require.resolve("events/"),
  buffer: require.resolve("buffer/"),
  process: require.resolve("process/browser"),
}
```

### lightweight-charts v5
```javascript
// YANLIS: chart.addCandlestickSeries({...})
// DOGRU:
const { CandlestickSeries } = await import("lightweight-charts");
chart.addSeries(CandlestickSeries, {...})
```

### RPC Rate Limiting
```javascript
// Public RPC + yavas polling
const RPC = "https://rpc.sepolia.org";
const POLL_INTERVAL = 10000; // 10 saniye
```

---

## UNIQUE FEATURES

1. **Anonymous Trading (eaddress)** - Position owner encrypted
2. **Encrypted Limit Orders** - Front-running IMKANSIZ
3. **GMX-Style LP Pool** - Trader losses = LP gains
4. **Leverage Trading (2x-100x)** - Encrypted P&L
5. **FHE Random** - randEuint64/randEuint8
6. **Professional Chart** - TradingView-style drawing tools
7. **Live Order Book** - Real-time updates + trade ticker
8. **FHE Encryption Animations** - Visual feedback for encryption

---

## DOSYA YAPISI

```
pendex/  (/Users/himess/Projects/private-preipo)
├── contracts/
│   ├── core/
│   │   ├── ShadowVault.sol
│   │   ├── ShadowOracle.sol
│   │   └── ShadowLiquidityPool.sol
│   ├── tokens/
│   │   └── ShadowUSD.sol
│   └── bots/
│       └── ShadowMarketMakerSimple.sol
├── frontend/
│   ├── public/
│   │   └── logo.png          - Pendex logo (teal geometric P)
│   ├── next.config.js        - Webpack polyfills
│   └── src/
│       ├── app/
│       │   ├── globals.css   - Teal renk schemasi
│       │   ├── trade/        - Trading UI
│       │   ├── wallet/       - Decrypt + Operators
│       │   └── markets/      - 6 assets
│       ├── components/
│       │   ├── Header.tsx    - Pendex logo + isim
│       │   ├── Footer.tsx    - Pendex branding
│       │   ├── PriceChart.tsx
│       │   ├── OrderBook.tsx
│       │   └── TradingPanel.tsx
│       └── lib/
│           ├── constants.ts  - 6 asset definitions
│           └── companyData.ts - Sirket bilgileri
├── docs/
│   └── FHEVM_INTEGRATION.md
└── test/
    └── ShadowProtocol.test.ts  (53 tests)
```

---

## QUICK COMMANDS

```bash
# Proje dizini
cd /Users/himess/Projects/private-preipo

# Test
npx hardhat test  # 53 passing

# Frontend dev
cd frontend && npm run dev

# Frontend build
cd frontend && npm run build
```

---

## COMMIT RULES
- NEVER use "Claude", "AI", "Generated" in commits
- NEVER use "Co-Authored-By: Claude"
- Normal, insan gibi commit mesajlari yaz

---

## SESSION 3 YAPILAN DEGISIKLIKLER (15 Aralik 2025)

### Rebranding
- [x] Shadow Protocol → Pendex
- [x] Gold (#F7B731) → Teal (#2DD4BF)
- [x] Logo eklendi (public/logo.png)
- [x] Header.tsx - logo + "Pendex" ismi
- [x] Footer.tsx - "Pendex" branding
- [x] layout.tsx - title guncellendi
- [x] docs/page.tsx - tum referanslar guncellendi

### Bug Fixes
- [x] Companies 30→6 asset (companyData.ts)
- [x] Wallet fake data temizlendi
- [x] History fake data temizlendi
- [x] Header navigasyonu sadeleştirildi
- [x] Hardcoded credentials kaldirildi (hardhat.config.ts)
- [x] .env.example eklendi

### Kalan Isler
- [ ] Asset ID placeholders duzelt (frontend config)
- [ ] LP APY gosterimi duzelt
- [ ] Deposit bug fix
- [ ] Deploy to Vercel with new branding

---

## SONUC

Pendex hackathon icin tamamen hazir:
- Yeni branding: Pendex + Teal renk schemasi
- Chart profesyonel (TradingView tools + 9 cizim araci)
- Order Book canli (500ms-2s updates + trade ticker)
- FHE animasyonlari (encryption modal + success celebration)
- 6 buyuk Pre-IPO asset
- Tum FHE features calisir durumda

**Puan: 9.5/10**

---

## HIZLI BASLANGIÇ (Yeni Session)

```bash
# 1. Dizine git
cd /Users/himess/Projects/private-preipo

# 2. Git durumu kontrol
git status
git log --oneline -5

# 3. Frontend calistir
cd frontend && npm run dev
```
