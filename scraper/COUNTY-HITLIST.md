# 🎯 Terralot — PropStream County Av Listesi

Rina Land / LandModo / Discount Lots'un kovaladığı klasik **ucuz platted-lot** county'leri.
Her county'de **AYNI standart filtreyi** uygula, export et, `import-propstream-csv.mjs` ile bas.
Liste adını **`STATE-County`** koy (örn `CO-Costilla`) → importer eyaleti otomatik tanır.

---

## ⚙️ STANDART FİLTRE (her county'de aynı)
| Filtre | Değer |
|---|---|
| Property Type | `Land` / `Vacant Land` |
| Owner Occupied | `No` |
| **Out of State Owner** | `Yes` ⭐ (sahip başka eyalette = mektup hedefi) |
| Estimated Value | `$0 – $20,000` |
| Lot Size | `0.1 – 5 acre` (platted) · ranch için `5 – 40` |
| (ops.) | `Vacant = Yes`, `Free & Clear`, `High Equity` |

> Çok çıkarsa → value'yu `$15K`'ya çek veya subdivision/zip ile böl.
> Skip-trace bedava kredin varsa export ÖNCESİ bas → telefon+mail de gelir.

---

## 🥇 TIER 1 — efsane land-flip sahası (ÖNCE BUNLAR)

| # | County | Eyalet | Subdivision / bölge | Tipik lot | Not |
|---|---|---|---|---|---|
| 1 | **Costilla** | CO | Sangre de Cristo Ranches, San Luis Valley Ranches, Rio Grande Ranches, Wild Horse Mesa, Forbes Park | 5 acre | **ABD'nin 1 numara land-flip county'si.** Binlerce out-of-state sahip. Mutlaka. |
| 2 | **Pueblo** | CO | Colorado City (Unit 1–15), Pueblo West, Rye | 0.2–1 acre | **Rina'nın o $2.999 lotu burdan.** Colorado City = saf platted-lot. |
| 3 | **Apache** | AZ | Concho, St. Johns, Vernon, Witch Well | 1–2 acre | Ucuz çöl + dağ eteği, çok absentee. |
| 4 | **Navajo** | AZ | Holbrook, Snowflake, Sun Valley, White Mountain Lakes, Heber-Overgaard | 1–1.25 acre | Holbrook lotları efsane ucuz. |
| 5 | **Mohave** | AZ | Golden Valley, Dolan Springs, Yucca, Meadview, Chloride | 1–2 acre | Elimizde 20K bedava var — PropStream'de absentee+telefon için tekrar çek. |
| 6 | **Luna** | NM | Deming (Deming Ranchettes, Tierra del Sol) | 1–2 acre | 157 yaptık → value'yu $20K'ya çıkar, genişlet. |

## 🥈 TIER 2 — ucuz AZ/NM/TX/CO çöl & dağ

| # | County | Eyalet | Subdivision / bölge | Not |
|---|---|---|---|---|
| 7 | **Cochise** | AZ | Pearce/Sunsites, Saint David, Whitewater Draw, Douglas | 1–4 acre, çok ucuz |
| 8 | **Valencia** | NM | Rio Communities, Los Lunas eteği | platted lot bol |
| 9 | **Torrance** | NM | Estancia, Moriarty eteği | ucuz tarım/çöl |
| 10 | **Cibola** | NM | Grants, Milan | |
| 11 | **Hudspeth** | TX | Sierra Blanca, Dell City | batı TX çöl, dipsiz ucuz |
| 12 | **Conejos / Saguache** | CO | Costilla komşusu San Luis Valley | Costilla bitince buraya geç |
| 13 | **Park** | CO | Hartsel, Como, Fairplay eteği | dağ rec-lot, değer biraz yüksek |
| 14 | **Klamath** | OR | Klamath Falls eteği, Sprague River | ucuz batı lot |
| 15 | **Lake** | CA | Clearlake, Clearlake Oaks | ucuz NorCal |

## 🥉 TIER 3 — Florida platted-lot cenneti (HACİM burada)

| # | County | Eyalet | Subdivision / bölge | Not |
|---|---|---|---|---|
| 16 | **Polk** | FL | Poinciana, Indian Lake Estates, Lake Wales | dev hacim |
| 17 | **Charlotte** | FL | Port Charlotte | klasik platted |
| 18 | **Lee** | FL | Lehigh Acres, Cape Coral eteği | on binlerce lot |
| 19 | **Marion** | FL | Silver Springs Shores, Marion Oaks, Ocala | |
| 20 | **Citrus** | FL | Citrus Springs | |
| 21 | **Putnam / Highlands** | FL | Interlachen / Avon Park, Sebring | |
| 22 | **Sarasota** | FL | North Port | |

---

## ▶️ AKIŞ (her county için)
1. Standart filtreyi kur → Search
2. **Save to List** → ad: `STATE-County` (örn `CO-Costilla`)
3. (varsa) **Skip Trace** → telefon+mail
4. **Export → XLSX** → Downloads
5. Dosyayı bana ver → `import-propstream-csv.mjs` ile Supabase'e basarım

**BAŞLA:** `CO-Costilla` + `CO-Pueblo` → ikisini çek, dosyaları at.
