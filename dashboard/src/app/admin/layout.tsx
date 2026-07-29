// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ŞABLONU — menü artık burada tanımlı DEĞİL.
//   • Menü verisi : ./nav.ts   (tek kaynak — sayfa eklemek/çıkarmak için orası)
//   • Menü görünümü: ./sidebar.tsx (arama kutusu, gruplar, aktif vurgu)
// Bu dosya sadece iki kolonu yan yana koyar.
// ─────────────────────────────────────────────────────────────────────────────

import AdminSidebar from "./sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
    </div>
  );
}
