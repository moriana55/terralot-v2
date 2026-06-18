import { FileText, ShieldCheck } from "lucide-react";
import { EmptyState } from "../EmptyState";

export const metadata = { title: "Contracts" };

// Buyer contracts/documents. Real documents are stored per-buyer (Supabase
// Storage / a Contract table) and must be access-controlled so a buyer can only
// fetch their own files (see RLS SQL in PR notes). Until that model is wired,
// show an honest empty state — never list another buyer's documents.
export default function BuyerContracts() {
  const docs: { id: string; name: string; signedAt: string | null }[] = [];

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Contracts &amp; Documents</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Your land contract, disclosures, and payment records.
        </p>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          body="Your owner-finance agreement, property disclosures, and receipts will appear here once your purchase is processed. Documents are private to your account."
        />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 tl-card p-4">
              <FileText className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {d.signedAt ? `Signed ${d.signedAt}` : "Pending signature"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] mt-6 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
        <ShieldCheck className="w-3 h-3" /> Documents are access-controlled — only you can view files tied to your account.
      </p>
    </div>
  );
}
