# Terralot — Ahmet'in İstediği Sisteme Hazırlık Karnesi (20 Madde)

"Ucuz arsa bul → değerle → düşük teklifle al → taksitle sat" sisteminin tamamı 20 yetenek.
Her madde gerçek koddan işaretlendi. **✅ Hazır · 🟡 Kısmen (bağlanması/düzeltilmesi lazım) · 🔴 Yok**

---

## 🔎 BUL (Sourcing)
| # | Yetenek | Durum | Not |
|---|---|---|---|
| 1 | Çoklu eyalet boş arsa verisi | ✅ | AZ/TX/NM + tax-deed, 20K+ parsel |
| 2 | Absentee / şehir-dışı sahip filtresi | ✅ | scoring absentee regex + Tüm Dealler filtresi |
| 3 | Vergi-borçlu (tax-delinquent) tespiti | 🟡 | tax-leads var; `is_delinquent` kolonu pipeline'a tam bağlı değil |
| 4 | Tek birleşik filtrelenebilir liste (PropStream tarzı) | ✅ | **Tüm Dealler** (yeni) — eyalet/acre/değer/spread + sıralama + CSV |
| 5 | Florida kaynağı ("FL ile başla") | 🟡 | `scrape_florida.js` hazır; seed/pipeline'a bağlı değil |

## 🧮 DEĞERLE (Valuation + Scrub)
| # | Yetenek | Durum | Not |
|---|---|---|---|
| 6 | Comps / piyasa değeri | 🟡 | Regrid değerleme var; otomatik comps sınırlı |
| 7 | Sel / wetland scrub | ✅ | dd-check → **FEMA NFHL** (gerçek) |
| 8 | Yol erişimi / landlocked scrub | ✅ | dd-check → **OpenStreetMap** (gerçek) |
| 9 | İnşa edilebilirlik (eğim/septik/zoning) | ✅ | buildability sayfası |
| 10 | AI skor + grade + AL/ELE kararı | ✅ | scoring + **Scrub scorecard** (yeni) + buy-box verdict |

## ✉️ AL (Acquire / Blind Offer)
| # | Yetenek | Durum | Not |
|---|---|---|---|
| 11 | Blind-offer mektup şablonu | ✅ | mailer-data tpl3 (offer) + tpl5 (imzalanabilir) |
| 12 | Teklif hesabı = piyasa değeri × %15–25 | 🟡 | hesap var ama default %110 minimum-bid → **düzeltilecek** |
| 13 | Direct mail gönderimi (Lob) | 🟡 | plumbing tam, **mock**; canlı key + template yüklenmemiş |
| 14 | Skip trace (sahip telefon) | 🟡 | adres var; telefon skip trace entegre değil |
| 15 | Pipeline / deal takibi | ✅ | admin/deals + contacts + status |

## 💵 SAT (Owner-Finance)
| # | Yetenek | Durum | Not |
|---|---|---|---|
| 16 | Owner-finance hesaplayıcı (APR/peşinat/vade) | ✅ | flip-calc tam (amortisman, ROI, IRR) |
| 17 | "Owner-Finance ile Sat" / listing oluştur | 🟡 | listings CRUD var; tek-tık Sat butonu yok |
| 18 | Alıcı portalı + ödeme planı | 🟡 | iskelet var, sahte veri |
| 19 | Tahsilat + imza (GeekPay/SignNow/Stripe) | 🔴 | yok (demo sonrası) |

## 📊 ANLATIM / YÖNETİM
| # | Yetenek | Durum | Not |
|---|---|---|---|
| 20 | Müşteriye anlatım ekranı (sistem/metodoloji) | ✅ | **Sistem & Yöntem** (yeni) — 7 bölüm, kaynaklı |

---

## SONUÇ

| | Adet |
|---|---|
| ✅ Hazır | **11** |
| 🟡 Kısmen | **8** |
| 🔴 Yok | **1** |

**Hazırlık skoru ≈ %75** (✅=1, 🟡=0.5, 🔴=0 → 15 / 20)

### En çok ibreyi oynatan 4 iş (demo için)
1. **#12 Teklif mantığı** → `piyasa değeri × %20` yap (2-3s) — rakamlar yol haritasıyla birebir
2. **#17 "Sat" butonu** + owner-finance preset (5-6s) — al→sat döngüsü görünür
3. **#5 Florida seed** (3s) — "TX'te kanıtladık, FL'ye genişledik"
4. **#13 Mektup→listing loop** kapatma (4-5s) — demonun "vау" anı

Bu 4'ü bitince skor **~%85'e** çıkar ve uçtan uca döngü Ahmet'e gösterilebilir olur.
Kalan 🟡/🔴'lar (skip trace telefon, buyer portal, GeekPay/Stripe) **demo sonrası**.
