# Shadow Protocol - Gelistirme Notlari

## Proje Amaci
FHE (Fully Homomorphic Encryption) kullanan Private Pre-IPO Leverage Trading Platform
- Zama Builder Track Hackathon icin

## Temel Konsept
- Kullanici pozisyonlari FHE ile sifreleniyor
- Kimse (validator bile) pozisyonlari goremiyor
- Pre-IPO sirketlerde kaldiracli islem

---

## TODO Listesi

### 1. Arayuz Yenileme (Lighter benzeri)
- [ ] Profesyonel trading layout
- [ ] Chart tam genislik + volume bar
- [ ] Ust bar: Mark Price, Index Price, 24h Volume, Open Interest, Funding Rate
- [ ] Trading panel: Market/Limit tabs, TP/SL
- [ ] Positions panel (alt kisim)
- [ ] Monospace fontlar, kompakt spacing

### 2. Encrypted Order Book
**Konsept:** Order book gosterilecek ama emirler sifreli

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
- Miktar bar olarak gorunur (toplam likidite - OPSIYONEL)
- Kim koydugu, tam miktari -> Encrypted
- Bu sayede FHE anlamli kaliyor

**Not:** Bot trade'leri bu order book'a yansiyacak (simule)

### 3. Zama Devnet Deploy
- ETH lazim (faucet'ten al)
- Trade intervali: 30-60 saniye (gas tasarrufu)
- Gercek FHE fonksiyonlari calisacak

---

## Deployment Bilgileri

### Sepolia (Test - FHE'siz)
```
ShadowOracle:            0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17
ShadowMarketMakerSimple: 0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb
ShadowVault:             0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5
ShadowUSD:               0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb
```

### Zama Devnet (Production - FHE aktif)
- Henuz deploy edilmedi
- Contract adresleri: TBD

---

## Teknik Notlar

### Price Formula
```
modifierPercent = (oiDiff * 1) / 10000
```
- 1% hareket icin: oiDiff = 100,000,000 units = $100
- Max modifier: +-20%

### Trade Size'lar (Guncellenmis)
- PUMP: $50-$300
- DUMP: $50-$300
- SIDEWAYS: $20-$150
- VOLATILE: $100-$500
- ACCUMULATION: $200-$800
- DISTRIBUTION: $200-$800

---

## Daha Sonra Yapilacaklar
- [ ] Kemik kitleyi oturtalim - mantik kontrolu
- [ ] FHE gercekten ne sifreliyor, ne gorulmuyor kontrol et
- [ ] Gas optimizasyonu
- [ ] Mobile responsive
