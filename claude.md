# Shadow Protocol - Claude Memory File
**Son Güncelleme:** 2025-12-10

## Project Overview
**Shadow Protocol** - FHE Pre-IPO Leverage Trading Platform for Zama Builder Track Hackathon

**Temel Konsept:**
- Kullanici pozisyonlari FHE ile sifreleniyor
- Kimse (validator bile) pozisyonlari goremiyor
- Pre-IPO sirketlerde kaldiracli islem (2x-100x)

**GitHub:** https://github.com/Himess/shadow-protocol
**Vercel:** Yeniden baglanmasi gerekiyor (repo silindi/yeniden olusturuldu)

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

## PROJE DURUMU (10 Aralik 2025)

### PUAN: 8.5/10 🎉

### TAMAMLANAN OZELLIKLER

#### Smart Contracts (3500+ lines)
- [x] **ShadowVault.sol** (1800+ lines) - Ana trading vault
  - Encrypted positions (collateral, size, entry, leverage, direction)
  - Anonymous positions (eaddress encryptedOwner) - UNIQUE!
  - Encrypted limit orders (anti-frontrunning)
  - Public decryption pattern (prepareClose → finalizeClose)
  - FHE.checkSignatures() verification
  - Revenue distribution (5% liquidator, 47.5% LP, 47.5% protocol)
- [x] **ShadowUSD.sol** (527 lines) - ERC-7984 style confidential stablecoin
  - Encrypted balances
  - Confidential transfers
  - Operator pattern (session-based trading)
- [x] **ShadowOracle.sol** (448 lines) - Demand-based pricing
  - 17 Pre-IPO assets (SpaceX, OpenAI, Stripe, etc.)
  - Price = BasePrice + (LongOI - ShortOI) modifier
- [x] **ShadowLiquidityPool.sol** (618 lines) - GMX-style LP
  - Encrypted LP balances
  - Epoch-based rewards
  - Random bonus multiplier (FHE.randEuint8)
- [x] **ShadowMarketMaker.sol** - Trading bot

#### Frontend (Next.js 14)
- [x] Professional trading UI (Lighter-style)
- [x] Trade page with chart, order book, positions
- [x] Wallet page with multiple tabs:
  - Decrypt Balance (User Decryption UI)
  - Operators (ERC-7984 management)
  - Transfer, Liquidity Pool, History
- [x] Markets page (17 assets)
- [x] Admin dashboard
- [x] Dark/Light theme toggle
- [x] Mobile responsive

#### Documentation
- [x] Professional README with badges
- [x] Architecture diagrams (ASCII art)
- [x] Data flow diagrams
- [x] Privacy guarantees section
- [x] **docs/FHEVM_INTEGRATION.md** (500+ lines)
  - All FHE types and locations
  - Operations reference table
  - Decryption patterns
  - ACL guide
  - Troubleshooting

#### Tests
- [x] 53 passing tests
- [x] Oracle, ShadowUSD, Vault, Revenue, Liquidation tests

---

### UNIQUE FEATURES (Rakiplerden Farkimiz)

1. **Anonymous Trading (eaddress)**
   - Position owner encrypted
   - Kimse kimin islemi oldugunu bilemiyor
   - Zolymarket'te YOK

2. **Encrypted Limit Orders**
   - Trigger price encrypted
   - Front-running IMKANSIZ
   - MEV protection built-in

3. **GMX-Style LP Pool**
   - Trader losses = LP gains
   - Encrypted LP balances
   - Random bonus rewards

4. **Leverage Trading (2x-100x)**
   - Encrypted P&L calculation
   - Auto-liquidation at 100% loss

5. **FHE Random**
   - FHE.randEuint64() for market maker
   - FHE.randEuint8() for bonus multiplier

---

### ZOLYMARKET KARSILASTIRMASI

| Ozellik | Shadow | Zolymarket |
|---------|--------|------------|
| Contract Complexity | 3500+ lines | ~1200 lines |
| Anonymous Trading | ✅ eaddress | ❌ |
| Encrypted Limit Orders | ✅ | ❌ |
| Leverage | ✅ 2x-100x | ❌ |
| LP Pool | ✅ GMX-style | ❌ |
| FHE Random | ✅ | ❌ |
| checkSignatures() | ✅ | ✅ |
| User Decryption UI | ✅ | ✅ |
| FHEVM Doc | ✅ 500+ lines | ✅ 1200+ lines |
| Backend | ❌ | ✅ Node.js |

**Shadow teknik olarak daha guclu, Zolymarket daha "demo-ready" idi**

---

## KALAN ISLER

### Yapilacak
- [ ] Vercel'i yeniden bagla
- [ ] Demo video cek (2-3 dk)

### Potansiyel Iyilestirmeler (Nice to Have)
- [ ] Backend API (off-chain position tracking)
- [ ] Transaction history page
- [ ] Advanced chart indicators
- [ ] Gas optimization metrics

---

## BILINEN SORUNLAR / KONTROL EDILECEKLER

### Frontend
1. **Trade page asset selector** - Kod incelendi, calisiyor olmasi lazim
2. **Fiyat tutarsizliklari** - seededRandom ile stable values kullaniliyor

### Contract
1. **ACL izinleri** - deposit/withdraw'da veriliyor mu kontrol et
2. **View fonksiyonlarda FHE.allow()** - calismaz, state-changing olmalı

---

## QUICK COMMANDS

```bash
# Local development
npx hardhat node
npx hardhat test

# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Frontend
cd frontend && npm run dev

# Trading Bot
MARKET_MAKER_ADDRESS=0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb \
ORACLE_ADDRESS=0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17 \
npx hardhat run scripts/runBotSimple.ts --network sepolia
```

---

## FHE KULLANIM OZETI

### Encrypted Types
- `euint64` - Balances, positions, prices
- `euint8` - Error codes, bonus multiplier
- `ebool` - Direction (long/short)
- `eaddress` - Anonymous trading (UNIQUE!)

### FHE Operations
- Arithmetic: `add`, `sub`, `mul`, `div`
- Comparison: `gt`, `lt`, `ge`, `le`, `eq`
- Conditional: `select` (if/else yerine)
- Random: `randEbool`, `randEuint8`, `randEuint64`
- Min/Max: `min`, `max`

### ACL Pattern
```solidity
FHE.allowThis(value);           // Contract access
FHE.allow(value, msg.sender);   // User access
FHE.allowTransient(value, addr); // Temp access (gas opt)
```

### Public Decryption Pattern
```solidity
// Step 1: Mark for decryption
FHE.makePubliclyDecryptable(value);

// Step 2: Off-chain decrypt via SDK

// Step 3: Verify on-chain
FHE.checkSignatures(cts, clearValues, proof);
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
│   └── src/
│       ├── app/
│       │   ├── trade/            - Trading UI
│       │   ├── wallet/           - Wallet + Decrypt + Operators
│       │   ├── markets/          - Asset listing
│       │   └── admin/            - Dashboard
│       └── lib/
│           └── fhe/client.ts     - Relayer SDK
├── docs/
│   └── FHEVM_INTEGRATION.md      (500+ lines)
├── test/
│   └── ShadowProtocol.test.ts    (53 tests)
└── README.md                     (Professional + Diagrams)
```

---

## SONUC

Shadow Protocol hackathon icin hazir. Teknik olarak Zolymarket'ten daha guclu:
- Daha fazla FHE feature kullanimi
- Unique ozellikler (anonymous trading, leverage, LP pool)
- Profesyonel dokumantasyon

Eksik: Demo video (kullanici cekecek)
