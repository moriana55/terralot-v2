"use client";

import { useState } from "react";
import { X, CheckCircle2, Loader2, ClipboardCheck, ShieldCheck, Lock, Sparkles, Check } from "lucide-react";
import type { Property } from "@/lib/data";

interface ReserveModalProps {
  property: Property;
  onClose: () => void;
}

type Step = "contact" | "terms" | "pledge" | "success";

// Rezervasyon isteği /api/inquiries'e kalıcı olarak yazılır (admin "Alıcı
// Talepleri" bunu okur). Eski sürüm /api/checkout'a gidiyordu ama o endpoint
// Stripe gelene kadar PARK halinde ve HİÇBİR ŞEY kaydetmiyordu → müşteri
// "onaylandı" görüyor, lead kayboluyordu. Ayrıca "15 dakika içinde aranırsınız",
// "deeds department kontrol ediyor", "%0 faiz" gibi tutulamayacak/yanlış
// vaatler dürüst kopya ile değiştirildi.
export default function ReserveModal({ property, onClose }: ReserveModalProps) {
  const [step, setStep] = useState<Step>("contact");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    paymentOption: "financing", // "financing" | "cash"
    billingZip: "",
    agreeTerms: true,
    agreePledge: true,
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const cashPrice = Math.round(property.price * 0.9);
  const planLabel =
    form.paymentOption === "financing"
      ? `Owner financing — $${property.downPayment.toLocaleString()} down + $${property.monthlyPayment.toLocaleString()}/mo (${property.interestRate}% APR, ${property.term} mo)`
      : `Cash purchase — $${cashPrice.toLocaleString()} (10% discount)`;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "contact") setStep("terms");
    else if (step === "terms") setStep("pledge");
  };

  const handleBack = () => {
    if (step === "terms") setStep("contact");
    else if (step === "pledge") setStep("terms");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          propertyTitle: property.title,
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: `RESERVATION REQUEST — ${planLabel}${form.billingZip ? ` | ZIP: ${form.billingZip}` : ""} | APN: ${property.apn}`,
        }),
      });

      if (!res.ok) throw new Error();
      setStatus("success");
      setStep("success");
    } catch {
      setStatus("error");
    }
  };

  if (step === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
        <div className="relative rounded-xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto text-center border border-slate-200 shadow-2xl bg-white" onClick={e => e.stopPropagation()}>
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>

          <h3 className="text-2xl font-extrabold mb-3 text-[var(--foreground)]">
            Reservation Request Received
          </h3>
          <p className="text-sm font-bold mb-2 text-[var(--secondary)]">
            No payment was collected — your card was never asked for.
          </p>

          <div className="rounded p-4 my-6 text-left border border-slate-200 space-y-2.5 bg-slate-50">
            <div className="flex justify-between gap-3 text-xs border-b border-slate-100 pb-1.5">
              <span className="text-[var(--muted)] font-semibold shrink-0">Property:</span>
              <span className="font-bold text-[var(--foreground)] text-right">{property.title}</span>
            </div>
            <div className="flex justify-between gap-3 text-xs border-b border-slate-100 pb-1.5">
              <span className="text-[var(--muted)] font-semibold shrink-0">Plan:</span>
              <span className="font-bold text-[var(--foreground)] text-right">
                {form.paymentOption === "financing"
                  ? `$${property.downPayment.toLocaleString()} down + $${property.monthlyPayment.toLocaleString()}/mo`
                  : `$${cashPrice.toLocaleString()} cash`}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs border-b border-slate-100 pb-1.5">
              <span className="text-[var(--muted)] font-semibold shrink-0">Your Email:</span>
              <span className="font-bold text-[var(--foreground)] text-right break-all">{form.email}</span>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-[var(--muted)] font-semibold shrink-0">Status:</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Request received
              </span>
            </div>
          </div>

          <p className="text-xs leading-relaxed mb-6 text-[var(--muted)]">
            We&apos;ll verify availability for APN{" "}
            <code className="bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-mono text-[var(--foreground)]">{property.apn}</code>{" "}
            and contact you at <strong>{form.phone || form.email}</strong> within 1 business day with the
            purchase agreement and next steps. Questions in the meantime?{" "}
            <a href="mailto:hello@terralot.com" className="font-semibold text-[var(--secondary)] hover:underline">hello@terralot.com</a>
          </p>

          <button onClick={onClose} className="w-full h-11 rounded text-sm font-semibold transition-all hover:opacity-90 bg-[var(--primary)] text-white shadow-md">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl bg-white" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded flex items-center justify-center bg-slate-100 border border-slate-200">
              <ClipboardCheck className="w-5 h-5 text-[var(--secondary)]" />
            </div>
            <div className="text-left min-w-0">
              <h3 className="text-base font-bold text-[var(--foreground)]">Reserve This Property</h3>
              <p className="text-xs mt-0.5 text-[var(--muted)] truncate">{property.title} — APN: {property.apn}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 shrink-0 rounded flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
            <X className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center gap-2 text-xs bg-slate-50/50" style={{ color: "var(--muted)" }}>
          <span className={step === "contact" ? "text-[var(--secondary)] font-bold" : ""}>1. Contact</span>
          <span className="opacity-20">&mdash;</span>
          <span className={step === "terms" ? "text-[var(--secondary)] font-bold" : ""}>2. Payment Plan</span>
          <span className="opacity-20">&mdash;</span>
          <span className={step === "pledge" ? "text-[var(--secondary)] font-bold" : ""}>3. Confirm</span>
        </div>

        {/* Form Body */}
        <div className="p-6">

          {/* Step 1: Contact Details */}
          {step === "contact" && (
            <form onSubmit={handleNext} className="space-y-4 text-left">
              <div className="text-xs rounded p-3.5 border border-slate-200 flex gap-2.5 items-start mb-2 bg-slate-50">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[var(--secondary)]" />
                <p className="text-[var(--muted)]">
                  Reserving is free and takes a minute. <strong>No payment is collected online</strong> — we&apos;ll
                  confirm availability and send you the purchase agreement first.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-[var(--muted)]">Full Name *</label>
                <input required type="text" placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-11 px-3.5 rounded text-sm border border-slate-200 bg-white text-[var(--foreground)] focus:border-[var(--secondary)]/50 focus:outline-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--muted)]">Email Address *</label>
                  <input required type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full h-11 px-3.5 rounded text-sm border border-slate-200 bg-white text-[var(--foreground)] focus:border-[var(--secondary)]/50 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-[var(--muted)]">Phone Number *</label>
                  <input required type="tel" placeholder="(555) 000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full h-11 px-3.5 rounded text-sm border border-slate-200 bg-white text-[var(--foreground)] focus:border-[var(--secondary)]/50 focus:outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full h-11 rounded flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:opacity-90 mt-6 bg-[var(--primary)] text-white shadow-md">
                Next: Choose Payment Plan
              </button>
            </form>
          )}

          {/* Step 2: Payment Plan Selection */}
          {step === "terms" && (
            <form onSubmit={handleNext} className="space-y-5 text-left">
              <div className="text-xs text-[var(--muted)]">
                Choose how you&apos;d like to pay. Owner financing is approved without a credit check.
              </div>

              {/* Option A: Installment Owner Financing */}
              <label className={`block rounded border p-4 cursor-pointer transition-all ${form.paymentOption === "financing" ? "border-[var(--secondary)] bg-[var(--secondary)]/5" : "border-slate-200 hover:bg-slate-50 bg-white"}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div className="flex gap-3">
                    <input type="radio" name="paymentOption" value="financing" checked={form.paymentOption === "financing"} onChange={() => setForm({ ...form, paymentOption: "financing" })} className="mt-1 accent-[var(--secondary)]" />
                    <div>
                      <h4 className="text-sm font-bold text-[var(--foreground)]">Owner Financing Plan</h4>
                      <p className="text-xs mt-1 text-[var(--muted)]">
                        <strong>${property.downPayment.toLocaleString()}</strong> down, then{" "}
                        <strong>${property.monthlyPayment.toLocaleString()}/mo</strong> for {property.term} months
                        at {property.interestRate}% APR. No credit check.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[var(--secondary)] shrink-0">${property.downPayment.toLocaleString()} down</span>
                </div>
              </label>

              {/* Option B: One-Time Discounted Cash Purchase */}
              <label className={`block rounded border p-4 cursor-pointer transition-all ${form.paymentOption === "cash" ? "border-[var(--secondary)] bg-[var(--secondary)]/5" : "border-slate-200 hover:bg-slate-50 bg-white"}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div className="flex gap-3">
                    <input type="radio" name="paymentOption" value="cash" checked={form.paymentOption === "cash"} onChange={() => setForm({ ...form, paymentOption: "cash" })} className="mt-1 accent-[var(--secondary)]" />
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-1.5 flex-wrap text-[var(--foreground)]">
                        One-Time Cash Purchase <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Save 10%</span>
                      </h4>
                      <p className="text-xs mt-1 text-[var(--muted)]">
                        Pay in full and the price drops from ${property.price.toLocaleString()} to{" "}
                        <strong>${cashPrice.toLocaleString()}</strong>.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 shrink-0">${cashPrice.toLocaleString()}</span>
                </div>
              </label>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={handleBack} className="h-11 px-6 rounded text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50 transition-colors">
                  Back
                </button>
                <button type="submit" className="flex-1 h-11 rounded flex items-center justify-center text-sm font-semibold transition-all hover:opacity-90 bg-[var(--primary)] text-white shadow-md">
                  Next: Confirm Request
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Confirmation (kart YOK, sadece niyet + iletişim onayı) */}
          {step === "pledge" && (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="rounded p-3.5 border border-amber-200 text-xs flex gap-2.5 items-start bg-amber-50">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-800">No card required</p>
                  <p className="mt-1 text-[var(--muted)]">
                    We don&apos;t collect any payment details today. Submitting this request asks our team to
                    hold the parcel while we prepare your purchase agreement.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-[var(--muted)]">ZIP Code (used on the purchase agreement) *</label>
                <input required type="text" inputMode="numeric" placeholder="90210" value={form.billingZip} onChange={e => setForm({ ...form, billingZip: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  className="w-full h-11 px-3.5 rounded text-sm border border-slate-200 bg-white text-[var(--foreground)] focus:border-[var(--secondary)]/50 focus:outline-none" />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" required checked={form.agreePledge} onChange={e => setForm({ ...form, agreePledge: e.target.checked })} className="mt-1 accent-[var(--secondary)]" />
                  <span className="text-xs text-[var(--muted)]">
                    I intend to purchase this property for{" "}
                    <strong>{form.paymentOption === "financing" ? `$${property.downPayment.toLocaleString()} down + $${property.monthlyPayment.toLocaleString()}/mo` : `$${cashPrice.toLocaleString()} cash`}</strong>{" "}
                    and would like to receive the purchase agreement.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" required checked={form.agreeTerms} onChange={e => setForm({ ...form, agreeTerms: e.target.checked })} className="mt-1 accent-[var(--secondary)]" />
                  <span className="text-xs text-[var(--muted)]">
                    My contact details are accurate and TerraLot may contact me about this parcel.
                  </span>
                </label>
              </div>

              {status === "error" && (
                <div className="text-xs text-[var(--error)]">
                  We couldn&apos;t submit your request. Please try again, or email us directly at{" "}
                  <a href={`mailto:hello@terralot.com?subject=${encodeURIComponent(`Reservation request: ${property.title} (APN ${property.apn})`)}`} className="font-semibold underline">hello@terralot.com</a>.
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={handleBack} disabled={status === "submitting"} className="h-11 px-6 rounded text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Back
                </button>
                <button type="submit" disabled={status === "submitting"}
                  className="flex-1 h-11 rounded flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60 bg-[var(--primary)] text-white shadow-md">
                  {status === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {status === "submitting" ? "Submitting..." : "Submit Reservation Request"}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
