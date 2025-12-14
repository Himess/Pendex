# Shadow Protocol - Claude Memory File
**Son Güncelleme:** 2025-12-11 (Session 2 - Final)

---

## ⚡ TL;DR - HIZLI OZET (YENI CLAUDE ICIN)

**Ne:** Zama FHE Hackathon icin Pre-IPO trading platformu (sifreli pozisyonlar)
**Durum:** 9.5/10 - Hackathon'a hazir!
**Vercel:** https://shadow-protocol-nine.vercel.app (CANLI!)
**GitHub:** https://github.com/Himess/shadow-protocol
**Local:** `/Users/himess/Projects/private-preipo` (SILME!)

**Son Session'da Yapilanlar:**
1. Asset 17→6 (SpaceX, ByteDance, OpenAI, Stripe, Databricks, Anthropic)
2. TradingView cizim araclari (H, T, F, P, R shortcuts)
3. Timeframes (1M, 5M, 1H, 1D)
4. Live Order Book (500ms-2s updates, trade ticker)
5. FHE Encryption animasyonu (modal + progress bars)
6. Success celebration (confetti)
7. Vercel deployment fix (webpack polyfills)

**13 Commit push edildi, son:** `d7caf1d`

**Kalan:** Portfolio Summary Card (nice to have), Demo Video

**Kritik:** DefinePlugin kullan (ProvidePlugin DEGIL), chart v5 API, public RPC

---

## Project Overview
**Shadow Protocol** - FHE Pre-IPO Leverage Trading Platform for Zama Builder Track Hackathon

**Temel Konsept:**
- Kullanici pozisyonlari FHE ile sifreleniyor
- Kimse (validator bile) pozisyonlari goremiyor
- Pre-IPO sirketlerde kaldiracli islem (2x-100x)

**GitHub:** https://github.com/Himess/shadow-protocol
**Vercel:** https://shadow-protocol-nine.vercel.app (CANLI!)

**Local Path:** `/Users/himess/Projects/private-preipo` (SILME!)

---

## PROJE DURUMU: 9.5/10

### TUM COMMITLER (12 adet - 2 session)

#### Session 2 (11 Aralik 2025)
- `d288197` - claude.md update (session 2)
- `8463a1c` - Live order book, FHE encryption animations, UX improvements

#### Session 1 (10-11 Aralik 2025)
- `36c0d8d` - claude.md update
- `f0f8a07` - TradingView drawing tools (9 arac)
- `a02cdad` - 17 → 6 assets + timeframes
- `bdda987` - Chart v5 API + public RPC
- `194c6e9` - Chart retry + price unified
- `b79c12d` - DefinePlugin for global
- `80c310d` - require.resolve polyfills
- `278ad8c` - WalletConnect polyfills
- `4bc80ab` - global polyfill
- `655c5a3` - ACL permissions fix

---

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

### CSS Animasyonları (globals.css)
```css
@keyframes loading     - Progress bar animasyonu
@keyframes scale-in    - Success checkmark icin
@keyframes fly-out     - Confetti efekti
.scrollbar-thin        - 4px ince scrollbar
.scrollbar-none        - Gizli scrollbar
```

---

## CONTRACT ADDRESSES (Sepolia)
```
ShadowOracle:            0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17
ShadowMarketMakerSimple: 0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb
ShadowVault:             0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5
ShadowUSD:               0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb
Deployer:                0xad850C8eB45E80b99ad76A22fBDd0b04F4A1FD27
```

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

### ShadowUSD ACL Pattern
```solidity
// view function ACL VEREMEZ!
// DOGRU: non-view + ACL grants
function confidentialBalanceOf() public returns (euint64 balance) {
    balance = _balances[msg.sender];
    if (FHE.isInitialized(balance)) {
        FHE.allowThis(balance);
        FHE.allow(balance, msg.sender);
    }
}
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

## SMART CONTRACTS (3500+ lines)

- **ShadowVault.sol** (1800+ lines) - Ana trading vault
- **ShadowUSD.sol** (527 lines) - ERC-7984 confidential stablecoin
- **ShadowOracle.sol** (448 lines) - Demand-based pricing
- **ShadowLiquidityPool.sol** (618 lines) - GMX-style LP
- **ShadowMarketMaker.sol** (421 lines) - Trading bot

---

## DOSYA YAPISI

```
shadow-protocol/  (/Users/himess/Projects/private-preipo)
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
│   ├── next.config.js          - Webpack polyfills
│   └── src/
│       ├── app/
│       │   ├── globals.css     - Animasyonlar
│       │   ├── trade/          - Trading UI
│       │   ├── wallet/         - Decrypt + Operators
│       │   └── markets/        - 6 assets
│       ├── components/
│       │   ├── PriceChart.tsx  - Drawing tools (850+ lines)
│       │   ├── OrderBook.tsx   - Live updates (430+ lines)
│       │   └── TradingPanel.tsx - FHE animations (590+ lines)
│       ├── hooks/
│       │   └── useLiveOracle.ts
│       └── lib/
│           ├── constants.ts    - 6 asset definitions
│           └── fhe/client.ts   - FHE SDK
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

# Trading Bot
MARKET_MAKER_ADDRESS=0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb \
ORACLE_ADDRESS=0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17 \
npx hardhat run scripts/runBotSimple.ts --network sepolia
```

---

## COMMIT RULES
- NEVER use "Claude", "AI", "Generated" in commits
- NEVER use "Co-Authored-By: Claude"
- Normal, insan gibi commit mesajlari yaz

---

## TEMIZLIK NOTLARI

- `/tmp/Zolymarket` - Rakip proje klonu, silinebilir
- `/Users/himess/Projects/private-preipo` - ANA PROJE, SILME!

---

## KALAN ISLER

- [ ] Portfolio Summary Card (nice to have)
- [ ] Demo Video (kullanici cekecek)

---

## SONUC

Shadow Protocol hackathon icin tamamen hazir:
- Vercel CANLI: https://shadow-protocol-nine.vercel.app
- GitHub: https://github.com/Himess/shadow-protocol
- Chart profesyonel (TradingView tools + 9 cizim araci)
- Order Book canli (500ms-2s updates + trade ticker)
- FHE animasyonlari (encryption modal + success celebration)
- 6 buyuk Pre-IPO asset
- Tum FHE features calisir durumda
- 12 commit push edildi

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

# 4. Vercel'i kontrol et
# https://shadow-protocol-nine.vercel.app
```
