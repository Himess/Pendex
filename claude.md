# Pendex - Claude Memory File
**Son Guncelleme:** 2025-12-19 (Session 6 - Nice to Have Features + Scripts)

---

## ⚡ TL;DR - HIZLI OZET (YENI CLAUDE ICIN)

**Ne:** Zama FHE Hackathon icin Pre-IPO trading platformu (sifreli pozisyonlar)
**Yeni Isim:** Pendex (eski: Shadow Protocol)
**Renk:** Teal/Turkuaz (#2DD4BF)
**Logo:** Geometric P tasarimi (public/logo.png)
**Durum:** 8/10 - Hackathon'a hazir!
**Local:** `/Users/himess/Projects/private-preipo` (SILME!)
**Live URL:** https://shadow-protocol-nine.vercel.app/

**Session 6'da Yapilanlar:**
1. Transaction History - Blockchain eventlerinden gercek islem gecmisi
2. Anonymous Mode - `openAnonymousPosition` hook entegrasyonu
3. P&L Tracking - FHE-aware gosterim
4. Price Simulator script - Random fiyat degisimleri
5. Keeper Bot script - Limit order execution
6. Add Liquidity script - LP'ye test likidite ekleme
7. Error Handling - TradingPanel iyilestirmeleri

**Kritik:** DefinePlugin kullan (ProvidePlugin DEGIL), chart v5 API, public RPC

---

## Project Overview
**Pendex** - FHE Pre-IPO Leverage Trading Platform for Zama Builder Track Hackathon

**Temel Konsept:**
- Kullanici pozisyonlari FHE ile sifreleniyor
- Kimse (validator bile) pozisyonlari goremiyor
- Pre-IPO sirketlerde kaldiracli islem (1x-10x)

**Local Path:** `/Users/himess/Projects/private-preipo` (SILME!)

---

## PROJE DURUMU: 8/10

### Tamamlanan Ozellikler
- [x] FHE encrypted trading (collateral, leverage, isLong)
- [x] Deposit/Withdraw FHE encryption
- [x] Balance decryption (sUSD, Vault, LP, Rewards)
- [x] Limit orders UI
- [x] Anonymous mode toggle
- [x] Transaction history from blockchain events
- [x] P&L tracking (FHE-aware)
- [x] Price simulator script
- [x] Keeper bot script
- [x] Add liquidity script
- [x] Error handling improvements

### Kalan Isler (YAPILACAKLAR)

#### YUKSEK ONCELIK - Hackathon icin
| # | Is | Aciklama | Zorluk |
|---|-----|----------|--------|
| 1 | End-to-End Test | Gercek FHE transaction test et (deposit → trade → withdraw) | Orta |
| 2 | Demo Video | 2-3 dakikalik proje tanitim videosu | Kolay |

#### ORTA ONCELIK
| # | Is | Aciklama | Zorluk |
|---|-----|----------|--------|
| 3 | README Guncelle | Hackathon icin proje dokumantasyonu | Kolay |
| 4 | Vercel Domain | shadow-protocol-nine.vercel.app → pendex.vercel.app | Kolay |
| 5 | Price Simulator Calistir | Demo sirasinda fiyatlar hareket etsin | Kolay |

#### DUSUK ONCELIK (Nice to Have)
| # | Is | Aciklama | Zorluk |
|---|-----|----------|--------|
| 6 | Keeper Bot Calistir | Limit orderlarin otomatik execute edilmesi | Orta |
| 7 | LP APY Gosterimi | Gercek APY hesaplama | Orta |
| 8 | Mobile Responsive | Mobil uyumluluk kontrol | Orta |

---

## DOSYA YAPISI

```
pendex/  (/Users/himess/Projects/private-preipo)
├── contracts/
│   ├── core/
│   │   ├── ShadowVault.sol         - Ana trading vault (FHE)
│   │   ├── ShadowOracle.sol        - Fiyat oracle
│   │   └── ShadowLiquidityPool.sol - LP pool
│   ├── tokens/
│   │   └── ShadowUSD.sol           - Stablecoin
│   └── bots/
│       └── ShadowMarketMakerSimple.sol
├── scripts/                         - YENI SCRIPTLER
│   ├── priceSimulator.ts           - Fiyat simulasyonu
│   ├── keeperBot.ts                - Limit order keeper
│   ├── addLiquidity.ts             - LP likidite ekleme
│   └── addAssets.ts                - Oracle asset ekleme
├── frontend/
│   ├── public/
│   │   └── logo.png
│   ├── next.config.js
│   └── src/
│       ├── app/
│       │   ├── globals.css
│       │   ├── trade/page.tsx
│       │   ├── wallet/page.tsx     - FHE deposit/withdraw + history
│       │   ├── markets/page.tsx
│       │   ├── companies/page.tsx
│       │   └── docs/page.tsx
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── Footer.tsx
│       │   ├── PriceChart.tsx      - TradingView-style chart
│       │   ├── OrderBook.tsx       - Canli order book
│       │   └── TradingPanel.tsx    - FHE trading + error handling
│       └── lib/
│           ├── constants.ts
│           ├── companyData.ts
│           ├── fhe/client.ts       - FHE SDK wrapper
│           └── contracts/
│               ├── hooks.ts        - Wagmi hooks
│               └── abis.ts         - Contract ABIs
├── docs/
│   └── FHEVM_INTEGRATION.md
└── test/
    └── ShadowProtocol.test.ts
```

---

## CONTRACT ADDRESSES (Sepolia)
```
ShadowOracle:            0x9A5Fec3b1999cCBfC3a33EF5cdf09fdecad52301
ShadowUSD:               0xa1FFdD728C13Eb72F928491d3E6D9245AE614cf6
ShadowLiquidityPool:     0xB0a1fb939C017f17d79F6049A21b4b2fB9423d73
ShadowVault:             0x486eF23A22Ab485851bE386da07767b070a51e82
ShadowMarketMaker:       0xa779cB24c82307a19d4E4E01B3B0879fF635D02F
Deployer:                0xad850C8eB45E80b99ad76A22fBDd0b04F4A1FD27
```

### Sepolia FHE Adresleri
```
Coprocessor:  0x92C920834Ec8941d2C77D188936E1f7A6f49c127
ACL:          0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D
KMS Verifier: 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A
```

---

## ASSET LISTESI (6 Sirket)
| Sira | Sirket | Fiyat | Kategori | Asset ID |
|------|--------|-------|----------|----------|
| 1 | OpenAI | $250 | AI | 0xbfe1b9d... |
| 2 | Anthropic | $95 | AI | 0xee2176d... |
| 3 | SpaceX | $180 | Aerospace | 0x9fd352a... |
| 4 | Stripe | $48 | FinTech | 0x8eddee8... |
| 5 | Databricks | $55 | Data | 0x0bf812f... |
| 6 | ByteDance | $165 | Social | 0x7a8e8d0... |

---

## QUICK COMMANDS

```bash
# Proje dizini
cd /Users/himess/Projects/private-preipo

# Frontend dev
cd frontend && npm run dev

# Frontend build
cd frontend && npm run build

# Hardhat test
npx hardhat test

# === YENI SCRIPTLER ===

# Fiyat simulasyonu (surekli)
npx hardhat run scripts/priceSimulator.ts --network sepolia

# Fiyat simulasyonu (tek seferlik)
npx hardhat run scripts/priceSimulator.ts --network sepolia -- --once

# Keeper bot (surekli)
npx hardhat run scripts/keeperBot.ts --network sepolia

# Keeper bot (tek seferlik)
npx hardhat run scripts/keeperBot.ts --network sepolia -- --once

# LP'ye likidite ekle
npx hardhat run scripts/addLiquidity.ts --network sepolia
```

---

## SESSION 6 - NICE TO HAVE FEATURES (19 Aralik 2025)

### Tamamlanan Isler

#### 1. Transaction History (wallet/page.tsx)
- Blockchain eventlerinden gercek islem gecmisi
- PositionOpened, PositionClosed, LiquidityAdded, LiquidityRemoved, RewardsClaimed, Mint
- Son 7 gunluk eventler (~50400 block)
- Etherscan linkleri

#### 2. Anonymous Mode (TradingPanel.tsx)
- `useOpenAnonymousPosition` hook eklendi
- Toggle acikken `openAnonymousPosition` cagiriliyor
- eaddress ile encrypted owner

#### 3. P&L Tracking (wallet/page.tsx)
- FHE Protected badge
- Position sayilari transaction history'den
- Privacy bilgisi

#### 4. Price Simulator (scripts/priceSimulator.ts)
- %1-2 random fiyat degisimi
- 30 saniyede bir guncelleme
- Min/max limitler (base price'in %80-%120)

#### 5. Keeper Bot (scripts/keeperBot.ts)
- Limit orderlari kontrol eder
- Liquidation'lari kontrol eder
- 60 saniyede bir calisir

#### 6. Add Liquidity (scripts/addLiquidity.ts)
- LP'ye $100,000 test likidite ekler

#### 7. Error Handling (TradingPanel.tsx)
- Yuksek leverage uyarisi (8-9x sari, 10x kirmizi)
- User-friendly error mesajlari
- Retry butonu (network/timeout hatalari icin)
- Error mesaji 8 saniye gorunur

---

## TEKNIK NOTLAR

### FHE Decryption Flow
```typescript
const handle = await contract.confidentialBalanceOf(address);
const keypair = instance.generateKeypair();
const eip712 = instance.createEIP712(keypair.publicKey, [contractAddr], startTime, "1");
const signature = await signer.signTypedData(eip712.domain, eip712.types, eip712.message);
const results = await instance.userDecrypt([{handle, contractAddress}], ...);
```

### FHE Encryption Flow
```typescript
const input = instance.createEncryptedInput(contractAddress, userAddress);
input.add64(BigInt(amount));
const encrypted = await input.encrypt();
await contract.deposit(encrypted.handles[0], encrypted.inputProof);
```

### Webpack Polyfills
```javascript
config.plugins.push(
  new webpack.DefinePlugin({ "global": "globalThis" })
);
fallback: {
  events: require.resolve("events/"),
  buffer: require.resolve("buffer/"),
  process: require.resolve("process/browser"),
}
```

---

## RENK PALETI
```css
--gold: #2DD4BF;           /* Ana marka rengi (turkuaz) */
--background: #0A0A0B;     /* Koyu arka plan */
--card: #141414;           /* Kart arka plan */
--success: #10B981;        /* Basarili islemler */
--danger: #EF4444;         /* Hata/tehlike */
```

---

## UNIQUE FEATURES

1. **Anonymous Trading (eaddress)** - Position owner encrypted
2. **Encrypted Limit Orders** - Front-running IMKANSIZ
3. **GMX-Style LP Pool** - Trader losses = LP gains
4. **Leverage Trading (1x-10x)** - Encrypted P&L
5. **FHE Random** - randEuint64/randEuint8
6. **Professional Chart** - TradingView-style drawing tools
7. **Live Order Book** - Real-time updates + trade ticker
8. **FHE Encryption Animations** - Visual feedback

---

## SONUC

Pendex hackathon icin hazir:
- FHE encrypted trading
- Anonymous mode
- Real transaction history
- Price simulation
- Keeper bot
- Error handling

**Puan: 8/10** - Demo icin hazir!

### Siradaki Adimlar:
1. End-to-end test yap (deposit → trade → withdraw)
2. Demo video cek (2-3 dk)
3. README guncelle
4. Vercel domain degistir (pendex.vercel.app)

**Live URL:** https://shadow-protocol-nine.vercel.app/

---

## YENI SESSION ICIN PROMPT

Yeni terminalde su promptu kullan:

```
Pendex projesine devam ediyorum. Bu bir Zama FHE Hackathon projesi - Pre-IPO sirketlerde (SpaceX, OpenAI, Anthropic vb.) FHE encrypted kaldiracli trading platformu.

Proje dizini: /Users/himess/Projects/private-preipo
Frontend: /Users/himess/Projects/private-preipo/frontend

Lutfen once claude.md dosyasini oku:
cat /Users/himess/Projects/private-preipo/claude.md

Sonra ne yapmami istedigimi soyle.
```

---

## HIZLI BASLANGIÇ (Yeni Session)

```bash
# 1. Dizine git
cd /Users/himess/Projects/private-preipo

# 2. Claude.md'yi oku
cat claude.md

# 3. Git durumu kontrol
git status
git log --oneline -5

# 4. Frontend calistir
cd frontend && npm run dev
```
