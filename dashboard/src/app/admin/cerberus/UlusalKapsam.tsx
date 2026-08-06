import huni from "@/data/ulusal-huni.json";
import { Globe, Download, Filter, Award } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ULUSAL KAPSAM — Cerberus konsolunun üstündeki huni kartı.
//
// ÜÇ RAKAM AYRI DURUR, birbirine karıştırılmaz:
//   1) ERİŞİM   — kaynakların bildirdiği toplam parsel. "Erişebiliyoruz" demek,
//                 "indirdik" demek DEĞİL.
//   2) İNDİRİLEN— sunucuya gerçekten inen satır sayısı (ilerleme dosyalarından).
//   3) İŞLENEN  — ayıklamadan geçip kovaya giren satır + puanlanan arsa.
//
// Müşteriye "121 milyon parsel inceledik" denmesin diye kart bu üçünü ayrı
// gösterir. Rakamlar `scraper/ulusal/ulusal-huni.json` anlık görüntüsünden gelir;
// ölçüm tarihi kartın altında yazar — canlı değil, snapshot olduğu açık.
// ─────────────────────────────────────────────────────────────────────────────

const bin = (n: number) => n.toLocaleString("tr-TR");

export function UlusalKapsam() {
  const olcum = new Date(huni.olculdu).toLocaleString("tr-TR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const birinci = huni.puanlanan["A+"] + huni.puanlanan.A;

  return (
    <section
      className="rounded-xl border p-5 mb-6"
      style={{ background: "var(--surface)", borderColor: "var(--outline)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-4 h-4" style={{ color: "var(--primary)" }} />
        <h2 className="font-bold text-sm" style={{ color: "var(--primary)" }}>
          Ulusal Kapsam
        </h2>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          · {huni.erisim.eyalet} eyalet
        </span>
      </div>
      <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>
        Üç rakam ayrıdır: neye <b>erişebildiğimiz</b>, ne kadarını <b>indirdiğimiz</b>,
        ne kadarını <b>işlediğimiz</b>. Karıştırılmamalı.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Adim
          no={1}
          Icon={Globe}
          baslik="Erişimimiz var"
          deger={bin(huni.erisim.parsel)}
          birim="parsel"
          satirlar={[
            `eyalet geneli ${bin(huni.erisim.eyaletGeneli.parsel)} · ${huni.erisim.eyaletGeneli.eyalet} eyalet`,
            `county ${bin(huni.erisim.county.parsel)} · ${huni.erisim.county.adet} county / ${huni.erisim.county.eyalet} eyalet`,
          ]}
        />
        <Adim
          no={2}
          Icon={Download}
          baslik="İndirdik"
          deger={bin(huni.indirilen.parsel)}
          birim="parsel"
          satirlar={[
            `eyalet geneli ${bin(huni.indirilen.eyaletGeneli)}`,
            `county ${bin(huni.indirilen.county)} · ${huni.indirilen.countyDosya} county`,
          ]}
        />
        <Adim
          no={3}
          Icon={Filter}
          baslik="İşledik"
          deger={bin(huni.islenen.okunan)}
          birim="satır"
          satirlar={[
            `arsa adayı ${bin(huni.islenen.aday)}`,
            `binalı ${bin(huni.islenen.binali)} · arşiv`,
            `eyalet dışı sahip ${bin(huni.islenen.eyaletDisi)}`,
          ]}
        />
        <Adim
          no={4}
          Icon={Award}
          baslik="Birinci sınıf"
          deger={bin(birinci)}
          birim="aday"
          vurgu
          satirlar={[
            `A+ ${bin(huni.puanlanan["A+"])} · A ${bin(huni.puanlanan.A)}`,
            `B ${bin(huni.puanlanan.B)} · C ${bin(huni.puanlanan.C)}`,
            `toplam puanlı ${bin(huni.puanlanan.toplam)}`,
          ]}
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr style={{ color: "var(--muted)" }}>
              <th className="text-left font-medium py-1 pr-3">Eyalet</th>
              <th className="text-right font-medium py-1 px-3">Arsa adayı</th>
              <th className="text-right font-medium py-1 px-3">A+</th>
              <th className="text-right font-medium py-1 pl-3">A</th>
            </tr>
          </thead>
          <tbody>
            {huni.eyaletler.map((e) => (
              <tr key={e.eyalet} style={{ borderTop: "1px solid var(--outline)" }}>
                <td className="py-1 pr-3 font-bold" style={{ color: "var(--primary)" }}>{e.eyalet}</td>
                <td className="py-1 px-3 text-right tabular-nums">{bin(e.aday)}</td>
                <td className="py-1 px-3 text-right tabular-nums">{bin(e["A+"])}</td>
                <td className="py-1 pl-3 text-right tabular-nums">{bin(e.A)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>
        Ölçüm: {olcum} · anlık görüntü, canlı değil. Kaynakların kendisi
        <a href="/kapsam" className="underline underline-offset-2 mx-1" style={{ color: "var(--primary-dim)" }}>
          /kapsam
        </a>
        sayfasında canlı sorguyla doğrulanabilir.
      </p>
    </section>
  );
}

function Adim({
  no, Icon, baslik, deger, birim, satirlar, vurgu,
}: {
  no: number;
  Icon: typeof Globe;
  baslik: string;
  deger: string;
  birim: string;
  satirlar: string[];
  vurgu?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        background: vurgu ? "var(--surface-high)" : "var(--surface-low)",
        borderColor: "var(--outline)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          {no}. {baslik}
        </span>
      </div>
      <div className="text-xl font-bold tabular-nums leading-tight" style={{ color: "var(--primary)" }}>
        {deger}
      </div>
      <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>{birim}</div>
      {satirlar.map((s) => (
        <div key={s} className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          {s}
        </div>
      ))}
    </div>
  );
}
