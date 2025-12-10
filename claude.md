# Shadow Protocol - Claude Memory File

## Project Overview
**Shadow Protocol** - FHE Pre-IPO Leverage Trading Platform for Zama Builder Track Hackathon

**Temel Konsept:**
- Kullanici pozisyonlari FHE ile sifreleniyor
- Kimse (validator bile) pozisyonlari goremiyor
- Pre-IPO sirketlerde kaldiracli islem

---

## CRITICAL: Network Configuration

### ZAMA AYRI BIR CHAIN DEGIL!
- Zama, **Ethereum Sepolia** uzerinde FHE (Fully Homomorphic Encryption) saglıyor
- "Zama Devnet" veya "Zama L1/L2" diye bir sey YOK
- Sadece IKI network kullaniliyor:
  1. **Local Hardhat** - Mock FHE (gelistirme/test icin)
  2. **Ethereum Sepolia** - Gercek FHE encryption

### Runtime Modlari
1. **Hardhat Mock Mode** (`npx hardhat test`)
   - Hizli, in-memory
   - Mock FHE operasyonlari
   - Calistirmalar arasi kalici degil

2. **Hardhat Node Mock Mode** (`npx hardhat node`)
   - Kalici state
   - Mock FHE operasyonlari
   - Frontend gelistirme icin ideal

3. **Sepolia Testnet** (Gercek FHE)
   - Gercek FHE encryption/decryption
   - Zama Relayer gerektirir
   - Production benzeri ortam

---

## Contract Addresses (Sepolia)
```
ShadowOracle:            0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17
ShadowMarketMakerSimple: 0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb
ShadowVault:             0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5
ShadowUSD:               0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb
```

## Deployer Wallet
- Address: `0xad850C8eB45E80b99ad76A22fBDd0b04F4A1FD27`
- Contract deploy ve test icin kullaniliyor

---

## TODO List (Guncel)

### AKTIF CALISMA
1. [ ] UI BUG: Trade sayfasi asset selector - diger projeleri secemiyor
2. [ ] UI BUG: Ust menude fiyat farkliliklari oluyor
3. [ ] Test coverage artir

### TAMAMLANAN Isler
- [x] Smart Contracts tasarimi (ShadowVault, ShadowUSD, ShadowOracle, ShadowMarketMakerSimple)
- [x] Frontend temel yapisi (Next.js 14, wagmi, viem)
- [x] Trade sayfasi UI
- [x] Wallet sayfasi (Deposit, Withdraw, Faucet, LP Staking, Transfer)
- [x] Markets sayfasi
- [x] Docs sayfasi
- [x] LP Staking UI
- [x] Confidential Transfer UI
- [x] Profesyonel trading layout
- [x] Chart tam genislik + volume bar
- [x] Ust bar: Mark Price, Index Price, 24h Volume, Open Interest, Funding Rate
- [x] Trading panel: Market/Limit tabs, TP/SL
- [x] Positions panel (alt kisim)
- [x] Sol ustten asset secimi (dropdown)
- [x] Chart SSR sorunu icin mounted state eklendi
- [x] Sepolia testnet deploy config
- [x] Trading Bot (simule trade)
- [x] Admin Dashboard (temel)
- [x] Take Profit / Stop Loss UI
- [x] **Async Decryption Callback (Gateway Pattern)** - requestDecryption + callback
- [x] **FHE.checkSignatures()** - KMS signature verification
- [x] **User Decryption UI** - Wallet sayfasinda "Decrypt Balance" tab
- [x] **Operator UX (ERC-7984)** - Wallet sayfasinda "Operators" tab
- [x] **Profesyonel README** - Tum ozellikler dokumente edildi
- [x] Sifreli Order Book sistemi

### Nice to Have (Sonra)
- [ ] Transaction history sayfasi
- [ ] Keyboard shortcuts
- [ ] Advanced Chart (TradingView tarzi indicators)
- [ ] Trade Card / Share Card
- [ ] Partial Close
- [ ] RPC/contract config'i .env'ye tasi

---

## FHEVM Technical Reference (UPDATED from Zama Docs)

### Encrypted Types
```solidity
// Encrypted tipler
ebool      // encrypted boolean
euint8     // encrypted uint8
euint16    // encrypted uint16
euint32    // encrypted uint32
euint64    // encrypted uint64  <-- EN COK KULLANILAN (balance, amount)
euint128   // encrypted uint128 <-- Buyuk degerler, toplam supply
euint256   // encrypted uint256
eaddress   // encrypted address <-- Gizli recipient icin

// External input tipleri (kullanici inputlari icin)
externalEbool
externalEuint8
externalEuint16
externalEuint32
externalEuint64     <-- EN COK KULLANILAN
externalEuint128
externalEuint256
externalEaddress
```

### Encrypted Inputs Pattern (KRITIK!)
```solidity
// Contract function signature
function deposit(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
    // External inputu internal encrypted tipe cevir
    euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

    // KRITIK: Izinleri ver (user decryption icin IKISI DE gerekli!)
    FHE.allowThis(amount);  // Contract erisebilsin
    FHE.allow(amount, msg.sender);  // Kullanici erisebilsin

    // Encrypted degeri kullan
    _balances[msg.sender] = FHE.add(_balances[msg.sender], amount);
}
```

### Client-Side Encryption (JavaScript/TypeScript)
```typescript
// Encrypted input olustur
const encryptedInput = await fhevm
    .createEncryptedInput(contractAddress, userAddress)
    .add64(amount)  // add8, add16, add32, add64, addBool, addAddress
    .encrypt();

// Transaction'da kullan
await contract.deposit(
    encryptedInput.handles[0],  // Encrypted handle
    encryptedInput.inputProof   // ZK proof
);

// ONEMLI: Birden fazla deger encrypt edilebilir
const multiInput = await fhevm
    .createEncryptedInput(contractAddress, userAddress)
    .addBool(true)
    .add32(123456)
    .addAddress(someAddress)
    .encrypt();

// handles[0] = ebool, handles[1] = euint32, handles[2] = eaddress
// inputProof TEK - hepsi icin ayni proof kullanilir
```

### ACL (Access Control List) System - DETAYLI
```solidity
// Kalici izinler (state'e yazilir, tx sonrasi da gecerli)
FHE.allow(ciphertext, address);      // Belirli adrese izin
FHE.allowThis(ciphertext);           // Contract'a izin (this)

// Gecici izin (sadece bu tx icinde gecerli, state yazilmaz)
FHE.allowTransient(ciphertext, addr); // Swap/transfer gibi islemlerde kullanilir

// KRITIK HATA ONLEME:
// User decryption icin MUTLAKA her ikisi de gerekli:
// 1. FHE.allowThis(value) - Contract'a izin
// 2. FHE.allow(value, msg.sender) - User'a izin
// Sadece user'a izin verirsen decryption BASARISIZ olur!
```

### FHE Operations
```solidity
// Aritmetik
FHE.add(a, b)    // Toplama
FHE.sub(a, b)    // Cikarma
FHE.mul(a, b)    // Carpma
FHE.div(a, b)    // Bolme
FHE.rem(a, b)    // Mod

// Karsilastirma (ebool dondurur)
FHE.eq(a, b)     // Esit
FHE.ne(a, b)     // Esit degil
FHE.lt(a, b)     // Kucuk
FHE.le(a, b)     // Kucuk esit
FHE.gt(a, b)     // Buyuk
FHE.ge(a, b)     // Buyuk esit

// Bitwise
FHE.and(a, b), FHE.or(a, b), FHE.xor(a, b), FHE.not(a)
FHE.shl(a, b), FHE.shr(a, b)

// KRITIK: Conditional (if/else yerine BUNU kullan!)
FHE.select(condition, ifTrue, ifFalse)  // Ternary operator gibi

// Min/Max
FHE.min(a, b), FHE.max(a, b)

// Type conversion
FHE.asEuint8(value), FHE.asEuint16(value), FHE.asEuint32(value)
FHE.asEuint64(value), FHE.asEuint128(value), FHE.asEbool(value)

// Random generation (Encrypted random!)
FHE.randEbool()   // Encrypted random boolean
FHE.randEuint8()  // Encrypted random 0-255
FHE.randEuint16() // Encrypted random 0-65535
FHE.randEuint32() // Encrypted random 0-2^32
FHE.randEuint64() // Encrypted random 0-2^64
```

### KRITIK: Encrypted Degerler Uzerinde Branching YASAK!
```solidity
// YANLIS - Encrypted degerler uzerinde if kullanilamaz
if (FHE.gt(a, b)) {  // HATA: ebool if'te kullanilamaz
    // ...
}

// DOGRU - FHE.select kullan
euint64 result = FHE.select(FHE.gt(a, b), valueIfTrue, valueIfFalse);
```

---

## Decryption Methods (DETAYLI)

### 1. User Decryption (Off-chain, Private) - SHADOW PROTOCOL ICIN IDEAL
- Kullanici kendi verisini decrypt eder
- Sonuc SADECE o kullaniciya gorunur
- Izinler on-chain, decryption off-chain (frontend'de)

```solidity
// Contract: Izin ver
function getBalance() external view returns (euint64) {
    // IKISI DE GEREKLI!
    FHE.allowThis(_balances[msg.sender]);
    FHE.allow(_balances[msg.sender], msg.sender);
    return _balances[msg.sender];
}
```

```typescript
// Frontend: User Decryption
import { FhevmType } from "@fhevm/hardhat-plugin";

// Basit yol
const clearBalance = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    encryptedBalance,  // Contract'tan alinan handle
    contractAddress,
    userSigner
);

// Coklu decryption (ayni anda birden fazla deger)
const keypair = fhevm.generateKeypair();
const eip712 = fhevm.createEIP712(keypair.publicKey, [contractAddress], timestamp, 365);
const signature = await signer.signTypedData(eip712.domain, eip712.types, eip712.message);

const results = await fhevm.userDecrypt(
    [
        { handle: encBalance, contractAddress },
        { handle: encPosition, contractAddress },
    ],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    [contractAddress],
    userAddress,
    timestamp,
    365
);
// results[encBalance] = 1000n
// results[encPosition] = 50n
```

### 2. Public Decryption (On-chain Verification) - OYUN SONUCLARI ICIN
Herkese acik degerler icin (ornegin zar atma, oyun sonuclari):

**Adim 1: On-chain - Publicly decryptable olarak isaretle**
```solidity
ebool gameResult = FHE.randEbool();
FHE.makePubliclyDecryptable(gameResult);
emit GameCreated(gameId, gameResult); // Event'te handle paylas
```

**Adim 2: Off-chain - Relayer uzerinden decryption iste**
```typescript
const result = await fhevm.publicDecrypt([encryptedHandle]);
// result.clearValues[handle] = true/false
// result.abiEncodedClearValues = abi encoded deger
// result.decryptionProof = KMS imzasi
```

**Adim 3: On-chain - Dogrula ve kullan**
```solidity
function finalizeGame(bytes memory abiEncodedResult, bytes memory proof) external {
    bytes32[] memory cts = new bytes32[](1);
    cts[0] = FHE.toBytes32(games[gameId].encryptedResult);

    // KMS imzasini dogrula - basarisiz olursa revert
    FHE.checkSignatures(cts, abiEncodedResult, proof);

    // Artik guvenle decode edebiliriz
    bool result = abi.decode(abiEncodedResult, (bool));
    // ...
}
```

---

## ERC-7984: Confidential Tokens (OpenZeppelin)

### Nedir?
- ERC20'nin encrypted versiyonu
- Balance'lar sifreli tutulur
- Transfer miktarlari sifreli

### Import ve Kullanim
```solidity
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract MyToken is ZamaEthereumConfig, ERC7984 {
    constructor() ERC7984("MyToken", "MTK", "https://...") {
        euint64 initialSupply = FHE.asEuint64(1000000);
        _mint(msg.sender, initialSupply);
    }
}
```

### Temel Fonksiyonlar
```solidity
// Balance sorgula (encrypted handle dondurur)
function confidentialBalanceOf(address account) returns (euint64);

// Transfer (encrypted miktar ile)
function confidentialTransfer(
    address to,
    externalEuint64 amount,
    bytes calldata inputProof
) returns (euint64 transferred);

// TransferFrom (operator icin)
function confidentialTransferFrom(
    address from,
    address to,
    euint64 amount  // allowTransient ile izin verilmis olmali
) returns (euint64 transferred);
```

### Operator Sistemi (ERC-7984 Session-Based Trading)
```solidity
// Kullanici bir kere onay verir
function setOperator(address operator, uint48 expiry) external;

// Sonraki islemlerde wallet popup GEREKMEZ
// Operator (mesela ShadowVault) confidentialTransferFrom cagirabilir
```

**Frontend Flow:**
```typescript
// 1. Kullanici operator'u onaylar (TEK SEFERLIK)
await token.setOperator(shadowVaultAddress, expiryTimestamp);

// 2. Artik her trade icin popup yok
// ShadowVault internal olarak confidentialTransferFrom cagiriyor
```

---

## ERC-7984 Wrapper ve Swap Patterns

### ERC20 <-> ERC7984 Wrapper
```solidity
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/...";

// Normal ERC20'yi encrypted ERC7984'e wrap et
contract WrappedToken is ERC7984ERC20Wrapper, ZamaEthereumConfig {
    constructor(IERC20 underlying)
        ERC7984ERC20Wrapper(underlying)
        ERC7984("Wrapped", "wTKN", "...") {}
}
```

### Confidential Swap (ERC7984 -> ERC20)
```solidity
// Async pattern: Encrypted -> Decrypt -> Clear ERC20
function swap(externalEuint64 amount, bytes memory proof) external {
    euint64 enc = FHE.fromExternal(amount, proof);
    FHE.allowTransient(enc, address(fromToken));
    euint64 transferred = fromToken.confidentialTransferFrom(msg.sender, address(this), enc);

    // Decryption request (async callback)
    bytes32[] memory cts = new bytes32[](1);
    cts[0] = euint64.unwrap(transferred);
    uint256 requestId = FHE.requestDecryption(cts, this.finalizeSwap.selector);
    _receivers[requestId] = msg.sender;
}

function finalizeSwap(uint256 requestId, uint64 amount, bytes[] memory sigs) external {
    FHE.checkSignatures(requestId, sigs);
    SafeERC20.safeTransfer(toToken, _receivers[requestId], amount);
}
```

### Confidential Swap (ERC7984 -> ERC7984)
```solidity
// Sync pattern: Her iki taraf da encrypted
function swapConfidential(
    IERC7984 fromToken, IERC7984 toToken,
    externalEuint64 amount, bytes calldata proof
) external {
    require(fromToken.isOperator(msg.sender, address(this)));

    euint64 enc = FHE.fromExternal(amount, proof);
    FHE.allowTransient(enc, address(fromToken));
    euint64 transferred = fromToken.confidentialTransferFrom(msg.sender, address(this), enc);

    FHE.allowTransient(transferred, address(toToken));
    toToken.confidentialTransfer(msg.sender, transferred);
}
```

---

## Vesting Wallet Pattern (Confidential)

```solidity
contract VestingWallet is ZamaEthereumConfig {
    mapping(address => euint128) private _released;
    uint64 private _start;
    uint64 private _duration;

    function releasable(address token) public returns (euint64) {
        euint128 vested = vestedAmount(token, block.timestamp);
        euint128 released = _released[token];
        ebool canRelease = FHE.ge(vested, released);
        return FHE.select(canRelease,
            FHE.asEuint64(FHE.sub(vested, released)),
            FHE.asEuint64(0)
        );
    }

    function _vestingSchedule(euint128 total, uint48 timestamp) internal returns (euint128) {
        if (timestamp < _start) return euint128.wrap(0);
        if (timestamp >= end()) return total;
        return FHE.div(FHE.mul(total, timestamp - _start), _duration);
    }
}
```

---

## Contract Configuration
```solidity
// FHE ve config import et
import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

// Config'den inherit et (network-specific ayarlar icin)
contract MyContract is ZamaEthereumConfig {
    // Contract kodu
}
```

---

## Price Formula (Bot icin)
```
modifierPercent = (oiDiff * 1) / 10000
```
- 1% hareket icin: oiDiff = 100,000,000 units = $100
- Max modifier: +-20%

### Trade Size'lar (Bot)
- PUMP: $50-$300
- DUMP: $50-$300
- SIDEWAYS: $20-$150
- VOLATILE: $100-$500
- ACCUMULATION: $200-$800
- DISTRIBUTION: $200-$800

---

## Encrypted Order Book Konsepti
```
ASKS (Satis)
$158.50  [======]  Encrypted
$158.25  [====]    Encrypted
$158.00  [==]      Encrypted
------- $157.50 Mark Price -------
$157.00  [===]     Encrypted
$156.75  [=====]   Encrypted
$156.50  [========] Encrypted
BIDS (Alis)
```
- Fiyat seviyeleri gorunur (market depth icin)
- Miktar bar olarak gorunur (toplam likidite)
- Kim koydugu, tam miktari -> Encrypted
- Bu sayede FHE anlamli kaliyor

---

## HCU (Homomorphic Complexity Units) Costs
Gas gibi, ama FHE operasyonlari icin:
- Basic ops (add, sub): Dusuk HCU
- Multiplication: Orta HCU
- Division: Yuksek HCU
- Comparisons: Orta HCU
- Random generation: Yuksek HCU

---

## Quick Reference Commands
```bash
# Local development (mock FHE)
npx hardhat node
npx hardhat test

# Deploy to Sepolia (gercek FHE)
npx hardhat run scripts/deploy.ts --network sepolia

# Frontend calistir
cd frontend && npm run dev

# Trading Bot calistir (Sepolia)
MARKET_MAKER_ADDRESS=0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb \
ORACLE_ADDRESS=0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17 \
npx hardhat run scripts/runBotSimple.ts --network sepolia
```

---

## Relayer SDK Entegrasyonu (Frontend)

### Web App Setup
```typescript
// CDN veya NPM
import { initFhevm, createInstance } from "@fhevm/sdk";

// Initialization
await initFhevm();
const instance = await createInstance({
    chainId: 11155111, // Sepolia
    network: "sepolia",
    // ... config
});
```

### Encrypted Input Olusturma
```typescript
const input = instance.createEncryptedInput(contractAddress, userAddress);
input.add64(amount);
const encrypted = await input.encrypt();

// Contract'a gonder
await contract.deposit(encrypted.handles[0], encrypted.inputProof);
```

### User Decryption (Frontend)
```typescript
// Keypair olustur
const keypair = instance.generateKeypair();

// EIP-712 sign
const eip712 = instance.createEIP712(keypair.publicKey, [contractAddress]);
const signature = await signer.signTypedData(...);

// Decrypt iste
const result = await instance.userDecrypt(
    [{ handle, contractAddress }],
    keypair,
    signature
);
```

---

## Onemli Hatirlatmalar
1. Zama ayri chain DEGIL - Sepolia uzerinde FHE
2. Encrypted degerler icin MUTLAKA `FHE.allowThis()` ve `FHE.allow()` cagir
3. Kullanici inputlari `externalEuintXX` + `FHE.fromExternal()` ile
4. Branching icin `if` degil `FHE.select()` kullan
5. Her encrypted degisken icin ACL izni ver
6. User decryption icin HEM contract HEM user'a izin gerekli
7. Operator pattern ile session-based trading (popup'siz)
8. Public decryption 3 adimli: makePubliclyDecryptable -> publicDecrypt -> checkSignatures
9. ERC-7984 = ERC20'nin encrypted versiyonu (OpenZeppelin)
10. allowTransient = gecici izin (swap/transfer icin ideal)

---

## ========================================
## SHADOW PROTOCOL IMPLEMENTATION ANALYSIS
## ========================================

### Proje Yapisi (Architecture Overview)

```
contracts/
├── core/
│   ├── ShadowVault.sol       (1580 lines) - Main trading vault
│   ├── ShadowOracle.sol      (448 lines)  - Price oracle
│   ├── ShadowLiquidityPool.sol (618 lines) - GMX-style LP pool
│   └── ShadowOrderBook.sol   (For encrypted order book)
├── tokens/
│   └── ShadowUSD.sol         (527 lines)  - Confidential stablecoin
├── bots/
│   ├── ShadowMarketMaker.sol (FHE version)
│   └── ShadowMarketMakerSimple.sol (421 lines) - Sepolia version

frontend/
├── app/
│   ├── trade/page.tsx        - Professional trading UI
│   ├── wallet/page.tsx       - Wallet, deposit, LP staking
│   ├── markets/page.tsx      - Asset listing
│   ├── admin/page.tsx        - Admin dashboard
│   └── history/page.tsx      - Trade history
├── lib/
│   ├── fhe/client.ts         - Relayer SDK integration
│   ├── constants.ts          - Asset definitions
│   └── companyData.ts        - Pre-IPO companies
└── components/               - Reusable UI components
```

---

### Contract Analysis - Ne Yapiyoruz?

#### 1. ShadowVault.sol (CORE - 1580 lines)
**Ana trading vault - Projenin kalbi**

**Encrypted Storage:**
```solidity
mapping(address => euint64) private _balances;           // User balances
mapping(uint256 => Position) private _positions;         // Positions with encrypted fields
mapping(uint256 => AnonymousPosition) private _anonymousPositions;  // FULLY anonymous positions
mapping(uint256 => EncryptedLimitOrder) private _limitOrders;       // Encrypted limit orders
```

**Position Struct (Her alan encrypted!):**
```solidity
struct Position {
    uint256 id;
    address owner;              // Public (ama anonymous position'da encryptedOwner!)
    bytes32 assetId;            // Public (hangi asset)
    euint64 collateral;         // ENCRYPTED - Kimse goremiyor
    euint64 size;               // ENCRYPTED - Position buyuklugu
    euint64 entryPrice;         // ENCRYPTED - Giris fiyati
    ebool isLong;               // ENCRYPTED - Long mu short mu?
    euint64 leverage;           // ENCRYPTED - Kaldırac
    uint256 openTimestamp;      // Public
    bool isOpen;                // Public
}
```

**Kullanilan FHE Features:**
- `FHE.fromExternal()` - User input'lari encrypt
- `FHE.add()`, `FHE.sub()`, `FHE.mul()`, `FHE.div()` - Aritmetik
- `FHE.gt()`, `FHE.ge()`, `FHE.eq()` - Karsilastirma
- `FHE.select()` - Conditional logic (if/else yerine)
- `FHE.neg()` - Negatif P&L icin
- `FHE.allowThis()`, `FHE.allow()` - ACL permissions
- `FHE.makePubliclyDecryptable()` - Liquidation icin
- `FHE.asEaddress()` - ANONYMOUS trading!
- `FHE.randEuint64()` - On-chain random
- `FHE.allowTransient()` - Gas optimized transfers

**Ozellikler:**
1. Normal positions - Owner public, veriler encrypted
2. Anonymous positions - OWNER BILE ENCRYPTED! (eaddress)
3. Encrypted limit orders - Trigger price encrypted, front-run IMKANSIZ
4. Auto-liquidation at 100% loss
5. Revenue distribution: 5% liquidator, 47.5% LP, 47.5% protocol

---

#### 2. ShadowUSD.sol (527 lines)
**ERC-7984 benzeri confidential stablecoin**

**Implemented Features:**
- `confidentialBalanceOf()` - Encrypted balance query
- `confidentialTransfer()` - Encrypted transfer amount
- `confidentialApprove()` - Encrypted approval
- `confidentialTransferFrom()` - Operator transfer
- `setOperator()` - ERC-7984 operator pattern (SESSION-BASED TRADING!)
- `faucet()` - Testnet icin (max 10,000 sUSD)

**Advanced FHE Functions:**
- `compareBalances()` - Two users' balances comparison (encrypted result)
- `getMinBalance()` - FHE.min() with two balances
- `hasMinimumBalance()` - Encrypted threshold check
- `conditionalTransfer()` - Transfer only if encrypted condition true
- `splitTransfer()` - Split with encrypted ratio

---

#### 3. ShadowOracle.sol (448 lines)
**Price oracle with demand-based pricing**

**Price Formula:**
```
currentPrice = basePrice + (oiDiff * DEMAND_MODIFIER_PER_UNIT / 10000)
oiDiff = totalLongOI - totalShortOI
Max modifier: +-20%
```

**Categories:** AI, AEROSPACE, FINTECH, DATA, SOCIAL

**FHE Functions:**
- `getEncryptedPrice()` - Returns euint64
- `comparePrices()` - Encrypted comparison
- `getEncryptedPriceDiff()` - Absolute difference
- `getEncryptedAveragePrice()` - FHE.add + FHE.div
- `getEncryptedMinPrice()`, `getEncryptedMaxPrice()` - FHE.min/max
- `generateRandomSlippage()` - FHE.randEuint8
- `getPriceWithSlippage()` - Price with slippage applied

---

#### 4. ShadowLiquidityPool.sol (618 lines)
**GMX/GNS style liquidity pool**

**Mechanics:**
- LPs deposit sUSD, receive LP tokens
- LPs earn from: trading fees + trader losses
- LPs lose from: trader profits
- 24 hour lock-up period
- Epoch-based rewards (24 hours)

**FHE Usage:**
- `_lpBalances` - Encrypted LP token balances
- `_pendingRewards` - Encrypted pending rewards
- `generateRandomBonusMultiplier()` - FHE.randEuint8(16) = 0-15% bonus
- `calculateBonusRewards()` - Encrypted arithmetic
- `getEffectiveStake()` - FHE.min for caps
- `compareStakes()` - FHE.gt for ranking
- `calculatePoolShare()` - Encrypted pool share calculation
- `claimRewardsOptimized()` - allowTransient for gas savings

---

#### 5. ShadowMarketMakerSimple.sol (421 lines)
**Sepolia-compatible market maker bot**

**Scenarios:**
- PUMP (75% buy, bullish)
- DUMP (25% buy, bearish)
- SIDEWAYS (50% buy, stable)
- VOLATILE (50% buy, big swings)
- ACCUMULATION (70% buy, whale accumulation)
- DISTRIBUTION (30% buy, whale selling)

**Data Generation:**
- OHLCV candles (1-minute interval)
- Whale alerts (> $1M trades)
- Trade history per asset

---

### Frontend Analysis

#### FHE Client (lib/fhe/client.ts)
**Relayer SDK Integration - CALISIYORUZ!**

```typescript
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";

// Singleton pattern
let fhevmInstance: FhevmInstance | null = null;

// Functions:
- initFheInstance()           // Initialize with SepoliaConfig
- encryptUint64()             // Single value encryption
- encryptBool()               // Boolean encryption
- encryptPositionParams()     // Collateral + leverage + isLong (shared proof)
- encryptMultipleUint64()     // Multiple values, single proof
- requestUserDecryption()     // EIP-712 signed decryption request
- decryptValue()              // Single value decrypt
- encryptAddress()            // For anonymous trading
- encryptUint()               // Generic (8, 16, 32, 64 bits)
```

---

### Guclu Yonlerimiz (Strengths)

1. **Kapsamli FHE Kullanimi:**
   - Neredeyse TUM FHE operasyonlarini kullaniyoruz
   - FHE.randEuint*() ile on-chain randomness
   - FHE.neg() ile signed arithmetic
   - FHE.select() ile branch-free logic
   - allowTransient() ile gas optimization

2. **Anonymous Trading (VAY BEE!):**
   - `eaddress encryptedOwner` ile OWNER BILE ENCRYPTED
   - Hic kimse pozisyonun kime ait oldugunu bilemiyor
   - Bu cok unique bir feature!

3. **Encrypted Limit Orders:**
   - Trigger price encrypted
   - Front-running IMKANSIZ
   - MEV korunmasi built-in

4. **ERC-7984 Operator Pattern:**
   - Session-based trading
   - `setOperator()` bir kere cagirilir
   - Sonraki islemlerde popup YOK

5. **GMX-Style LP Pool:**
   - Trader losses = LP gains
   - Epoch-based rewards
   - Encrypted LP balances

6. **Professional Trading UI:**
   - TradingView-like chart
   - Order book
   - Market stats bar
   - Mobile responsive

7. **Relayer SDK Integration:**
   - `@zama-fhe/relayer-sdk/web` kullaniliyor
   - User decryption implemented
   - EIP-712 signature flow

---

### Zayif Yonlerimiz / Eksikler (Weaknesses)

1. **User Decryption UI YOK:**
   - Frontend'de user decryption butonu yok
   - Kullanici kendi bakiyesini goremez
   - `requestUserDecryption()` var ama UI'da bagli degil

2. **Operator UX YOK:**
   - `setOperator()` fonksiyonu var ama UI'da yok
   - Her islemde wallet popup gerekiyor
   - Session-based trading aktif degil

3. **ACL Izinleri Kontrol Edilmeli:**
   - `getBalance()` fonksiyonu view olarak tanimli
   - View fonksiyonlarda `FHE.allow()` calismaz!
   - Izinler `deposit/withdraw` sirasinda verilmeli

4. **OpenZeppelin ERC-7984 Kullanilmamis:**
   - ShadowUSD kendi implementasyonumuz
   - Official OZ standartini kullanabilirdik

5. **Public Decryption Flow Eksik:**
   - `makePubliclyDecryptable()` var
   - Ama `checkSignatures()` ile verification yok
   - Liquidation flow eksik

6. **Order Book Simulated:**
   - Gercek encrypted order book yok
   - `ShadowOrderBook.sol` var ama kullanilmiyor

7. **Test Coverage:**
   - Test dosyalari yok veya az
   - Integration testleri eksik

8. **Frontend-Contract Disconnect:**
   - Deposit/withdraw frontend'de mock gibi gorunuyor
   - Real on-chain interaction tam calismayabilir

---

### Hackathon Icin Oneriler

**Hemen Yapilabilecek:**
1. User Decryption UI ekle (balance gosterimi)
2. Operator UX ekle (tek seferlik onay butonu)
3. README profesyonellestirilmeli
4. Demo video/screenshots

**Nice to Have:**
1. Public decryption flow tamamla (liquidation)
2. Real on-chain order book
3. Test coverage artir
4. Gas optimization metrics

---

### Commit Message Rules
- NEVER use "Claude", "AI", "AI-generated" in commits
- NEVER use "Co-Authored-By: Claude" or "Generated with Claude Code"
- Keep commits clean without any AI references

---

## ========================================
## ZOLYMARKET vs SHADOW PROTOCOL KARSILASTIRMA
## ========================================

### Zolymarket (1. olan proje) - Ozet

**Proje Tipi:** Private Prediction Markets (Tahmin Pazari)
**Konsept:** Encrypted bet amounts, encrypted option selection

**Contract Yapisi:**
```
BetMarketCore.sol     - Ana betting logic (~700 lines)
BetMarketPayout.sol   - Async payout with callback (~340 lines)
BetMarketStats.sol    - Statistics decryption (~150 lines)
CategoryManager.sol   - Category management
```

**Kullanilan FHE:**
- euint64: Balances, bet amounts, pool totals
- euint32: Participant counts
- euint8: Option indices, outcomes
- ebool: Validations

---

### HEAD TO HEAD KARSILASTIRMA

| Ozellik | Shadow Protocol | Zolymarket | Kazanan |
|---------|-----------------|------------|---------|
| **Contract Complexity** | 3200+ lines | ~1200 lines | Shadow (daha kapsamli) |
| **FHE Type Usage** | euint8-256, ebool, eaddress | euint8-64, euint32, ebool | Shadow (eaddress UNIQUE!) |
| **Anonymous Trading** | ✅ eaddress encryptedOwner | ❌ YOK | Shadow |
| **Encrypted Limit Orders** | ✅ Trigger price encrypted | ❌ YOK | Shadow |
| **Leverage Trading** | ✅ 2x-100x | ❌ YOK | Shadow |
| **LP Pool** | ✅ GMX-style | ❌ YOK | Shadow |
| **Random Generation** | ✅ FHE.randEuint*() | ❌ YOK | Shadow |
| **Operator Pattern** | ✅ setOperator() var | ❌ YOK | Shadow |
| **Public Decryption** | ⚠️ makePubliclyDecryptable() | ✅ FHE.requestDecryption + callback | Zolymarket |
| **checkSignatures()** | ❌ EKSIK | ✅ Implemented | Zolymarket |
| **Async Callback Pattern** | ❌ YOK | ✅ Implemented (requestDecryption) | Zolymarket |
| **User Decryption UI** | ❌ EKSIK | ✅ VAR | Zolymarket |
| **Documentation** | ⚠️ Sadece claude.md | ✅ Profesyonel (FHEVM_INTEGRATION.md) | Zolymarket |
| **Backend** | ❌ YOK | ✅ Node.js + MongoDB | Zolymarket |
| **README Quality** | ⚠️ Basit | ✅ Badges, Screenshots, Diagrams | Zolymarket |
| **Test Coverage** | ❌ Az/Yok | ⚠️ Var ama yetersiz | Tie |

---

### ZOLYMARKET'IN KAZANMA SEBEPLERI

#### 1. ASYNC DECRYPTION CALLBACK - KRITIK!
```solidity
// Zolymarket - DOGRU YAPMISLAR
function requestPayout(uint256 _betId) external {
    bytes32[] memory cts = new bytes32[](count);
    // ... encrypted values
    uint256 requestId = FHE.requestDecryption(cts, this.callbackPayout.selector);
}

function callbackPayout(
    uint256 requestId,
    bytes memory cleartexts,
    bytes memory decryptionProof
) external {
    FHE.checkSignatures(requestId, cleartexts, decryptionProof); // KRITIK!
    // ... payout hesaplama
}
```

**Bizde EKSIK:** `FHE.requestDecryption()` ve callback pattern YOK!

#### 2. DOKUMANTASYON KALITESI
- `FHEVM_INTEGRATION.md` - 1200+ satir teknik dokumantasyon
- Her FHEVM ozelliginin hangi dosyada, hangi satirda kullanildigini gostermisler
- Flow diagramlari (ASCII art)
- Troubleshooting section (9 common issue + solutions)
- Frontend-Contract mapping

#### 3. END-TO-END FLOW TAMAMLANMIS
```
User Places Bet → Encrypted → Contract stores → Bet resolves
→ requestPayout() → Relayer decrypts → callbackPayout() → claimPayout()
```

**Bizde:** Deposit → Trade → ... (liquidation/close eksik!)

#### 4. BACKEND INTEGRATION
- MongoDB ile metadata storage
- Express.js API
- Category management
- User position tracking (off-chain)

---

### SHADOW PROTOCOL'UN USTUN YANLARI

#### 1. ANONYMOUS TRADING (UNIQUE!)
```solidity
// SADECE BIZDE VAR!
struct AnonymousPosition {
    eaddress encryptedOwner;  // Owner bile encrypted!
    euint64 collateral;
    euint64 size;
    // ...
}
```
Zolymarket'te pozisyon sahibi public, bizde ENCRYPTED!

#### 2. LEVERAGE TRADING
- 2x - 100x leverage
- Encrypted P&L calculation
- Liquidation logic (eksik de olsa)

#### 3. LP POOL (GMX-Style)
- LPs trader loss'larından kazanıyor
- Epoch-based rewards
- Encrypted LP balances

#### 4. FHE RANDOM
```solidity
// Market Maker'da kullaniliyor
FHE.randEuint64()  // On-chain encrypted random
```

#### 5. ENCRYPTED LIMIT ORDERS
- Trigger price encrypted
- Front-running IMKANSIZ
- MEV protection built-in

---

### SHADOW PROTOCOL ICIN AKSIYON PLANI

#### KRITIK (Zolymarket'ten Ogrenilenler):

**1. Async Decryption Callback Ekle**
```solidity
// ShadowVault.sol'a ekle
function requestPositionClose(uint256 positionId) external {
    Position storage pos = _positions[positionId];

    bytes32[] memory cts = new bytes32[](3);
    cts[0] = FHE.toBytes32(pos.collateral);
    cts[1] = FHE.toBytes32(pos.size);
    cts[2] = FHE.toBytes32(pos.entryPrice);

    uint256 requestId = FHE.requestDecryption(cts, this.finalizeClose.selector);
    _pendingCloses[requestId] = positionId;
}

function finalizeClose(
    uint256 requestId,
    bytes memory cleartexts,
    bytes memory decryptionProof
) external {
    FHE.checkSignatures(requestId, cleartexts, decryptionProof);
    // ... P&L hesapla ve kapat
}
```

**2. User Decryption UI Ekle**
- Wallet sayfasina "Show Balance" butonu
- Trade sayfasina "View Position" butonu
- EIP-712 signature flow

**3. Operator UX Ekle**
- "Enable Session Trading" butonu
- setOperator() cagirsin
- Sonraki trade'lerde popup yok

**4. README Profesyonellestir**
- Badges ekle
- Screenshots ekle
- Architecture diagram
- FHEVM features listesi
- Demo video linki

**5. checkSignatures() Implement Et**
- Liquidation flow'da
- Position close'da
- Payout'ta

---

### HACKATHON JURI PERSPEKTIFI

**Neden Zolymarket Kazandi:**
1. ✅ Calisan end-to-end flow (bet → resolve → payout)
2. ✅ Async decryption DOGRU implement edilmis
3. ✅ Profesyonel dokumantasyon
4. ✅ Backend integration
5. ✅ Troubleshooting guide (juri icin faydali)

**Neden Shadow Protocol Kazanabilir:**
1. ✅ Daha advanced FHE kullanimi (eaddress, random, etc.)
2. ✅ Unique features (anonymous trading, leverage, LP pool)
3. ✅ Daha kapsamli contract logic
4. ⚠️ AMA: End-to-end flow eksik!

---

### SONUC

**Shadow Protocol teknik olarak daha guclu AMA:**
- Async decryption flow eksik
- checkSignatures() yok
- Dokumantasyon zayif
- Frontend-contract integration tam degil

**Oncelik Sirasi:**
1. 🔴 Async decryption callback ekle (KRITIK)
2. 🔴 checkSignatures() implement et
3. 🟠 User Decryption UI
4. 🟠 Operator UX
5. 🟡 README/Docs profesyonellestir
6. 🟢 Test coverage artir
