# Florida DOR — veri talebi (gönderilecek e-posta)

**Kime:** PTOTechnology@floridarevenue.com
**Konu:** Data request — SDF and NAL files, all counties, 2020–2026

---

Dear Property Tax Oversight Technology Team,

I would like to request the following assessment roll data files:

- **File types:** SDF (Sale Data File) and NAL (Name–Address–Legal)
- **Counties:** All counties (statewide)
- **Years:** 2020 through 2026
- **Submission type:** Final (preliminary where final is not yet available)
- **Format:** Comma-delimited CSV

The data will be used for private market research on vacant land values and
transaction activity. If a statewide request is too large to fulfill at once,
please advise on the preferred method — for example, delivery by county batch,
by year, or via a download link — and I will follow your process.

Please also let me know if there is any fee or form required.

Thank you for your time.

Best regards,
Yiğit Ertürk
NocturnDev
sales@nocturndev.com

---

## Neden bu dosyalar

| | ArcGIS katmanı (şu anki kaynak) | SDF (istenen) |
|---|---|---|
| Satış geçmişi | Son **2** satış | **2009'dan bugüne tamamı** |
| Kapsam | Sorgu kesiliyor, 9 county alınabildi | 67 county, tek dosya |
| Kalite kodu | Var ama slot sırası belirsiz | Resmî alan tanımıyla |
| Erişim | Ağır sorguda "fetch failed" | İndir, bitti |

## Cevap gelince yapılacaklar

1. `land_comps` tablosunu SDF'ten yeniden kur — FL'de comp kapsamı 67 county'ye çıkar
2. Çevirme kanıtını gerçek satış zincirlerinden üret (9 county değil, tamamı)
3. `county_valuation` T1/T2 kademesi yayılır → fiyat merdiveninin A kademesi büyür
4. ArcGIS bağımlılığı FL için tamamen kalkar
