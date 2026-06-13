"use client";

import { Mail, Send, Eye, Plus, FileText } from "lucide-react";
import { campaigns, mailPieces, getMailerStats, MAIL_TYPE_LABELS, MAIL_STATUS_LABELS, CAMPAIGN_STATUS_LABELS, getCampaignStatusColor, getMailStatusColor, getCampaignPieces, LETTER_TEMPLATES } from "@/lib/mailer-data";
import type { CampaignStatus } from "@/lib/mailer-data";
import { useState } from "react";

export default function MailerPage() {
  const stats = getMailerStats();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

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
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: "var(--primary)", color: "var(--background)" }}>
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => { setShowTemplates(false); setPreviewTemplate(null); }}>
          <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 p-6 mx-4"
            style={{ background: "var(--surface)" }}
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Letter Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LETTER_TEMPLATES.map(tpl => (
                <div key={tpl.id}
                  className="rounded-xl border p-4 cursor-pointer transition-colors hover:border-white/20"
                  style={{
                    background: previewTemplate === tpl.id ? "rgba(142,209,223,0.05)" : "rgba(255,255,255,0.02)",
                    borderColor: previewTemplate === tpl.id ? "rgba(142,209,223,0.3)" : "rgba(255,255,255,0.05)",
                  }}
                  onClick={(e) => { e.stopPropagation(); setPreviewTemplate(tpl.id); }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ background: "rgba(142,209,223,0.1)", color: "var(--primary)" }}>
                      {MAIL_TYPE_LABELS[tpl.type]}
                    </span>
                    <Eye className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
                  </div>
                  <p className="text-sm font-semibold mb-2">{tpl.name}</p>
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap p-3 rounded-lg"
                    style={{ background: "rgba(255,255,200,0.03)", color: "var(--muted)", fontFamily: "inherit" }}>
                    {tpl.preview}
                  </pre>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowTemplates(false); setPreviewTemplate(null); }}
              className="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold border border-white/10 transition-colors hover:bg-white/[0.02]"
              style={{ color: "var(--muted)" }}>
              Close
            </button>
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
                  className="w-full px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                  style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                <input type="text" placeholder="Street Address"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                  style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="City"
                    className="px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                    style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                  <input type="text" placeholder="State"
                    className="px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                    style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                  <input type="text" placeholder="ZIP"
                    className="px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none focus:border-[var(--primary)]"
                    style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }} />
                </div>
                <select className="w-full px-3 py-2.5 rounded-lg text-sm border border-white/10 outline-none"
                  style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground)" }}>
                  <option value="">Select Template</option>
                  {LETTER_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: "var(--primary)", color: "var(--background)" }}>
                  <Mail className="w-4 h-4" /> Send via Lob
                </button>
                <p className="text-[10px] text-center" style={{ color: "var(--muted)" }}>
                  Requires LOB_API_KEY in .env
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
