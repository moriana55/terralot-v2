"use client";

import { useState, useEffect } from "react";
import { Plus, ChevronDown, CalendarDays, Trash2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Update {
  id: string;
  week: string;
  title: string;
  items: string[];
  created_at: string;
}

const ADMIN_PIN = "1234";

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formWeek, setFormWeek] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formItems, setFormItems] = useState("");

  useEffect(() => { fetchUpdates(); }, []);

  async function fetchUpdates() {
    setLoading(true);
    const { data } = await supabase
      .from("updates")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setUpdates(data);
      if (data.length > 0) setExpanded(data[0].id);
    }
    setLoading(false);
  }

  function tryLogin() {
    if (pinInput === ADMIN_PIN) {
      setIsAdminMode(true);
      setShowPinModal(false);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
    }
  }

  async function addUpdate() {
    const items = formItems.split("\n").map(s => s.trim()).filter(Boolean);
    if (!formWeek || !formTitle || items.length === 0) return;
    const { data, error } = await supabase
      .from("updates")
      .insert({ week: formWeek, title: formTitle, items })
      .select()
      .single();
    if (!error && data) {
      const next = [data, ...updates];
      setUpdates(next);
      setExpanded(data.id);
      setFormWeek("");
      setFormTitle("");
      setFormItems("");
      setShowForm(false);
    }
  }

  async function deleteUpdate(id: string) {
    await supabase.from("updates").delete().eq("id", id);
    setUpdates(prev => prev.filter(u => u.id !== id));
  }

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", fontFamily: "-apple-system,'Inter',sans-serif", color: "#0f172a" }}>
      <div className="max-w-2xl mx-auto px-5 py-16">

        <div className="mb-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: "#94a3b8" }}>TerraLot · Haftalık Güncellemeler</p>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "#0f172a" }}>Bu hafta neler yaptık?</h1>
              <p className="text-sm mt-2" style={{ color: "#64748b" }}>Her hafta ne tamamlandı, ne devam ediyor — kısa ve net.</p>
            </div>
            <button
              onClick={() => isAdminMode ? setIsAdminMode(false) : setShowPinModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all mt-1"
              style={{
                background: isAdminMode ? "#f0fdf4" : "#f8fafc",
                borderColor: isAdminMode ? "#bbf7d0" : "#e2e8f0",
                color: isAdminMode ? "#16a34a" : "#94a3b8",
              }}>
              <Lock className="w-3 h-3" />
              {isAdminMode ? "Admin modu" : "Giriş yap"}
            </button>
          </div>

          {isAdminMode && (
            <div className="mt-4">
              <button onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#0f172a", color: "#ffffff" }}>
                <Plus className="w-4 h-4" /> Yeni hafta ekle
              </button>

              {showForm && (
                <div className="mt-4 p-5 rounded-2xl border space-y-3" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                  <input className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                    style={{ borderColor: "#e2e8f0", background: "#ffffff", color: "#0f172a" }}
                    placeholder="Hafta (örn: 9–13 Haziran 2026)"
                    value={formWeek} onChange={e => setFormWeek(e.target.value)} />
                  <input className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                    style={{ borderColor: "#e2e8f0", background: "#ffffff", color: "#0f172a" }}
                    placeholder="Başlık (örn: Scraper altyapısı tamamlandı)"
                    value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                  <textarea className="w-full text-sm px-3 py-2 rounded-xl border outline-none resize-none"
                    style={{ borderColor: "#e2e8f0", background: "#ffffff", color: "#0f172a", minHeight: "120px" }}
                    placeholder={"Her satır bir madde:\nZillow scraper yazıldı\nFEMA flood checker tamamlandı"}
                    value={formItems} onChange={e => setFormItems(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={addUpdate}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: "#0f172a", color: "#ffffff" }}>Kaydet</button>
                    <button onClick={() => setShowForm(false)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border"
                      style={{ borderColor: "#e2e8f0", color: "#64748b" }}>İptal</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: "#94a3b8" }}>Yükleniyor...</div>
        ) : updates.length === 0 ? (
          <div className="text-center py-20" style={{ color: "#94a3b8" }}>Henüz güncelleme yok.</div>
        ) : (
          <div className="space-y-3">
            {updates.map((u, idx) => {
              const isOpen = expanded === u.id;
              const isLatest = idx === 0;
              return (
                <div key={u.id} className="rounded-2xl border overflow-hidden"
                  style={{ borderColor: isOpen ? "#cbd5e1" : "#e2e8f0", background: isOpen ? "#f8fafc" : "#fafafa" }}>
                  <button onClick={() => setExpanded(isOpen ? null : u.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left">
                    <CalendarDays className="w-4 h-4 shrink-0" style={{ color: "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLatest && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#16a34a" }}>
                            Son güncelleme
                          </span>
                        )}
                        <span className="text-[11px] font-semibold" style={{ color: "#94a3b8" }}>{u.week}</span>
                      </div>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "#0f172a" }}>{u.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAdminMode && (
                        <button onClick={e => { e.stopPropagation(); deleteUpdate(u.id); }}
                          className="p-1 rounded-lg" style={{ color: "#fca5a5" }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronDown className="w-4 h-4 transition-transform"
                        style={{ color: "#94a3b8", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5">
                      <ul className="space-y-2">
                        {u.items.map((item, i) => (
                          <li key={i} className="flex gap-3 items-start">
                            <span className="text-xs mt-1 shrink-0" style={{ color: "#22c55e" }}>✓</span>
                            <span className="text-sm" style={{ color: "#475569" }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs mt-12" style={{ color: "#cbd5e1" }}>
          TerraLot · {new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
        </p>
      </div>

      {showPinModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="p-6 rounded-2xl w-72" style={{ background: "#ffffff", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <p className="text-sm font-bold mb-1" style={{ color: "#0f172a" }}>Admin girişi</p>
            <p className="text-xs mb-4" style={{ color: "#94a3b8" }}>PIN kodu girin</p>
            <input type="password"
              className="w-full text-sm px-3 py-2 rounded-xl border outline-none mb-2 text-center tracking-widest"
              style={{ borderColor: pinError ? "#fca5a5" : "#e2e8f0", background: "#f8fafc", color: "#0f172a" }}
              placeholder="••••" value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false); }}
              onKeyDown={e => { if (e.key === "Enter") tryLogin(); }} autoFocus />
            {pinError && <p className="text-xs text-center mb-2" style={{ color: "#ef4444" }}>Yanlış PIN</p>}
            <div className="flex gap-2">
              <button onClick={tryLogin} className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#0f172a", color: "#ffffff" }}>Giriş</button>
              <button onClick={() => { setShowPinModal(false); setPinInput(""); setPinError(false); }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold border"
                style={{ borderColor: "#e2e8f0", color: "#64748b" }}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
