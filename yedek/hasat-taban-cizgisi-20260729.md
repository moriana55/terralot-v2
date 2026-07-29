# Filtreli hasat — TABAN ÇİZGİSİ (yazmadan önce)

Ölçüm zamanı: 2026-07-29
Kaynak: `pg_database_size` / `pg_total_relation_size` (Supabase, DATABASE_URL pooler)

## Toplam

| Ölçü | Değer |
|---|---|
| `offmarket_leads` satır | **566.265** |
| `offmarket_leads` tablo boyutu | **979 MB** |
| Veritabanı toplam | **1123 MB** (1,10 GB) |
| Tavan (bu turda aşılmayacak) | **2 GB** |
| A+/A **mektup atılabilir** lead | **8.544** |

"Mektup atılabilir" = `owner`, `mailing_address`, `mailing_city`, `mailing_state`,
`mailing_zip` beşi de dolu.

## Eyalet kırılımı

| Eyalet | Satır | A+/A | A+/A mailable |
|---|---:|---:|---:|
| TX | 153.106 | 1.409 | 1.409 |
| FL | 84.360 | 626 | 626 |
| AR | 71.585 | 0 | 0 |
| NM | 69.162 | 1.886 | 1.886 |
| NC | 38.148 | 201 | 201 |
| CO | 33.243 | 1.047 | 1.044 |
| NV | 30.481 | 1.558 | 1.558 |
| OR | 23.268 | 764 | 764 |
| AZ | 20.000 | 1.002 | 1.002 |
| SC | 11.861 | 5 | 5 |
| MO | 10.353 | 49 | 49 |
| GA | 10.256 | 0 | 0 |
| MI | 6.431 | 0 | 0 |
| TN | 3.666 | 0 | 0 |
| OK | 345 | 0 | 0 |
| **Toplam** | **566.265** | **8.547** | **8.544** |

## Kural

Bu turda yazma YALNIZCA `INSERT ... ON CONFLICT (lead_id) DO UPDATE` ile yapılır.
`DELETE` / `DROP` / `TRUNCATE` yok. Satır sayısı 566.265'in altına düşemez.
