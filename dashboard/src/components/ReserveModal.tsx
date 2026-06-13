"use client";

import { useState } from "react";
import { X, CheckCircle2, Loader2, ClipboardCheck, ShieldCheck, Lock, Sparkles, Check } from "lucide-react";
import type { Property } from "@/lib/data";

interface ReserveModalProps {
  property: Property;
  onClose: () => void;
}

type Step = "contact" | "terms" | "pledge" | "success";

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

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "contact") setStep("terms");
    else if (step === "terms") setStep("pledge");
  };

  const handleBack = () => {
    if (step === "terms") setStep("contact");
    else if (step === "pledge") setStep("terms");
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          propertyTitle: property.title,
          amount: form.paymentOption === "financing" ? property.downPayment : Math.round(property.price * 0.9),
          type: form.paymentOption === "financing" ? "DOWN_PAYMENT" : "CASH_FULL",
          buyerName: form.name,
          buyerEmail: form.email,
          buyerPhone: form.phone,
          cardName: "NO_CARD_SMOKE_TEST",
          cardNumber: "NO_CARD_VERIFIED_PLEDGE",
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
        <div className="relative rounded-xl p-8 max-w-lg w-full text-center border border-slate-200 shadow-2xl bg-white" onClick={e => e.stopPropagation()}>
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          
          <h3 className="text-2xl font-extrabold mb-3 text-[var(--foreground)]">
            Queue Request Confirmed! 🚀
          </h3>
          <p className="text-sm font-bold mb-2 text-[var(--secondary)]">
            Hold Period: 24 Hours Granted (No Payment Details Collected)
          </p>
          
          <div className="rounded p-4 my-6 text-left border border-slate-200 space-y-2.5 bg-slate-50">
            <div className="flex justify-between text-xs border-b border-slate-150 pb-1.5">
              <span className="text-[var(--muted)] font-semibold">Property:</span>
              <span className="font-bold text-[var(--foreground)]">{property.title}</span>
            </div>
            <div className="flex justify-between text-xs border-b border-slate-150 pb-1.5">
              <span className="text-[var(--muted)] font-semibold">Down Payment Pledge:</span>
              <span className="font-bold text-[var(--foreground)]">${property.downPayment} (To be paid on deed signing)</span>
            </div>
            <div className="flex justify-between text-xs border-b border-slate-150 pb-1.5">
              <span className="text-[var(--muted)] font-semibold">Your Email:</span>
              <span className="font-bold text-[var(--foreground)]">{form.email}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted)] font-semibold">Status:</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Queue Secured
              </span>
            </div>
          </div>

          <p className="text-xs leading-relaxed mb-6 text-[var(--muted)]">
            <strong>To prevent duplicate bookings</strong>, our county deeds department is checking legal indexes for APN: <code className="bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-mono text-[var(--foreground)]">{property.apn}</code>. 
            Our lead closing officer will contact you at <strong>{form.phone}</strong> within 15 minutes with the closing paperwork and official purchase agreement.
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
      <div className="relative rounded-xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden bg-white" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded flex items-center justify-center bg-slate-100 border border-slate-200">
              <ClipboardCheck className="w-5 h-5 text-[var(--secondary)]" />
            </div>
            <div className="text-left">
              <h3 className="text-base font-bold text-[var(--foreground)]">Secure Property Reservation Queue</h3>
              <p className="text-xs mt-0.5 text-[var(--muted)]">{property.title} — APN: {property.apn}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
            <X className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center text-xs bg-slate-50/50" style={{ color: "var(--muted)" }}>
          <span className={step === "contact" ? "text-[var(--secondary)] font-bold" : ""}>1. Contact Details</span>
          <span className="opacity-20">&mdash;</span>
          <span className={step === "terms" ? "text-[var(--secondary)] font-bold" : ""}>2. Plan & Financing</span>
          <span className="opacity-20">&mdash;</span>
          <span className={step === "pledge" ? "text-[var(--secondary)] font-bold" : ""}>3. Secure Hold</span>
        </div>

        {/* Form Body */}
        <div className="p-6">
          
          {/* Step 1: Contact Details */}
          {step === "contact" && (
            <form onSubmit={handleNext} className="space-y-4 text-left">
              <div className="text-xs rounded p-3.5 border border-slate-200 flex gap-2.5 items-start mb-2 bg-slate-50">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[var(--secondary)]" />
                <p className="text-[var(--muted)]">
                  Enter your contact information below. We will hold your spot in the checkout queue for <strong>10 minutes</strong>.
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
                Next: Choose Financing Plan
              </button>
            </form>
          )}

          {/* Step 2: Terms / Plan Selection */}
          {step === "terms" && (
            <form onSubmit={handleNext} className="space-y-5 text-left">
              <div className="text-xs text-[var(--muted)]">
                Choose your preferred payment strategy. Our 0% interest owner financing is fully approved instantly with no credit check.
              </div>

              {/* Option A: Installment Owner Financing */}
              <label className={`block rounded border p-4 cursor-pointer transition-all ${form.paymentOption === "financing" ? "border-[var(--secondary)] bg-[var(--secondary)]/5" : "border-slate-200 hover:bg-slate-50 bg-white"}`}>
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <input type="radio" name="paymentOption" value="financing" checked={form.paymentOption === "financing"} onChange={() => setForm({ ...form, paymentOption: "financing" })} className="mt-1 accent-[var(--secondary)]" />
                    <div>
                      <h4 className="text-sm font-bold text-[var(--foreground)]">0% Owner Financing Plan</h4>
                      <p className="text-xs mt-1 text-[var(--muted)]">
                        Pay just <strong>${property.downPayment}</strong> as a down payment deposit, then lock in easy monthly payments of <strong>${property.monthlyPayment}/mo</strong>.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[var(--secondary)]">${property.downPayment} Pledge</span>
                </div>
              </label>

              {/* Option B: One-Time Discounted Cash Purchase */}
              <label className={`block rounded border p-4 cursor-pointer transition-all ${form.paymentOption === "cash" ? "border-[var(--secondary)] bg-[var(--secondary)]/5" : "border-slate-200 hover:bg-slate-50 bg-white"}`}>
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <input type="radio" name="paymentOption" value="cash" checked={form.paymentOption === "cash"} onChange={() => setForm({ ...form, paymentOption: "cash" })} className="mt-1 accent-[var(--secondary)]" />
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-1.5 text-[var(--foreground)]">
                        One-Time Cash Discount <span className="bg-emerald-50 border border-emerald-250 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Save 10%</span>
                      </h4>
                      <p className="text-xs mt-1 text-[var(--muted)]">
                        Pay in full now and get a 10% discount. Total price reduced from ${property.price.toLocaleString()} to <strong>${Math.round(property.price * 0.9).toLocaleString()}</strong>. Secure hold deposit of <strong>${property.downPayment}</strong> holds it today.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-700">${Math.round(property.price * 0.9).toLocaleString()}</span>
                </div>
              </label>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={handleBack} className="h-11 px-6 rounded text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50 transition-colors">
                  Back
                </button>
                <button type="submit" className="flex-1 h-11 rounded flex items-center justify-center text-sm font-semibold transition-all hover:opacity-90 bg-[var(--primary)] text-white shadow-md">
                  Next: Secure Hold
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Pledge Confirmation Hold Form (NO CARDS!) */}
          {step === "pledge" && (
            <form onSubmit={handleCheckoutSubmit} className="space-y-4 text-left">
              <div className="rounded p-3.5 border border-amber-250 text-xs flex gap-2.5 items-start bg-amber-50">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-800">Secure Queue Hold (No Card Required)</p>
                  <p className="mt-1 text-[var(--muted)]">
                    No payment details or credit cards are collected today. Confirm your purchase pledge to reserve your place in the closing queue. 
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-[var(--muted)]">Billing Zip Code (To compute local deed registration taxes) *</label>
                <input required type="text" placeholder="90210" value={form.billingZip} onChange={e => setForm({ ...form, billingZip: e.target.value.replace(/\D/g, "") })}
                  className="w-full h-11 px-3.5 rounded text-sm border border-slate-200 bg-white text-[var(--foreground)] focus:border-[var(--secondary)]/50 focus:outline-none" />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" required checked={form.agreePledge} onChange={e => setForm({ ...form, agreePledge: e.target.checked })} className="mt-1 accent-[var(--secondary)]" />
                  <span className="text-xs text-[var(--muted)]">
                    I pledge my commitment to buy this property for <strong>{form.paymentOption === "financing" ? `${property.downPayment} down + $${property.monthlyPayment}/mo` : `$${Math.round(property.price * 0.9).toLocaleString()} cash`}</strong>. I agree to sign the closing deed within 24 hours of contact.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" required checked={form.agreeTerms} onChange={e => setForm({ ...form, agreeTerms: e.target.checked })} className="mt-1 accent-[var(--secondary)]" />
                  <span className="text-xs text-[var(--muted)]">
                    I confirm that all contact details are accurate and I authorize the TerraVest deeds team to temporarily lock this parcel.
                  </span>
                </label>
              </div>

              {status === "error" && (
                <div className="text-xs text-[var(--error)]">
                  Failed to reserve parcel queue. Please check connection and try again.
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={handleBack} disabled={status === "submitting"} className="h-11 px-6 rounded text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Back
                </button>
                <button type="submit" disabled={status === "submitting"}
                  className="flex-1 h-11 rounded flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60 bg-[var(--primary)] text-white shadow-md">
                  {status === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {status === "submitting" ? "Securing Queue..." : `Complete Booking Request`}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
