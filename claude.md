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

### Hackathon icin KRITIK
- [ ] Chart SSR sorununu duzelt
- [ ] Order Book'u live fiyatlarla guncelle
- [ ] Sepolia'da gercek FHE deploy (Zama ayri chain DEGIL!)
- [ ] Frontend'den gercek trade acma/kapama
- [ ] %100 zararda otomatik likidasyon
- [ ] Gelir havuzu: %50 staker/LP, %50 protocol
- [ ] Unit testler yaz
- [ ] Profesyonel README hazirla

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

### Nice to Have (Zaman kalirsa)
- [ ] Transaction history sayfasi
- [ ] Mobile responsive UI
- [ ] Keyboard shortcuts
- [ ] Advanced Chart (TradingView tarzi indicators)
- [ ] Trade Card / Share Card (kapatilan pozisyonlar icin)
- [ ] Limit Order sistemi
- [ ] Stop Loss / Take Profit
- [ ] Partial Close

---

## FHEVM Technical Reference

### Encrypted Types
```solidity
// Encrypted tipler
ebool      // encrypted boolean
euint8     // encrypted uint8
euint16    // encrypted uint16
euint32    // encrypted uint32
euint64    // encrypted uint64
euint128   // encrypted uint128
euint256   // encrypted uint256
eaddress   // encrypted address

// External input tipleri (kullanici inputlari icin)
externalEbool
externalEuint8
externalEuint16
externalEuint32
externalEuint64
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

    // Izinleri ver
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
    .add64(amount)  // add8, add16, add32, add64, etc.
    .encrypt();

// Transaction'da kullan
await contract.deposit(
    encryptedInput.handles[0],  // Encrypted handle
    encryptedInput.inputProof   // ZK proof
);
```

### ACL (Access Control List) System
```solidity
// Izin ver
FHE.allow(ciphertext, address);      // Kalici izin
FHE.allowThis(ciphertext);           // Contract'a kalici izin
FHE.allowTransient(ciphertext, addr); // Gecici izin (tx icinde)

// Izin kontrol
FHE.isSenderAllowed(ciphertext);     // msg.sender erisebilir mi?
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
FHE.asEuint64(value), FHE.asEbool(value)

// Random generation
FHE.randEbool(), FHE.randEuint8(), FHE.randEuint16()
FHE.randEuint32(), FHE.randEuint64()
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

## Decryption Methods

### 1. User Decryption (Off-chain, Private)
- Kullanici kendi verisini decyrpt eder
- Izinler on-chain verilir, decryption off-chain olur
- Sonuc sadece kullaniciya gorunur

```solidity
// Contract izin verir
FHE.allowThis(_balance);
FHE.allow(_balance, msg.sender);
```

```typescript
// Client-side decryption
const clearValue = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    encryptedHandle,
    contractAddress,
    userSigner
);
```

### 2. Public Decryption (3 Adimli Islem)
Herkese acik degerler icin (ornegin oyun sonuclari):

**Adim 1: On-chain - Publicly decryptable olarak isaretle**
```solidity
FHE.makePubliclyDecryptable(encryptedValue);
```

**Adim 2: Off-chain - Relayer uzerinden decryption iste**
```typescript
const result = await fhevm.publicDecrypt([encryptedHandle]);
// Dondurur: { clearValues, abiEncodedClearValues, decryptionProof }
```

**Adim 3: On-chain - Dogrula ve kullan**
```solidity
bytes32[] memory cts = new bytes32[](1);
cts[0] = FHE.toBytes32(encryptedValue);
FHE.checkSignatures(cts, abiEncodedClearValues, decryptionProof);
// Artik dogrulanmis clear degeri kullanabilirsin
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

## OpenZeppelin Confidential Contracts
- ERC7984: Confidential fungible tokens (ERC20 gibi ama encrypted)
- Encrypted balance ve transfer destekler
- `confidentialTransfer` ve `confidentialBalanceOf` kullanir

---

## Onemli Hatirlatmalar
1. Zama ayri chain DEGIL - Sepolia uzerinde FHE
2. Encrypted degerler icin MUTLAKA `FHE.allowThis()` ve `FHE.allow()` cagir
3. Kullanici inputlari `externalEuintXX` + `FHE.fromExternal()` ile
4. Branching icin `if` degil `FHE.select()` kullan
5. Her encrypted degisken icin ACL izni ver
