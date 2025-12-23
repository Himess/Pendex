# Pendex - Claude Memory File
**Son Guncelleme:** 2025-12-20 (Session 8 - Direct sUSD Trading)

---

## ⚡ TL;DR - HIZLI OZET (YENI CLAUDE ICIN)

**Ne:** Zama FHE Hackathon icin Pre-IPO trading platformu (sifreli pozisyonlar)
**Yeni Isim:** Pendex (eski: Shadow Protocol)
**Renk:** Teal/Turkuaz (#2DD4BF)
**Logo:** Geometric P tasarimi (public/logo.png)
**Durum:** 9/10 - FHE CALISIYOR!
**Windows Path:** `C:\Users\USER\shadow-protocol\frontend`
**Live URL:** https://shadow-protocol-nine.vercel.app/

**Session 8'de Yapilanlar:**
1. DIRECT sUSD TRADING - Vault deposit gereksiz, Hyperliquid gibi!
2. Contract'lar guncellendi - openPosition/closePosition sUSD kullanir
3. TradingPanel sUSD balance gosteriyor
4. Faucet'ten alinca direkt trade edebilirsin

**Session 7'de Yapilanlar:**
1. FHE SDK WASM sorunu COZULDU - initSDK() + webpack asset/resource
2. EIP-712 signing fix - viem object format
3. Clean UI - FHE badges kaldirildi, otomatik decrypt
4. Invisible FHE - arka planda calisiyor, user fark etmiyor

**KRITIK OGRENIMLER:**
- `initSDK()` MUTLAKA `createInstance()` ONCE cagirilmali
- WASM icin `type: "asset/resource"` kullan (webassembly/async DEGIL)
- Viem signTypedData object format: `{domain, types, primaryType, message}`
- gatewayChainId: 10901 (DOGRU - Zama docs & FHEIGHT projesi ile uyumlu)
- Relayer URL: `https://relayer.testnet.zama.org` (.org DOGRU, .cloud DNS yok)
- **sUSD direkt kullan** - vault deposit GEREKSIZ!

---

## Project Overview
**Pendex** - FHE Pre-IPO Leverage Trading Platform for Zama Builder Track Hackathon

**Temel Konsept:**
- Kullanici pozisyonlari FHE ile sifreleniyor
- Kimse (validator bile) pozisyonlari goremiyor
- Pre-IPO sirketlerde kaldiracli islem (1x-10x)

**Windows Path:** `C:\Users\USER\shadow-protocol`

---

## PROJE DURUMU: 9/10

### Tamamlanan Ozellikler
- [x] FHE encrypted trading (collateral, leverage, isLong)
- [x] Deposit/Withdraw FHE encryption
- [x] Balance decryption - GERCEK FHE CALISIYOR!
- [x] Auto-decrypt on page load
- [x] Clean UI - no FHE badges
- [x] Limit orders UI
- [x] Anonymous mode toggle
- [x] Transaction history from blockchain events
- [x] P&L tracking
- [x] Price simulator script
- [x] Keeper bot script
- [x] Add liquidity script
- [x] Error handling improvements

### Kalan Isler (YAPILACAKLAR)

#### YUKSEK ONCELIK - Hackathon icin
| # | Is | Aciklama | Zorluk |
|---|-----|----------|--------|
| 1 | End-to-End Test | Trade ac → pozisyon kapat (deposit zaten test edildi) | Orta |
| 2 | Demo Video | 2-3 dakikalik proje tanitim videosu | Kolay |

#### ORTA ONCELIK
| # | Is | Aciklama | Zorluk |
|---|-----|----------|--------|
| 3 | README Guncelle | Hackathon icin proje dokumantasyonu | Kolay |

---

## SESSION 8 - DIRECT sUSD TRADING (20 Aralik 2025)

### Mimari Degisiklik: Hyperliquid-Style Trading

**Problem:** Eski tasarimda kullanici:
1. Faucet'ten sUSD al
2. Vault'a deposit yap (GEREKSIZ ADIM!)
3. Trade ac

**Yeni Tasarim:** Hyperliquid gibi direkt trading:
1. Faucet'ten sUSD al
2. Trade ac ← sUSD direkt kullaniliyor!

### Contract Degisiklikleri (ShadowVault.sol)

**Guncellenen Fonksiyonlar:**
```solidity
// openPosition - sUSD direkt ceker
bool transferSuccess = shadowUsd.vaultDeposit(msg.sender, collateral);
require(transferSuccess, "Insufficient sUSD balance");

// closePosition - sUSD direkt geri gonderir
shadowUsd.vaultWithdraw(msg.sender, finalAmount);

// openAnonymousPosition - ayni sekilde sUSD kullanir
// closeAnonymousPosition - ayni sekilde sUSD doner
// finalizePositionClose - async close icin sUSD kullanir
```

### Frontend Degisiklikleri (TradingPanel.tsx)

**Degisen Alanlar:**
- `vaultBalance` → `sUsdBalance`
- `handleDecryptVaultBalance` → `handleDecryptSUsdBalance`
- ShadowVault ABI → ShadowUSD ABI (`confidentialBalanceOf`)
- "No balance" uyarisi: "Click to deposit" → "Click to get from faucet"
- localStorage key: `vault_balance_` → `susd_balance_`

### Vault/LP Amaci

**Vault/LP artik sadece YIELD FARMING icin:**
- Kullanicilar LP stake edip trader kayiplarından kazanabilir
- Trade collateral ile iliskisi YOK
- GMX-style revenue sharing

---

## SESSION 7 - FHE SDK FIX + CLEAN UI (20 Aralik 2025)

### 1. FHE SDK WASM Sorunu COZULDU

**Problem:** Build sirasinda WASM parse hatasi:
```
Module parse failed: Internal failure: parseVec could not cast the value
./node_modules/@zama-fhe/relayer-sdk/lib/tfhe_bg.wasm
```

**Cozum (next.config.js):**
```javascript
// Zama WASM'i asset olarak yukle (parse etme!)
config.module.rules.push({
  test: /\.wasm$/,
  include: /node_modules\/@zama-fhe/,
  type: "asset/resource",
  generator: {
    filename: "static/wasm/[name][ext]",
  },
});
```

### 2. initSDK() Gerekli!

**Problem:** `createInstance()` cagrilinca WASM uzerinden `__wbindgen_malloc` hatasi

**Cozum (lib/fhe/client.ts):**
```typescript
const sdk = await import("@zama-fhe/relayer-sdk/web");
const { createInstance, SepoliaConfig, initSDK } = sdk;

// KRITIK: Once initSDK() cagir!
await initSDK();

// Sonra createInstance()
const instance = await createInstance(SepoliaConfig);
```

### 3. EIP-712 Signing (Viem Format)

**YANLIS (ethers.js style):**
```typescript
await signer.signTypedData(domain, types, message);
```

**DOGRU (viem style):**
```typescript
await signer.signTypedData({
  domain: eip712.domain,
  types: eip712.types,
  primaryType: eip712.primaryType,  // BU LAZIM!
  message: eip712.message,
});
```

### 4. Clean UI Refactor

**Kaldirilanlar:**
- "FHE Ready" status badge
- "Decrypt Balance" butonu
- Hide/Show toggle
- "Balance Decrypted Successfully" mesaji
- Decrypt tab (tum sayfa)
- "FHE Protected" badge
- Lock ikonlari
- Tum "encryption" mesajlari

**Eklenenler:**
- Otomatik decrypt (sayfa acilinca, arka planda)
- Sadece hata durumunda kucuk error mesaji
- Balance direkt gosteriliyor

**Felsefe:** FHE arka planda calisiyor, kullanici fark etmiyor. Clean, profesyonel UI.

---

## TEKNIK NOTLAR (GUNCELLENMIS)

### FHE SDK Initialization (DOGRU SIRA)
```typescript
// 1. Dynamic import (SSR/WASM icin)
const sdk = await import("@zama-fhe/relayer-sdk/web");
const { createInstance, SepoliaConfig, initSDK } = sdk;

// 2. ONCE initSDK() - WASM modullerini yukle
await initSDK();

// 3. SONRA createInstance()
const instance = await createInstance(SepoliaConfig);
```

### FHE Decryption Flow (GUNCELLENMIS)
```typescript
const handle = await contract.confidentialBalanceOf(address);
const keypair = instance.generateKeypair();
const eip712 = instance.createEIP712(keypair.publicKey, [contractAddr], startTime, "1");

// VIEM FORMAT - primaryType SART!
const signature = await signer.signTypedData({
  domain: eip712.domain,
  types: eip712.types,
  primaryType: eip712.primaryType,
  message: eip712.message,
});

const results = await instance.userDecrypt([{handle, contractAddress}], ...);
```

### Webpack Config (WASM icin)
```javascript
// next.config.js
config.module.rules.push({
  test: /\.wasm$/,
  include: /node_modules\/@zama-fhe/,
  type: "asset/resource",  // webassembly/async DEGIL!
  generator: {
    filename: "static/wasm/[name][ext]",
  },
});
```

### Sepolia FHE Config (DOGRU DEGERLER)
```typescript
const SEPOLIA_CONFIG = {
  aclContractAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
  kmsContractAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
  inputVerifierContractAddress: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
  verifyingContractAddressDecryption: "0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478",
  verifyingContractAddressInputVerification: "0x483b9dE06E4E4C7D35CCf5837A1668487406D955",
  chainId: 11155111,
  gatewayChainId: 10901,  // DOGRU: Zama docs & FHEIGHT ile uyumlu
  network: "https://eth-sepolia.public.blastapi.io",
  relayerUrl: "https://relayer.testnet.zama.org",  // .org DOGRU, .cloud YOK!
};
```

---

## CONTRACT ADDRESSES (Sepolia) - Session 8 Deployment
```
ShadowOracle:            0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE
ShadowUSD:               0x6C365a341C2A7D94cb0204A3f22CC810A7357F18
ShadowLiquidityPool:     0xF15e759229dc61f7ece238503368B1a0BafF0773
ShadowVault:             0x7a4D60498083Bc2dCC0490d0B95fc9D07940B0FD
Deployer:                0xad850C8eB45E80b99ad76A22fBDd0b04F4A1FD27
```

### Eski Adresler (Session 7 ve oncesi)
```
ShadowOracle:            0x9A5Fec3b1999cCBfC3a33EF5cdf09fdecad52301
ShadowUSD:               0xa1FFdD728C13Eb72F928491d3E6D9245AE614cf6
ShadowLiquidityPool:     0xB0a1fb939C017f17d79F6049A21b4b2fB9423d73
ShadowVault:             0x486eF23A22Ab485851bE386da07767b070a51e82
ShadowMarketMaker:       0xa779cB24c82307a19d4E4E01B3B0879fF635D02F
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

## QUICK COMMANDS (Windows)

```powershell
# Proje dizini
cd C:\Users\USER\shadow-protocol\frontend

# Frontend dev
npm run dev

# Frontend build
npm run build

# Git push
git add -A; git commit -m "message"; git push origin main
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

1. **Invisible FHE** - Arka planda calisiyor, user fark etmiyor
2. **Anonymous Trading (eaddress)** - Position owner encrypted
3. **Encrypted Limit Orders** - Front-running IMKANSIZ
4. **GMX-Style LP Pool** - Trader losses = LP gains
5. **Leverage Trading (1x-10x)** - Encrypted P&L
6. **Auto-decrypt** - Sayfa acilinca balance otomatik decrypt
7. **Professional Chart** - TradingView-style drawing tools
8. **Live Order Book** - Real-time updates + trade ticker

---

## SONUC

Pendex hackathon icin hazir:
- GERCEK FHE calisiyor (mock degil!)
- Clean UI (FHE gorunmuyor)
- Auto-decrypt
- Encrypted trading

**Puan: 9/10** - FHE production-ready!

### Siradaki Adimlar:
1. End-to-end test (trade ac → kapat)
2. Demo video cek (2-3 dk)
3. README guncelle

**Live URL:** https://shadow-protocol-nine.vercel.app/

---

## ONEMLI HATALAR VE COZUMLERI

### 1. WASM Parse Error
```
Module parse failed: Internal failure: parseVec could not cast the value
```
**Cozum:** `type: "asset/resource"` kullan

### 2. __wbindgen_malloc undefined
**Cozum:** `initSDK()` cagir ONCE

### 3. Invalid primary type undefined
**Cozum:** Viem object format + `primaryType` ekle

### 4. DNS resolution failed (relayer.testnet.zama.cloud)
**Cozum:** `.cloud` YANLIS, `.org` kullan

### 5. wrong relayer url
**Cozum:** `gatewayChainId: 10901` (Zama docs & FHEIGHT ile uyumlu)

---

## YENI SESSION ICIN PROMPT

```
Pendex projesine devam ediyorum. Bu bir Zama FHE Hackathon projesi - Pre-IPO sirketlerde FHE encrypted kaldiracli trading platformu.

Proje dizini: C:\Users\USER\shadow-protocol\frontend
Live URL: https://shadow-protocol-nine.vercel.app/

Lutfen once CLAUDE.md dosyasini oku.
```
