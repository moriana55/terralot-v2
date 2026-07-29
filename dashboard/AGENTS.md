<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Admin menüsü — tek kaynak `src/app/admin/nav.ts`

Menü artık `layout.tsx` içinde tanımlı DEĞİL:

| Dosya | Rol |
|---|---|
| `src/app/admin/nav.ts` | **Sadece veri.** Gruplar, sayfalar, açıklama (`hint`), arama eş anlamlıları (`alias`). |
| `src/app/admin/sidebar.tsx` | Görünüm + davranış (arama kutusu, açılır-kapanır gruplar, aktif vurgu). |
| `src/app/admin/layout.tsx` | Sadece iki kolonu yan yana koyar. |

**Menüye sayfa eklemek/çıkarmak için yalnızca `nav.ts` düzenlenir.**

Gruplama alfabetik veya teknik değil, **sahibin günlük iş akışına** göredir:
`Bul → Değerlendir → Sahibe ulaş → Sat → Pazar & rakip → Takip & sistem`.
Yeni sayfa eklerken "bu, işin hangi adımında açılır?" sorusuna göre grup seç.

## `lab: true` ve NEXT_PUBLIC_SHOW_WIP

`nav.ts` içindeki `🧪 Lab · arşiv` grubu (`lab: true`) mock/yarım/eski veri içeren ya da başka bir
sayfayla örtüşen ekranları taşır. Müşteri (Ahmet) görünümünde gizlenir; sadece
`NEXT_PUBLIC_SHOW_WIP="1"` iken (geliştirici) görünür. Yeni mock modül eklerken Lab grubuna koy.
**Route'lar asla silinmez** — eski link/yer imi çalışmaya devam eder; emekliye ayrılan sayfa
`redirect()` ile halefine yönlendirilir (örnek: `admin/tax-leads`, `admin/off-market`).

> Arama kutusu Lab sayfalarını da bulur (menüde gizli olsalar bile) ve sonuç satırında grubu yazar.

Her sayfanın ne yaptığı, hangi veriyi okuduğu, neden kaldığı/arşive alındığı: **`ADMIN-ENVANTER.md`**.

## UI kuralları

- Arka plan açık/beyaz (`var(--surface)`), renk **sadece anlam taşıdığı yerde**.
- Native `<select>` KULLANILMAZ → `@/components/Dropdown`.
- Arayüz, kod yorumları ve commit mesajları Türkçe.
- Uydurma sayı/yüzde yok: veri yoksa `0`, kaynak kurulu değilse dürüst "kurulum gerekli".
