# Shadow Protocol - Proje Notları

---
## ⚠️ ÖNEMLİ UYARI - COMMIT KURALLARI ⚠️

**SAKIN AMA SAKIN COMMİT MESAJLARINDA:**
- "Claude" kelimesi KULLANMA
- "AI" veya "AI-generated" YAZMA
- "Co-Authored-By: Claude" EKLEME
- "Generated with Claude Code" EKLEME
- Herhangi bir AI referansı VERME

**DOĞRU COMMIT ÖRNEĞİ:**
```
feat(markets): add pagination and search functionality
```

**YANLIŞ COMMIT ÖRNEĞİ:**
```
feat: add feature

🤖 Generated with Claude Code
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

> Bu dosya projenin durumunu hızlıca anlamak için kullanılır.

## Proje Nedir?
**Private Leveraged Pre-IPO Trading Platform** - Zama fhEVM (Fully Homomorphic Encryption) ile şifreli pozisyon açma ve trading yapan bir DeFi protokolü.

**Hackathon**: Zama Builder Track - $10,000 prize pool

## Dizin Yapısı

```
/Users/himess/Projects/private-preipo/
├── contracts/                    # Solidity smart contracts
│   ├── core/
│   │   ├── ShadowVault.sol      # Ana trading vault (1214 satır) ⭐
│   │   ├── ShadowLiquidityPool.sol  # LP havuzu
│   │   └── ShadowOracle.sol     # Price oracle
│   └── tokens/
│       └── ShadowUSD.sol        # Stablecoin (sUSD)
├── frontend/                     # Next.js 14 + wagmi + rainbowkit
│   └── src/
│       ├── app/
│       │   ├── markets/page.tsx  # Markets listesi
│       │   ├── trade/page.tsx    # Trading UI
│       │   └── wallet/page.tsx   # Wallet & LP
│       ├── components/           # UI components
│       └── lib/
│           ├── fhe/client.ts     # FHE encryption (mock mode)
│           ├── constants.ts      # Asset definitions
│           └── companyData.ts    # Pre-IPO companies data
├── documents/document/           # Zama dokümanları (18 dosya)
│   ├── 1.txt - 18.txt           # FHE, ACL, ERC7984, Decryption, etc.
│   └── 18.txt ⭐                 # ERC7984 Operator (session-based trading!)
└── hardhat.config.ts             # Network config

# ESKİ ZAMA DOCS KONUMU:
/Users/himess/Documents/zama/
├── zamadoc1 - zamadoc9
```

## Kontrat Özellikleri (FHE)

### ShadowVault.sol - Ana Özellikler:
- `euint64` - Encrypted balances, collateral, leverage
- `ebool` - Encrypted isLong
- `eaddress` - Anonymous trading (encrypted owner)
- `FHE.randEuint64()` - On-chain encrypted randomness
- `FHE.allowTransient()` - Gas optimization
- `FHE.neg()` - Negative P&L support
- Encrypted limit orders (front-running protection)

### ShadowUSD.sol - Confidential Stablecoin:
- ERC7984-like implementation
- All balances encrypted
- `confidentialTransfer()` - Encrypted transfers
- `compareBalances()` - Encrypted comparison
- `splitTransfer()` - Encrypted ratio split

## Frontend Durumu

### Tamamlanan Sayfalar:
- ✅ `/markets` - Markets grid (pagination, search, bookmark, sorting)
- ✅ `/trade` - Trading panel + chart + positions
- ✅ `/wallet` - Wallet, LP staking, confidential transfer

### FHE Client (Mock Mode):
`frontend/src/lib/fhe/client.ts`
- Mock implementation for demo
- Production'da `@zama-fhe/relayer-sdk` ile değiştirilecek

## Zama Network Config

```solidity
// Devnet (test için)
import { ZamaDevnetConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

// Mainnet (production)
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
```

**Zama Devnet Chain ID**: 8009

## Yapılacaklar (TODO)

### Kritik (Hackathon için şart):
1. [ ] Kontratları ZamaDevnetConfig'e migrate et
2. [ ] Zama Devnet'e deploy et
3. [ ] Frontend'e gerçek @zama-fhe/relayer-sdk entegre et
4. [ ] User decryption flow ekle
5. [ ] Temel testler yaz

### 📊 Canlı Chart Simülasyonu:

**✅ Seçenek C - On-Chain Market Maker (SEÇİLDİ!)**

On-chain FHE-encrypted market maker implementasyonu tamamlandı:

```
contracts/bots/ShadowMarketMaker.sol  # On-chain bot kontratı
contracts/mocks/MockFHE.sol           # Sepolia fallback
scripts/runBot.ts                     # Bot runner script
frontend/src/hooks/useOnChainOracle.ts # On-chain data hook
```

**Nasıl Çalışıyor:**
1. `ShadowMarketMaker.sol` FHE.randEuint64() ile encrypted random trade'ler yapar
2. Trade'ler `ShadowOracle` üzerinde Open Interest günceller
3. Fiyat = BasePrice + (Long OI - Short OI) * modifier
4. Frontend on-chain data'yı okur ve chart'ı günceller

**Senaryolar:**
- PUMP (0): %75 alım, bullish
- DUMP (1): %25 alım, bearish
- SIDEWAYS (2): %50 alım, stabil
- VOLATILE (3): %50 alım, büyük dalgalar
- ACCUMULATION (4): %70 alım, whale birikimi
- DISTRIBUTION (5): %30 alım, whale satışı

**Network Desteği:**
- Zama Devnet (Chain ID: 8009) - FHE tam destek
- Sepolia (Chain ID: 11155111) - MockFHE ile fallback

**Komutlar:**
```bash
# Deploy
npx hardhat deploy --network zama
npx hardhat deploy --network sepolia

# Bot çalıştır
npx hardhat run scripts/runBot.ts --network zama
```

**Alternatif Seçenekler (Kullanılmadı):**

~Seçenek A - Client-Side Simülasyon~
- Her kullanıcı farklı fiyat görür (tutarsız)

~Seçenek B - Backend WebSocket~
- Merkezi server gerektirir
- backend/ klasöründe implementasyon var (fallback olarak)

### 🔐 Session-Based Trading (Cüzdan Onayı Olmadan İşlem)

**ERC7984 Operator Pattern** (Doküman 18'de):
```solidity
// Kullanıcı bir kez operator olarak protokolü onaylar
isOperator(userAddress, shadowVaultAddress) // true ise her trade için imza gerekmez

// Operator ile transfer (her seferinde cüzdan popup yok!)
confidentialTransferFrom(msg.sender, address(this), amount)
```

**Nasıl Çalışır:**
1. Kullanıcı ilk girişte "Approve Trading Session" butonuna basar
2. `setOperator(shadowVault, expiry)` çağrılır (1 kez cüzdan onayı)
3. Sonraki tüm trade'ler için cüzdan onayı GEREKMEZ
4. Expiry süresi dolunca tekrar onay gerekir

**Frontend UX:**
- "Connect & Approve" butonu
- Session süresini göster (ör: "Session active: 24h remaining")
- "Revoke Access" butonu

### Mekanikler (Detaylandırılacak):
- [ ] Fee mekanizması - detaylı açıklama ve implementasyon
- [ ] Oracle mekanizması - price feed, update logic

### Nice to Have:
- [ ] Trade Card / Share Card komponenti
- [ ] Position Details Modal
- [ ] Demo video hazırla
- [x] Footer'ı tüm sayfalara ekle

## Hızlı Komutlar

```bash
# Frontend dev
cd /Users/himess/Projects/private-preipo/frontend
npm run dev

# Frontend build
npm run build

# Contracts compile
cd /Users/himess/Projects/private-preipo
npx hardhat compile

# Deploy to Zama devnet
npx hardhat run scripts/deploy.ts --network zama
```

## Önemli Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `contracts/core/ShadowVault.sol` | Ana trading logic |
| `frontend/src/lib/fhe/client.ts` | FHE encryption client |
| `frontend/src/lib/constants.ts` | Asset & market definitions |
| `hardhat.config.ts` | Network & compiler config |

## Social Links (Footer'da)
- GitHub: https://github.com/poppyseedDev
- X: https://x.com/AuroraHimess

---
*Last updated: Dec 9, 2025*
