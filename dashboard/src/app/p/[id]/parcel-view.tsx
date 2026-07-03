"use client";

// Buyer-facing sales view for /p/[id]. English, mobile-first, dark premium —
// satellite imagery reads best on a dark ground. Receives ONLY the
// BuyerParcel whitelist from the server component (no internal deal fields
// ever reach this bundle).

import { useMemo, useRef, useState } from "react";
import {
  CalendarClock, Check, ExternalLink, Landmark, Loader2, MapPin, Mountain,
  Ruler, Send, Wallet,
} from "lucide-react";
import type { BuyerParcel } from "@/lib/buyer-parcel";
import { installmentPlan } from "@/lib/buyer-parcel";
import { esriStaticUrl, parcelPadMeters } from "@/lib/esri-static";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function ParcelView({
  parcel, title, contactWhatsApp, contactEmail,
}: {
  parcel: BuyerParcel;
  title: string;
  contactWhatsApp: string; // digits, e.g. "15551234567" — hidden if empty
  contactEmail: string;    // hidden if empty
}) {
  const p = parcel;
  const hasGeo = p.lat != null && p.lng != null;
  const loc = [p.county && `${p.county} County`, p.state].filter(Boolean).join(", ");
  const mapsUrl = hasGeo
    ? `https://www.google.com/maps/place/${p.lat},${p.lng}/@${p.lat},${p.lng},900m/data=!3m1!1e3`
    : "";

  // ── Installment calculator (the star) ──
  const maxDown = Math.max(100, Math.min(p.price, 5000));
  const [down, setDown] = useState(Math.min(500, maxDown));
  const [monthly, setMonthly] = useState(199);
  const plan = useMemo(() => installmentPlan(p.price, down, monthly), [p.price, down, monthly]);
  const years = plan.months > 0 ? (plan.months / 12).toFixed(1) : null;

  const formRef = useRef<HTMLDivElement>(null);
  const [prefill, setPrefill] = useState("");
  const reserve = () => {
    setPrefill(
      `Hi! I'd like to reserve this parcel (${title}) with ${usd(plan.down)} down and about ${usd(plan.monthly)}/month. Please contact me.`
    );
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const waText = encodeURIComponent(`Hi! I'm interested in this land: ${title} (ref ${p.id}).`);
  const waHref = contactWhatsApp ? `https://wa.me/${contactWhatsApp.replace(/[^\d]/g, "")}?text=${waText}` : "";
  const mailHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(`Land inquiry — ${title}`)}&body=${waText}`
    : "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── HERO: satellite image ── */}
      <header className="relative">
        {hasGeo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={esriStaticUrl(p.lat!, p.lng!, parcelPadMeters(p.acres) * 2.2, 1280, 840)}
            alt={`Satellite view of ${title}`}
            className="h-[46vh] min-h-[300px] w-full object-cover sm:h-[54vh]"
          />
        ) : (
          <div className="flex h-[36vh] min-h-[240px] w-full items-center justify-center bg-gradient-to-b from-slate-800 to-slate-950">
            <Mountain className="h-16 w-16 text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-slate-950/60" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 sm:px-8">
          <div className="text-lg font-extrabold tracking-tight">
            Terra<span className="text-emerald-400">Lot</span>
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-300">Land</span>
          </div>
          {p.price > 0 && (
            <div className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-slate-950 backdrop-blur">
              Owner financing available
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-5 sm:px-8 sm:pb-8">
          <div className="mx-auto max-w-3xl">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
              <MapPin className="h-3.5 w-3.5" /> {loc || "United States"}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
              {p.acres.toFixed(2)} Acres{p.region && p.region !== p.county ? ` · ${p.region}` : ""}
            </h1>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
              {p.price > 0 ? (
                <>
                  <span className="text-3xl font-extrabold text-emerald-400 sm:text-4xl">{usd(p.price)}</span>
                  <span className="pb-1 text-sm text-slate-300">
                    or from <b className="text-white">{usd(plan.monthly)}/mo</b> with {usd(plan.down)} down
                  </span>
                </>
              ) : (
                <span className="text-2xl font-bold text-emerald-400">Contact us for pricing</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-8">
        {/* ── INSTALLMENT CALCULATOR ── */}
        {p.price > 0 && (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Wallet className="h-5 w-5 text-emerald-400" /> Build your payment plan
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              0% interest · no credit check · no prepayment penalty. Slide to fit your budget.
            </p>

            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <label htmlFor="down" className="font-semibold text-slate-300">Down payment</label>
                  <span className="text-lg font-extrabold text-emerald-400">{usd(plan.down)}</span>
                </div>
                <input
                  id="down" type="range" min={100} max={maxDown} step={50} value={Math.min(down, maxDown)}
                  onChange={(e) => setDown(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-500"
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <label htmlFor="monthly" className="font-semibold text-slate-300">Monthly payment</label>
                  <span className="text-lg font-extrabold text-emerald-400">{usd(plan.monthly)}/mo</span>
                </div>
                <input
                  id="monthly" type="range" min={50} max={1000} step={10} value={monthly}
                  onChange={(e) => setMonthly(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-500"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 divide-x divide-slate-800 rounded-xl bg-slate-950/70 py-3 text-center">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Term</div>
                <div className="mt-0.5 text-xl font-extrabold">{plan.months}<span className="text-sm font-semibold text-slate-400"> mo</span></div>
                {years && <div className="text-[10px] text-slate-500">≈ {years} yrs</div>}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total paid</div>
                <div className="mt-0.5 text-xl font-extrabold">{usd(plan.total)}</div>
                <div className="text-[10px] text-emerald-500">= cash price, 0% interest</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">You own it</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-xl font-extrabold">
                  <CalendarClock className="h-4 w-4 text-emerald-400" />
                  {plan.months > 0 ? `${new Date(Date.now() + plan.months * 30.44 * 864e5).getFullYear()}` : "today"}
                </div>
                <div className="text-[10px] text-slate-500">deed at payoff</div>
              </div>
            </div>

            <button
              onClick={reserve}
              className="mt-5 w-full rounded-xl bg-emerald-500 px-5 py-3.5 text-base font-bold text-slate-950 transition hover:bg-emerald-400"
            >
              Reserve with {usd(plan.down)} down →
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              No obligation — send an inquiry and we&apos;ll hold it while we talk. Cash price also available: {usd(p.price)}.
            </p>
          </section>
        )}

        {/* ── FACTS GRID ── */}
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Landmark className="h-5 w-5 text-emerald-400" /> Property facts
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 text-sm sm:grid-cols-2">
            {[
              ["APN / Parcel number", p.apn || "Ask us"],
              ["Size", `${p.acres.toFixed(2)} acres (≈ ${Math.round(p.acres * 43560).toLocaleString("en-US")} sq ft)`],
              ["County", p.county ? `${p.county} County` : "—"],
              ["State", p.state || "—"],
              ...(p.region && p.region !== p.county ? [["Area", p.region] as const] : []),
              ...(p.address ? [["Location / address", p.address] as const] : [["Address", "No situs address — raw undeveloped land"] as const]),
              ["Access", "Dirt / county road area — verify legal access with the county before building"],
              ["Coordinates", hasGeo ? `${p.lat!.toFixed(5)}, ${p.lng!.toFixed(5)}` : "Available on request"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 bg-slate-900 px-4 py-3">
                <dt className="flex items-center gap-1.5 text-slate-400"><Ruler className="hidden h-3.5 w-3.5 shrink-0 sm:block" />{k}</dt>
                <dd className="text-right font-semibold text-slate-100">{v}</dd>
              </div>
            ))}
          </dl>
          {hasGeo && (
            <a
              href={mapsUrl} target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-emerald-400 transition hover:border-emerald-500"
            >
              <ExternalLink className="h-4 w-4" /> Open in Google Maps (satellite)
            </a>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Sold as-is, where-is. Boundaries shown are approximate — final legal description comes from the
            county record and your purchase agreement. Buyer to verify zoning, utilities, and intended use.
            Prefer to pay cash? The sticker price above <em>is</em> the discounted cash price.
          </p>
        </section>

        {/* ── WIDE AREA VIEW ── */}
        {hasGeo && (
          <section className="mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={esriStaticUrl(p.lat!, p.lng!, 8000, 1280, 560)}
              alt={`Regional satellite view around the parcel (~10 mi)`}
              className="h-52 w-full rounded-2xl border border-slate-800 object-cover sm:h-64"
              loading="lazy"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">Regional view — roughly 10 miles across. Parcel sits at the center.</p>
          </section>
        )}

        {/* ── INQUIRY FORM ── */}
        <div ref={formRef} className="scroll-mt-4">
          <InquiryForm
            parcel={p}
            parcelTitle={title}
            prefill={prefill}
            waHref={waHref}
            mailHref={mailHref}
          />
        </div>

        <footer className="mt-10 border-t border-slate-800 pt-5 text-center text-[11px] leading-relaxed text-slate-600">
          <div className="text-sm font-bold text-slate-400">Terra<span className="text-emerald-500">Lot</span> Land</div>
          <p className="mt-1">
            Ref {p.id}. This page is for information only and is not a formal offer or appraisal.
            All sales subject to a written purchase agreement.
          </p>
        </footer>
      </main>
    </div>
  );
}

// ── Inquiry form: POST /api/parcel-inquiries; on hard failure fall back to
//    WhatsApp / email deep links (when configured) so the lead is never lost. ──
function InquiryForm({
  parcel, parcelTitle, prefill, waHref, mailHref,
}: {
  parcel: BuyerParcel;
  parcelTitle: string;
  prefill: string;
  waHref: string;
  mailHref: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  // "Reserve" CTA'dan gelen hazır mesaj — kullanıcı yazmaya başlamadıysa uygula.
  const effectiveMessage = message || prefill;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hp) return; // bot
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      setError("Please add your name and at least an email or phone number.");
      setState("error");
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/parcel-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelId: parcel.id,
          parcelTitle,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          message: effectiveMessage.trim(),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.error || `HTTP ${res.status}`);
      setState("sent");
    } catch (err) {
      setError(err instanceof Error && err.message === "rate_limited"
        ? "Too many requests — please wait a minute and try again."
        : "Couldn't send right now.");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <section className="mt-6 rounded-2xl border border-emerald-700/50 bg-emerald-950/40 p-6 text-center">
        <Check className="mx-auto h-10 w-10 rounded-full bg-emerald-500 p-2 text-slate-950" />
        <h2 className="mt-3 text-xl font-bold text-emerald-300">Inquiry sent!</h2>
        <p className="mt-1 text-sm text-slate-300">
          Thanks {name.split(" ")[0] || ""} — we&apos;ll get back to you within one business day.
        </p>
        {waHref && (
          <a href={waHref} target="_blank" rel="noreferrer"
            className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
            Chat on WhatsApp instead
          </a>
        )}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Send className="h-5 w-5 text-emerald-400" /> Ask about this land
      </h2>
      <p className="mt-1 text-sm text-slate-400">Questions, an offer, or a payment plan that fits you — we reply fast.</p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {/* Honeypot — hidden from humans */}
        <input
          type="text" value={hp} onChange={(e) => setHp(e.target.value)}
          name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        <input
          type="text" placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)}
          maxLength={100} required
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <textarea
          placeholder="Message (optional)" value={effectiveMessage} onChange={(e) => setMessage(e.target.value)}
          maxLength={2000} rows={4}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        {state === "error" && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-3.5 py-2.5 text-sm text-red-300">
            {error}
            {(waHref || mailHref) && (
              <span> Reach us directly instead:</span>
            )}
            {(waHref || mailHref) && (
              <span className="mt-2 flex flex-wrap gap-2">
                {waHref && (
                  <a href={waHref} target="_blank" rel="noreferrer"
                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
                    WhatsApp us
                  </a>
                )}
                {mailHref && (
                  <a href={mailHref}
                    className="rounded bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-600">
                    Email us
                  </a>
                )}
              </span>
            )}
          </div>
        )}
        <button
          type="submit" disabled={state === "sending"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-base font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send inquiry
        </button>
        <p className="text-center text-[11px] text-slate-500">
          We only use your contact info to reply about this property. No spam, ever.
        </p>
      </form>
      {(waHref || mailHref) && state !== "error" && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
          Prefer to talk now?
          {waHref && (
            <a href={waHref} target="_blank" rel="noreferrer" className="font-bold text-emerald-400 hover:underline">WhatsApp</a>
          )}
          {waHref && mailHref && <span>·</span>}
          {mailHref && <a href={mailHref} className="font-bold text-emerald-400 hover:underline">Email</a>}
        </div>
      )}
    </section>
  );
}
