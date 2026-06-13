import { FileText, Download, Eye, Calendar } from "lucide-react";

export const metadata = { title: "Documents" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

const documents = [
  { id: "1", name: "Pazar Araştırması", desc: "US land market analysis, demand signals, target demographics", category: "Research", date: "2026-05-01", size: "2.4 MB" },
  { id: "2", name: "Rakip Analizi", desc: "Competitive landscape — LandWatch, LandCentury, AcreTrader comparison", category: "Research", date: "2026-05-01", size: "1.8 MB" },
  { id: "3", name: "İş Planı & Finansal Model", desc: "5-year projections, unit economics, break-even analysis", category: "Financial", date: "2026-05-01", size: "3.1 MB" },
  { id: "4", name: "Teknoloji & Platform Dokümanı", desc: "Tech stack, architecture, AI features, development roadmap", category: "Technical", date: "2026-05-01", size: "2.8 MB" },
  { id: "5", name: "Ortaklık Teklifi", desc: "Revenue split model, IP ownership, exit strategy, investor protections", category: "Legal", date: "2026-05-01", size: "1.5 MB" },
  { id: "6", name: "TerraLot Yatırımcı Sunumu", desc: "Executive pitch deck — vision, traction, financials, ask", category: "Presentation", date: "2026-05-15", size: "5.2 MB" },
  { id: "7", name: "Land Subdivision Research", desc: "State-by-state subdivision rules, profitability analysis", category: "Research", date: "2026-05-10", size: "1.9 MB" },
  { id: "8", name: "All States Land Research", desc: "Comprehensive research across all 50 states for land acquisition", category: "Research", date: "2026-05-08", size: "4.1 MB" },
];

const categories = [...new Set(documents.map(d => d.category))];

const categoryColors: Record<string, string> = {
  Research: "#8ed1df",
  Financial: "#22c55e",
  Technical: "#a78bfa",
  Legal: "#f97316",
  Presentation: "#ec4899",
};

export default function DocumentsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Documents</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>All investor documents, reports, and research materials</p>

      {/* Category chips */}
      <div className="flex gap-2 mb-6">
        <span className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20" style={{ color: "var(--primary)" }}>All ({documents.length})</span>
        {categories.map(c => (
          <span key={c} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 cursor-pointer transition-colors hover:border-white/20" style={{ color: "var(--muted)" }}>
            {c} ({documents.filter(d => d.category === c).length})
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map(doc => (
          <Card key={doc.id} className="flex gap-4 items-start hover:border-white/10 transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${categoryColors[doc.category]}10` }}>
              <FileText className="w-5 h-5" style={{ color: categoryColors[doc.category] }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold">{doc.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0" style={{ background: `${categoryColors[doc.category]}15`, color: categoryColors[doc.category] }}>
                  {doc.category}
                </span>
              </div>
              <p className="text-xs mt-1 mb-2" style={{ color: "var(--muted)" }}>{doc.desc}</p>
              <div className="flex items-center gap-4 text-[10px]" style={{ color: "var(--muted)" }}>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(doc.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span>{doc.size}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
