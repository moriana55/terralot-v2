"use client";

import { Mail, Send, Eye, Plus, FileText, Loader2 } from "lucide-react";
import { campaigns, mailPieces, getMailerStats, MAIL_TYPE_LABELS, MAIL_STATUS_LABELS, CAMPAIGN_STATUS_LABELS, getCampaignStatusColor, getMailStatusColor, getCampaignPieces, LETTER_TEMPLATES } from "@/lib/mailer-data";
import type { CampaignStatus } from "@/lib/mailer-data";
import { useState } from "react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

export default function MailerPage() {
  const stats = getMailerStats();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  // Quick Send Form States
  const [recipientName, setRecipientName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zip, setZip] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("tpl1");
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<any>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleQuickSend() {
    if (!recipientName || !streetAddress || !city || !stateCode || !zip || !selectedTemplate) {
      setSendError("Please fill out all fields.");
      return;
    }
    setSending(true);
    setSendError(null);
    setSentResult(null);

    const templateData = LETTER_TEMPLATES.find(t => t.id === selectedTemplate);
    const action = templateData?.type === "postcard" ? "send_postcard" : "send_letter";

    try {
      const res = await fetch("/api/lob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          to: {
            name: recipientName,
            address_line1: streetAddress,
            city,
            state: stateCode,
            zip,
          },
          from: {
            name: "TerraLot Acquisitions",
            address_line1: "1234 Main St",
            city: "Austin",
            state: "TX",
            zip: "78701",
          },
          template: templateData?.preview || "",
          merge_variables: {
            owner_name: recipientName,
            county: "Mohave",
            state: stateCode,
            address: streetAddress,
            apn: "301-42-0180",
            offer_amount: "15000",
          }
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSentResult(data);
      } else {
        throw new Error(data.error || "Failed to send mail piece via Lob.");
      }
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  }


  const selected = selectedCampaign ? campaigns.find(c => c.id === selectedCampaign) : null;
  const pieces = selectedCampaign ? getCampaignPieces(selectedCampaign) : [];
  const template = previewTemplate ? LETTER_TEMPLATES.find(t => t.id === previewTemplate) : null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">Direct Mail</h1>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ background: "rgba(142,209,223,0.1)", color: "var(--primary)" }}>
              Lob
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Send physical letters & postcards to land owners via Lob API</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-white/10 transition-colors hover:bg-white/[0.02]"
            style={{ color: "var(--muted)" }}>
            <FileText className="w-4 h-4" /> Templates
          </button>
          <button disabled title="Yakında" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold opacity-50 cursor-not-allowed"
            style={{ background: "var(--primary)", color: "var(--background)" }}>
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>
      </div>

      <SampleDataBanner note="Kampanya istatistikleri örnektir. Hızlı Gönderim, LOB_API_KEY tanımlıysa gerçek gönderir; aksi halde sandbox modunda çalışır." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Sent", value: stats.totalSent.toLocaleString(), sub: `${stats.totalDelivered} delivered`, color: "var(--primary)" },
          { label: "Responses", value: stats.totalResponded, sub: `${stats.responseRate}% response rate`, color: "var(--success)" },
          { label: "Total Spent", value: `$${stats.totalSpent.toLocaleString()}`, sub: `$${stats.costPerResponse}/response`, color: "var(--tertiary)" },
          { label: "Active Campaigns", value: stats.activeCampaigns, sub: `${stats.totalCampaigns} total`, color: "var(--secondary)" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Template Preview Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => { setShowTemplates(false); setPreviewTemplate(null); }}>
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 p-6 mx-4 flex flex-col md:flex-row gap-6"
            style={{ background: "var(--surface)" }}
            onClick={e => e.stopPropagation()}>
            
            {/* Left Column: Template List */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold">Select Template to Preview</h2>
                <button onClick={() => { setShowTemplates(false); setPreviewTemplate(null); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 transition-colors hover:bg-white/[0.02]"
                  style={{ color: "var(--muted)" }}>
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2">
                {LETTER_TEMPLATES.map(tpl => (
                  <div key={tpl.id}
                    className="rounded-xl border p-4 cursor-pointer transition-all hover:border-[var(--primary)]/40"
                    style={{
                      background: previewTemplate === tpl.id ? "rgba(142,209,223,0.05)" : "rgba(255,255,255,0.01)",
                      borderColor: previewTemplate === tpl.id ? "rgba(142,209,223,0.4)" : "rgba(255,255,255,0.05)",
                    }}
                    onClick={() => setPreviewTemplate(tpl.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                        style={{ background: "rgba(142,209,223,0.1)", color: "var(--primary)" }}>
                        {MAIL_TYPE_LABELS[tpl.type]}
                      </span>
                      {previewTemplate === tpl.id && <span className="text-[10px] text-emerald-500 font-bold">Active Preview</span>}
                    </div>
                    <p className="text-sm font-semibold">{tpl.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Visual Paper Mockup */}
            <div className="flex-1 rounded-xl p-4 flex flex-col items-center justify-center min-h-[400px]"
              style={{ background: "var(--surface-low)" }}>
              {previewTemplate ? (() => {
                const tpl = LETTER_TEMPLATES.find(t => t.id === previewTemplate)!;
                const mockContent = tpl.preview
                  .replace(/\{\{owner_name\}\}/g, recipientName || "John Doe")
                  .replace(/\{\{county\}\}/g, "Mohave")
                  .replace(/\{\{state\}\}/g, stateCode || "TX")
                  .replace(/\{\{address\}\}/g, streetAddress || "123 Main St")
                  .replace(/\{\{apn\}\}/g, "301-42-0180")
                  .replace(/\{\{offer_amount\}\}/g, "15,000");

                return (
                  <div className="w-full space-y-4">
                    <p className="text-xs text-center uppercase tracking-widest" style={{ color: "var(--muted)" }}>LOB API Live Mailpiece Preview</p>
                    <div className="bg-white text-stone-900 p-8 shadow-xl border border-stone-200 font-serif w-full max-w-md mx-auto rounded aspect-[1/1.4] flex flex-col justify-between" style={{ minHeight: "450px" }}>
                      <div>
                        {/* Letterhead */}
                        <div className="border-b border-stone-800 pb-3 mb-4 text-center">
                          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">TERRALOT ACQUISITIONS LLC</h2>
                          <p className="text-[8px] text-stone-500 font-sans uppercase">1234 Main St, Austin, TX 78701 | info@terralot.com</p>
                        </div>
                        
                        <div className="text-right text-[9px] text-stone-400 font-sans mb-3">
                          Date: {new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>

                        {/* Content */}
                        <div className="text-[10px] leading-relaxed whitespace-pre-wrap text-stone-800 font-serif">
                          {mockContent}
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-[8px] font-sans text-stone-400">
                        <span>LOB SECURE DOCUMENT ID: MOCK-DOC-PREVIEW</span>
                        <span>OFFICIAL TRANSACTION PROPOSAL</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="text-center space-y-2" style={{ color: "var(--muted)" }}>
                  <Eye className="w-8 h-8 mx-auto opacity-40 animate-pulse" />
                  <p className="text-xs">Click a template on the left to see live document styling</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaigns List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-bold">Campaigns</h2>
          <div className="space-y-3">
            {campaigns.map(c => {
              const progress = c.totalPieces > 0 ? (c.sentCount / c.totalPieces) * 100 : 0;
              const responseRate = c.sentCount > 0 ? ((c.respondedCount / c.sentCount) * 100).toFixed(1) : "0";
              const isSelected = selectedCampaign === c.id;

              return (
                <div key={c.id}
                  onClick={() => setSelectedCampaign(isSelected ? null : c.id)}
                  className="rounded-xl border p-5 cursor-pointer transition-colors hover:border-white/10"
                  style={{
                    background: "var(--surface)",
                    borderColor: isSelected ? "rgba(142,209,223,0.3)" : "rgba(255,255,255,0.05)",
                  }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold">{c.name}</h3>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                          style={{ background: `${getCampaignStatusColor(c.status)}15`, color: getCampaignStatusColor(c.status) }}>
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {MAIL_TYPE_LABELS[c.type]} · {c.targetState}{c.targetCounty ? `, ${c.targetCounty}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: "var(--success)" }}>{c.respondedCount} responses</p>
                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>{responseRate}% rate</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>{c.sentCount} / {c.totalPieces} sent</span>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>${(c.sentCount * c.costPerPiece).toFixed(0)} spent</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--primary)" }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px]">
                    <span style={{ color: "var(--primary)" }}>{c.sentCount} sent</span>
                    <span style={{ color: "var(--success)" }}>{c.deliveredCount} delivered</span>
                    <span style={{ color: "var(--tertiary)" }}>{c.totalPieces - c.sentCount} remaining</span>
                    <span className="ml-auto" style={{ color: "var(--muted)" }}>${c.costPerPiece}/piece</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Campaign Detail or Quick Send */}
        <div className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
                <h3 className="font-bold mb-3">{selected.name} — Mail Pieces</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {pieces.map(p => (
                    <div key={p.id} className="p-3 rounded-lg border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-xs font-semibold">{p.recipientName}</p>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                          style={{ background: `${getMailStatusColor(p.status)}15`, color: getMailStatusColor(p.status) }}>
                          {MAIL_STATUS_LABELS[p.status]}
                        </span>
                      </div>
                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                        {p.recipientAddress}, {p.recipientCity}, {p.recipientState} {p.recipientZip}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
                        {p.sentAt && <span>Sent: {p.sentAt}</span>}
                        {p.deliveredAt && <span style={{ color: "var(--success)" }}>Delivered: {p.deliveredAt}</span>}
                      </div>
                    </div>
                  ))}
                  {pieces.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: "var(--muted)" }}>No mail pieces yet</p>
                  )}
                </div>
              </div>

              {/* Campaign Stats */}
              <div className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Campaign Stats</h3>
                <div className="space-y-2">
                  {[
                    { label: "Delivery Rate", value: selected.sentCount > 0 ? `${((selected.deliveredCount / selected.sentCount) * 100).toFixed(1)}%` : "—", color: "var(--success)" },
                    { label: "Response Rate", value: selected.sentCount > 0 ? `${((selected.respondedCount / selected.sentCount) * 100).toFixed(1)}%` : "—", color: "var(--primary)" },
                    { label: "Cost Per Response", value: selected.respondedCount > 0 ? `$${((selected.sentCount * selected.costPerPiece) / selected.respondedCount).toFixed(2)}` : "—", color: "var(--tertiary)" },
                    { label: "Total Cost", value: `$${(selected.sentCount * selected.costPerPiece).toFixed(0)}`, color: "var(--muted)" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</span>
                      <span className="text-xs font-bold" style={{ color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Quick Send Card */
            <div className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(142,209,223,0.1)" }}>
                  <Send className="w-5 h-5" style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <h3 className="font-bold">Quick Send</h3>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Send a single mail piece</p>
                </div>
              </div>
              <div className="space-y-3">
                <input type="text" placeholder="Recipient Name"
                  value={recipientName} onChange={e => setRecipientName(e.target.value)} disabled={sending}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                  style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                <input type="text" placeholder="Street Address"
                  value={streetAddress} onChange={e => setStreetAddress(e.target.value)} disabled={sending}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                  style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="City"
                    value={city} onChange={e => setCity(e.target.value)} disabled={sending}
                    className="px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                    style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                  <input type="text" placeholder="State"
                    value={stateCode} onChange={e => setStateCode(e.target.value)} disabled={sending}
                    className="px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                    style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                  <input type="text" placeholder="ZIP"
                    value={zip} onChange={e => setZip(e.target.value)} disabled={sending}
                    className="px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                    style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                </div>
                <select className="w-full px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none animate-fadeIn"
                  value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} disabled={sending}
                  style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }}>
                  <option value="">Select Template</option>
                  {LETTER_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {sendError && (
                  <p className="text-xs text-red-500 font-semibold">{sendError}</p>
                )}

                {sentResult && (
                  <div className="p-3 rounded-lg border text-xs animate-fadeIn" style={{ background: "rgba(34,197,94,0.05)", borderColor: "rgba(34,197,94,0.2)" }}>
                    <p className="font-bold text-emerald-500 mb-1">Mail sent successfully!</p>
                    <p style={{ color: "var(--muted)" }}>ID: <span className="font-mono">{sentResult.id}</span></p>
                    <p style={{ color: "var(--muted)" }}>Est. Delivery: {sentResult.expected_delivery_date}</p>
                    {sentResult.url && (
                      <a href={sentResult.url} target="_blank" rel="noopener noreferrer"
                        className="inline-block mt-2 font-bold text-emerald-500 hover:underline">
                        View Generated PDF ↗
                      </a>
                    )}
                  </div>
                )}

                <button onClick={() => { if(selectedTemplate) { setPreviewTemplate(selectedTemplate); setShowTemplates(true); } }} disabled={!selectedTemplate}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border border-white/10 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  style={{ color: "var(--muted)", borderColor: "var(--outline)" }}>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Populated Offer</span>
                </button>

                <button onClick={handleQuickSend} disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer hover:opacity-90 active:scale-95"
                  style={{ background: "var(--primary)", color: "var(--background)" }}>
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send via Lob</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center" style={{ color: "var(--muted)" }}>
                  Requires LOB_API_KEY in env (Mock mode runs automatically)
                </p>
              </div>
            </div>
          )}

          {/* ROI Summary */}
          <div className="rounded-xl border border-white/5 p-5" style={{ background: "var(--surface)" }}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Mail ROI</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Delivery Rate</span>
                  <span className="text-xs font-bold" style={{ color: "var(--success)" }}>
                    {stats.totalSent > 0 ? `${((stats.totalDelivered / stats.totalSent) * 100).toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full" style={{ width: `${stats.totalSent > 0 ? (stats.totalDelivered / stats.totalSent) * 100 : 0}%`, background: "var(--success)" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Response Rate</span>
                  <span className="text-xs font-bold" style={{ color: "var(--primary)" }}>{stats.responseRate}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(stats.responseRate * 5, 100)}%`, background: "var(--primary)" }} />
                </div>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Cost per Response</span>
                <span className="text-sm font-bold" style={{ color: "var(--tertiary)" }}>${stats.costPerResponse}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
