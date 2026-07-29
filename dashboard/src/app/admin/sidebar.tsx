"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN KENAR MENÜSÜ
// Tek veri kaynağı: `./nav` (MENU). Bu dosya sadece görünüm + davranış:
//   • arama kutusu (63 sayfa arasında isimle bulmak için)
//   • gruplar açılır-kapanır, aktif sayfanın grubu her zaman açık
//   • daraltılabilir (collapsed) kolon
// Menüye sayfa eklemek/çıkarmak için SADECE `nav.ts` düzenlenir.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Search, X } from "lucide-react";
import { CerberusLogo } from "@/components/DealHoundLogo";
import { MENU, type MenuItem, SHOW_LAB } from "./nav";

const ACCENT = "#8ed1df";

/** Türkçe karakterleri de kapsayan basit arama normalizasyonu. */
function norm(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");

  // Lab grubu sadece geliştirici görünümünde (NEXT_PUBLIC_SHOW_WIP=1).
  const groups = useMemo(() => MENU.filter((g) => (g.lab ? SHOW_LAB : true)), []);

  // Arama: ad + eş anlamlı (alias) + yol + açıklama üzerinde eşleşir.
  // ÖNEMLİ: arama Lab/arşiv sayfalarını DA bulur (menüde gizli olsalar bile) —
  // "sayfa vardı ama bulamıyorum" derdinin asıl çözümü bu. Sonuç satırında
  // hangi gruptan geldiği yazar, böylece arşiv olduğu görünür.
  const query = norm(q);
  const results: { item: MenuItem; grup: string }[] = useMemo(() => {
    if (!query) return [];
    const hit: { item: MenuItem; grup: string }[] = [];
    for (const g of MENU) {
      for (const it of g.items) {
        const hay = norm([it.label, it.href, it.hint ?? "", ...(it.alias ?? [])].join(" "));
        if (hay.includes(query)) hit.push({ item: it, grup: g.label });
      }
    }
    return hit;
  }, [query]);

  const Item = ({ n, groupLabel }: { n: MenuItem; groupLabel?: string }) => {
    const active = pathname === n.href;
    return (
      <Link
        href={n.href}
        title={collapsed ? n.label : n.hint}
        className="group relative flex items-center gap-3 rounded-lg text-[13px] transition-all"
        style={{
          padding: collapsed ? "9px 0" : "8px 11px",
          background: active ? "var(--surface-high)" : "transparent",
          color: active ? "var(--primary)" : "var(--muted)",
          fontWeight: active ? 600 : 450,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        {active && !collapsed && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ background: ACCENT }} />
        )}
        <n.icon className="w-[17px] h-[17px] shrink-0" style={{ color: active ? ACCENT : "currentColor" }} />
        {!collapsed && (
          <span className="truncate">
            {n.label}
            {groupLabel && (
              <span className="block text-[9px] uppercase tracking-wider" style={{ opacity: 0.5 }}>
                {groupLabel}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  };

  return (
    /* print:hidden — yazdırmada (ör. parsel tek-sayfa sunumu) menü çıkmasın */
    <aside
      className="shrink-0 flex flex-col transition-all duration-200 print:hidden"
      style={{ width: collapsed ? 60 : 244, background: "var(--surface)", borderRight: "1px solid var(--surface-high)" }}
    >
      {/* Başlık */}
      <div className="flex items-center gap-2.5 px-3.5 border-b min-h-[62px]" style={{ borderColor: "var(--surface-high)" }}>
        <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 rounded-lg p-1" style={{ background: "var(--primary)" }}>
            <CerberusLogo size={26} />
          </span>
          {!collapsed && (
            <span className="leading-none min-w-0">
              <span className="text-[15px] font-extrabold tracking-tight">
                Vega<span style={{ color: ACCENT }}>Land</span>
              </span>
              <span className="block text-[9px] uppercase tracking-[0.18em] mt-1" style={{ color: "var(--muted)" }}>
                Cerberus Engine
              </span>
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          className="ml-auto p-1.5 rounded-lg transition-colors hover:bg-black/5 shrink-0"
          style={{ color: "var(--muted)" }}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Arama kutusu — daraltılmışken gizli */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
            style={{ background: "var(--surface-low, rgba(0,0,0,0.04))", border: "1px solid var(--surface-high)" }}
          >
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sayfa ara…"
              aria-label="Sayfa ara"
              className="w-full bg-transparent text-[12px] outline-none"
              style={{ color: "var(--foreground)" }}
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Aramayı temizle" style={{ color: "var(--muted)" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Menü */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
        {query ? (
          <div className="space-y-0.5">
            <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
              {results.length} sonuç
            </p>
            {results.map((r) => (
              <Item key={r.item.href} n={r.item} groupLabel={r.grup} />
            ))}
            {results.length === 0 && (
              <p className="px-3 py-6 text-[12px]" style={{ color: "var(--muted)" }}>
                Eşleşen sayfa yok.
              </p>
            )}
          </div>
        ) : (
          groups.map((g, gi) => {
            const hasActive = g.items.some((n) => pathname === n.href);
            const open = collapsed || hasActive || !closed[g.label];
            return (
              <div key={g.label} className={gi > 0 ? "mt-4" : ""}>
                {!collapsed && (
                  <button
                    onClick={() => setClosed((p) => ({ ...p, [g.label]: !p[g.label] }))}
                    className="w-full flex items-center gap-1 px-3 mb-1.5"
                    aria-expanded={open}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", opacity: 0.75 }}>
                      {g.label}
                    </span>
                    <ChevronDown
                      className="w-3 h-3 ml-auto transition-transform"
                      style={{ color: "var(--muted)", opacity: 0.6, transform: open ? "none" : "rotate(-90deg)" }}
                    />
                  </button>
                )}
                {collapsed && gi > 0 && <div className="my-2 mx-3 border-t" style={{ borderColor: "var(--surface-high)" }} />}
                {open && <div className="space-y-0.5">{g.items.map((n) => <Item key={n.href} n={n} />)}</div>}
              </div>
            );
          })
        )}
      </nav>

      <div className="p-2 border-t" style={{ borderColor: "var(--surface-high)" }}>
        <Link
          href="/"
          title={collapsed ? "Siteye dön" : undefined}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-black/5"
          style={{ color: "var(--muted)", justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && "Siteye dön"}
        </Link>
      </div>
    </aside>
  );
}
