# Shadow Protocol - Claude Memory File
**Son Güncelleme:** 2025-12-11

## Project Overview
**Shadow Protocol** - FHE Pre-IPO Leverage Trading Platform for Zama Builder Track Hackathon

**Temel Konsept:**
- Kullanici pozisyonlari FHE ile sifreleniyor
- Kimse (validator bile) pozisyonlari goremiyor
- Pre-IPO sirketlerde kaldiracli islem (2x-100x)

**GitHub:** https://github.com/Himess/shadow-protocol
**Vercel:** https://shadow-protocol-nine.vercel.app (CANLI!)

---

## CRITICAL: Network Configuration

### ZAMA AYRI BIR CHAIN DEGIL!
- Zama, **Ethereum Sepolia** uzerinde FHE saglıyor
- Sadece IKI network:
  1. **Local Hardhat** - Mock FHE (test)
  2. **Ethereum Sepolia** - Gercek FHE

---

## Contract Addresses (Sepolia)
```
ShadowOracle:            0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17
ShadowMarketMakerSimple: 0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb
ShadowVault:             0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5
ShadowUSD:               0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb
```

**Deployer:** `0xad850C8eB45E80b99ad76A22fBDd0b04F4A1FD27`

---

## PROJE DURUMU (11 Aralik 2025)

### PUAN: 9/10

### BU SESSION'DA YAPILANLAR (10-11 Aralik 2025)

#### Vercel Deployment Fix (7 Commit)
1. `655c5a3` - ACL permissions fix (view → non-view + FHE.allow)
2. `4bc80ab` - global polyfill for browser compatibility
3. `278ad8c` - WalletConnect polyfills (transpilePackages)
4. `80c310d` - require.resolve for events/buffer/process
5. `b79c12d` - DefinePlugin for global (NOT ProvidePlugin!)
6. `194c6e9` - Chart retry logic + unified price source
7. `bdda987` - Chart v5 API + public RPC for rate limiting

#### Asset & Chart Improvements
8. `a02cdad` - Asset sayisi 17 → 6 (en degerli sirketler)
9. `f0f8a07` - Professional TradingView-style drawing tools

### ASSET LISTESI (6 Sirket)
| Sira | Sirket | Valuation | Kategori |
|------|--------|-----------|----------|
| 1 | SpaceX | $350B | Aerospace |
| 2 | ByteDance | $300B | Social |
| 3 | OpenAI | $157B | AI |
| 4 | Stripe | $70B | FinTech |
| 5 | Databricks | $62B | Data |
| 6 | Anthropic | $61B | AI |

### CHART OZELLIKLERI
- **Timeframes:** 1M, 5M, 1H, 1D (hepsi calisiyor!)
- **2 Aylik History:** FHE Launch badge ile (Oct 11)
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

- **Color Picker:** 8 renk secenegi
- **Keyboard Shortcuts:** ESC iptal, Delete son cizimi sil
- **Cursor Info:** Realtime fiyat + tarih gosterimi

---

## TAMAMLANAN OZELLIKLER

### Smart Contracts (3500+ lines)
- [x] **ShadowVault.sol** (1800+ lines) - Ana trading vault
- [x] **ShadowUSD.sol** (527 lines) - ERC-7984 confidential stablecoin
- [x] **ShadowOracle.sol** (448 lines) - Demand-based pricing
- [x] **ShadowLiquidityPool.sol** (618 lines) - GMX-style LP
- [x] **ShadowMarketMaker.sol** - Trading bot

### Frontend (Next.js 14)
- [x] Professional trading UI
- [x] **PriceChart.tsx** - TradingView-style with drawing tools
- [x] Wallet page (Decrypt, Operators, Transfer, LP, History)
- [x] Markets page (6 assets)
- [x] Admin dashboard
- [x] Dark/Light theme

### Documentation
- [x] README with diagrams
- [x] **docs/FHEVM_INTEGRATION.md** (500+ lines)

### Tests
- [x] 53 passing tests

---

## KRITIK TEKNIK BILGILER

### Webpack Polyfills (Vercel icin)
```javascript
// next.config.js - DOGRU YAPILANDIRMA
config.plugins.push(
  new webpack.DefinePlugin({
    "global": "globalThis",  // DefinePlugin KULLAN, ProvidePlugin DEGIL!
  })
);

// Polyfills - require.resolve KULLAN
resolve: {
  fallback: {
    events: require.resolve("events/"),
    buffer: require.resolve("buffer/"),
    process: require.resolve("process/browser"),
  }
}

// transpilePackages - WalletConnect icin GEREKLI
transpilePackages: [
  "@rainbow-me/rainbowkit",
  "@walletconnect/core",
  "@walletconnect/sign-client",
  "@reown/appkit",
  "@metamask/sdk",
]
```

### lightweight-charts v5 API Degisikligi
```javascript
// ESKI (v4) - CALISMAZ!
chart.addCandlestickSeries({...})

// YENI (v5) - DOGRU
const { CandlestickSeries } = await import("lightweight-charts");
chart.addSeries(CandlestickSeries, {...})
```

### RPC Rate Limiting
```javascript
// YANLIS - Infura free tier hizla dolar
const RPC = "https://sepolia.infura.io/v3/...";
const POLL_INTERVAL = 3000; // 3 saniye

// DOGRU - Public RPC + yavas polling
const RPC = "https://rpc.sepolia.org";
const POLL_INTERVAL = 10000; // 10 saniye
```

### ShadowUSD ACL Pattern
```solidity
// YANLIS - view function ACL veremez!
function confidentialBalanceOf() public view returns (euint64) {
    return _balances[msg.sender];  // ACL yok, decrypt edilemez
}

// DOGRU - non-view + ACL grants
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

---

## QUICK COMMANDS

```bash
# Test
npx hardhat test  # 53 passing

# Frontend
cd frontend && npm run dev
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

## DOSYA YAPISI

```
shadow-protocol/
├── contracts/
│   ├── core/
│   │   ├── ShadowVault.sol       (1800+ lines)
│   │   ├── ShadowOracle.sol      (448 lines)
│   │   └── ShadowLiquidityPool.sol (618 lines)
│   ├── tokens/
│   │   └── ShadowUSD.sol         (527 lines)
│   └── bots/
│       └── ShadowMarketMakerSimple.sol (421 lines)
├── frontend/
│   ├── next.config.js            - Webpack polyfills (KRITIK!)
│   └── src/
│       ├── app/
│       │   ├── trade/            - Trading UI
│       │   ├── wallet/           - Decrypt + Operators
│       │   ├── markets/          - 6 assets
│       │   └── providers.tsx     - RPC config
│       ├── components/
│       │   └── PriceChart.tsx    - TradingView drawing tools (850+ lines)
│       ├── hooks/
│       │   └── useLiveOracle.ts  - Unified price source
│       └── lib/
│           ├── constants.ts      - 6 asset definitions
│           ├── polyfills.ts      - Browser globals
│           └── fhe/client.ts     - Relayer SDK
├── docs/
│   └── FHEVM_INTEGRATION.md      (500+ lines)
├── test/
│   └── ShadowProtocol.test.ts    (53 tests)
└── README.md
```

---

## SONUC

Shadow Protocol hackathon icin tamamen hazir:
- Vercel CANLI ve calisiyor
- Chart profesyonel (TradingView-style tools)
- 6 buyuk Pre-IPO asset
- Tum FHE features calisir durumda
- 9 commit bu session'da push edildi

**Eksik:** Demo video (kullanici cekecek)
