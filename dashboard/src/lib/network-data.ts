export type ContactRole = "wholesaler" | "scout" | "realtor" | "investor" | "buyer";
export type DealStatus = "new" | "evaluating" | "presented" | "accepted" | "closed" | "dead";
export type ReferralStatus = "pending" | "invoiced" | "paid" | "cancelled";
export type ActivityType = "call" | "email" | "meeting" | "note" | "deal_sent" | "deal_closed";

export interface Contact {
  id: string;
  name: string;
  company?: string;
  role: ContactRole;
  email?: string;
  phone?: string;
  state?: string;
  notes?: string;
  budget?: { min: number; max: number };
  preferredStates?: string[];
  preferredAcres?: { min: number; max: number };
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  state: string;
  county?: string;
  acres?: number;
  askingPrice?: number;
  estimatedValue?: number;
  sourceId: string;
  status: DealStatus;
  notes?: string;
  lat?: number;
  lng?: number;
  documents?: Document[];
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  type: "title" | "deed" | "survey" | "photo" | "tax" | "other";
  url: string;
  uploadedAt: string;
}

export interface Referral {
  id: string;
  dealId: string;
  contactId: string;
  commission?: number;
  status: ReferralStatus;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  contactId: string;
  dealId?: string;
  type: ActivityType;
  title: string;
  description?: string;
  createdAt: string;
}

export const ROLE_LABELS: Record<ContactRole, string> = {
  wholesaler: "Wholesaler",
  scout: "Scout",
  realtor: "Realtor",
  investor: "Investor",
  buyer: "Buyer",
};

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  new: "New",
  evaluating: "Evaluating",
  presented: "Presented",
  accepted: "Accepted",
  closed: "Closed",
  dead: "Dead",
};

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "Pending",
  invoiced: "Invoiced",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: "Phone Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  deal_sent: "Deal Sent",
  deal_closed: "Deal Closed",
};

const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  new: "var(--primary)",
  evaluating: "var(--tertiary)",
  presented: "var(--secondary)",
  accepted: "var(--success)",
  closed: "var(--success)",
  dead: "var(--muted)",
};

const REFERRAL_STATUS_COLORS: Record<ReferralStatus, string> = {
  pending: "var(--tertiary)",
  invoiced: "var(--primary)",
  paid: "var(--success)",
  cancelled: "var(--muted)",
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  call: "var(--primary)",
  email: "var(--secondary)",
  meeting: "var(--tertiary)",
  note: "var(--muted)",
  deal_sent: "var(--success)",
  deal_closed: "var(--success)",
};

export function getDealStatusColor(status: DealStatus) {
  return DEAL_STATUS_COLORS[status];
}

export function getReferralStatusColor(status: ReferralStatus) {
  return REFERRAL_STATUS_COLORS[status];
}

export function getActivityColor(type: ActivityType) {
  return ACTIVITY_COLORS[type];
}

// ── Deal Scoring ──
export function scoreDeal(deal: Deal): { score: number; label: string; color: string; breakdown: { margin: number; size: number; status: number } } {
  let margin = 0;
  if (deal.askingPrice && deal.estimatedValue) {
    const pct = ((deal.estimatedValue - deal.askingPrice) / deal.askingPrice) * 100;
    if (pct >= 80) margin = 40;
    else if (pct >= 50) margin = 30;
    else if (pct >= 30) margin = 20;
    else margin = 10;
  }

  let size = 0;
  if (deal.acres) {
    if (deal.acres >= 20) size = 30;
    else if (deal.acres >= 10) size = 25;
    else if (deal.acres >= 5) size = 20;
    else size = 10;
  }

  let status = 0;
  if (deal.status === "new") status = 30;
  else if (deal.status === "evaluating") status = 25;
  else if (deal.status === "presented") status = 20;
  else if (deal.status === "accepted") status = 15;
  else status = 5;

  const score = margin + size + status;
  const label = score >= 70 ? "Hot" : score >= 45 ? "Warm" : "Cold";
  const color = score >= 70 ? "var(--success)" : score >= 45 ? "var(--tertiary)" : "var(--muted)";

  return { score, label, color, breakdown: { margin, size, status } };
}

// ── Investor Matching ──
export function matchInvestors(deal: Deal): { contact: Contact; matchScore: number; reasons: string[] }[] {
  const investors = contacts.filter(c => c.role === "investor" || c.role === "buyer");
  return investors
    .map(inv => {
      let matchScore = 0;
      const reasons: string[] = [];

      if (inv.preferredStates?.includes(deal.state)) {
        matchScore += 35;
        reasons.push(`Prefers ${deal.state}`);
      }

      if (inv.budget && deal.askingPrice) {
        if (deal.askingPrice >= inv.budget.min && deal.askingPrice <= inv.budget.max) {
          matchScore += 35;
          reasons.push("Within budget");
        } else if (deal.askingPrice < inv.budget.min) {
          matchScore += 15;
          reasons.push("Under budget");
        }
      }

      if (inv.preferredAcres && deal.acres) {
        if (deal.acres >= inv.preferredAcres.min && deal.acres <= inv.preferredAcres.max) {
          matchScore += 30;
          reasons.push("Acreage match");
        }
      }

      if (reasons.length === 0) {
        matchScore = 10;
        reasons.push("General interest");
      }

      return { contact: inv, matchScore, reasons };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ── Demo Data ──
export const contacts: Contact[] = [
  { id: "c1", name: "Mike Henderson", company: "TX Land Deals", role: "wholesaler", email: "mike@txlanddeals.com", phone: "+1 512-555-0142", state: "Texas", notes: "High volume, 10+ deals/month", createdAt: "2026-04-15" },
  { id: "c2", name: "Sarah Chen", role: "scout", email: "sarah.c@gmail.com", phone: "+1 602-555-0198", state: "Arizona", notes: "Specializes in Mohave County", createdAt: "2026-04-20" },
  { id: "c3", name: "James Kowalski", company: "Summit Realty", role: "realtor", email: "james@summitrealty.com", state: "Colorado", createdAt: "2026-05-01" },
  { id: "c4", name: "David Park", company: "Park Investments", role: "investor", email: "david@parkinv.com", phone: "+1 310-555-0177", state: "California", notes: "Budget: $50K-200K per deal", budget: { min: 15000, max: 200000 }, preferredStates: ["Texas", "Arizona", "Colorado", "Florida"], preferredAcres: { min: 5, max: 100 }, createdAt: "2026-05-05" },
  { id: "c5", name: "Rachel Adams", role: "buyer", email: "rachel.a@outlook.com", phone: "+1 407-555-0133", state: "Florida", budget: { min: 5000, max: 50000 }, preferredStates: ["Florida", "Texas"], preferredAcres: { min: 1, max: 20 }, createdAt: "2026-05-10" },
  { id: "c6", name: "Tom Williams", company: "Desert Capital", role: "investor", email: "tom@desertcap.com", phone: "+1 480-555-0199", state: "Arizona", budget: { min: 10000, max: 100000 }, preferredStates: ["Arizona", "Nevada", "New Mexico"], preferredAcres: { min: 10, max: 200 }, createdAt: "2026-04-28" },
  { id: "c7", name: "Lisa Monroe", role: "wholesaler", email: "lisa.m@landflip.com", phone: "+1 904-555-0166", state: "Florida", notes: "Florida specialist, tax lien expert", createdAt: "2026-05-02" },
  { id: "c8", name: "Kevin Nguyen", company: "Lone Star Acres", role: "scout", email: "kevin@lonestaracres.com", state: "Texas", notes: "West Texas, Hudspeth/Culberson counties", createdAt: "2026-05-15" },
];

export const deals: Deal[] = [
  { id: "d1", title: "40 Acres Mohave County", state: "Arizona", county: "Mohave", acres: 40, askingPrice: 18000, estimatedValue: 35000, sourceId: "c2", status: "presented", notes: "Off-market, owner motivated", lat: 35.2, lng: -114.0, documents: [{ id: "doc1", name: "Title Report.pdf", type: "title", url: "#", uploadedAt: "2026-05-12" }, { id: "doc2", name: "Survey Map.pdf", type: "survey", url: "#", uploadedAt: "2026-05-13" }], createdAt: "2026-05-12" },
  { id: "d2", title: "10 Acres El Paso", state: "Texas", county: "El Paso", acres: 10, askingPrice: 8500, estimatedValue: 15000, sourceId: "c1", status: "new", lat: 31.8, lng: -106.4, createdAt: "2026-05-18" },
  { id: "d3", title: "5 Acres Park County", state: "Colorado", county: "Park", acres: 5, askingPrice: 22000, estimatedValue: 40000, sourceId: "c3", status: "accepted", notes: "Investor David interested", lat: 39.2, lng: -105.7, documents: [{ id: "doc3", name: "Deed.pdf", type: "deed", url: "#", uploadedAt: "2026-05-09" }], createdAt: "2026-05-08" },
  { id: "d4", title: "20 Acres Polk County", state: "Florida", county: "Polk", acres: 20, askingPrice: 30000, estimatedValue: 55000, sourceId: "c1", status: "closed", lat: 27.9, lng: -81.7, createdAt: "2026-04-25" },
  { id: "d5", title: "2.5 Acres Hudspeth County", state: "Texas", county: "Hudspeth", acres: 2.5, askingPrice: 3000, estimatedValue: 4500, sourceId: "c1", status: "dead", notes: "Title issues", lat: 31.5, lng: -105.4, createdAt: "2026-05-20" },
  { id: "d6", title: "80 Acres La Paz County", state: "Arizona", county: "La Paz", acres: 80, askingPrice: 32000, estimatedValue: 60000, sourceId: "c2", status: "evaluating", lat: 33.7, lng: -114.2, createdAt: "2026-05-22" },
  { id: "d7", title: "15 Acres Brevard County", state: "Florida", county: "Brevard", acres: 15, askingPrice: 45000, estimatedValue: 75000, sourceId: "c7", status: "new", lat: 28.3, lng: -80.7, createdAt: "2026-05-24" },
  { id: "d8", title: "160 Acres Culberson County", state: "Texas", county: "Culberson", acres: 160, askingPrice: 48000, estimatedValue: 80000, sourceId: "c8", status: "evaluating", notes: "Huge parcel, road access confirmed", lat: 31.4, lng: -104.6, createdAt: "2026-05-25" },
];

export const referrals: Referral[] = [
  { id: "r1", dealId: "d4", contactId: "c5", commission: 2500, status: "paid", paidAt: "2026-05-15", createdAt: "2026-05-01" },
  { id: "r2", dealId: "d3", contactId: "c4", commission: 3000, status: "pending", createdAt: "2026-05-10" },
  { id: "r3", dealId: "d1", contactId: "c4", commission: 2000, status: "pending", createdAt: "2026-05-14" },
  { id: "r4", dealId: "d1", contactId: "c6", commission: 1500, status: "invoiced", createdAt: "2026-05-16" },
];

export const activities: Activity[] = [
  { id: "a1", contactId: "c1", type: "call", title: "Initial intro call", description: "Mike has 3 new TX deals coming this week", createdAt: "2026-04-15T10:00:00" },
  { id: "a2", contactId: "c2", type: "email", title: "Sent Mohave deal details", description: "Sarah found 40 acres, owner wants quick close", createdAt: "2026-05-12T14:30:00" },
  { id: "a3", contactId: "c4", dealId: "d3", type: "deal_sent", title: "Sent Park County deal to David", description: "5 acres, 82% margin potential", createdAt: "2026-05-08T16:00:00" },
  { id: "a4", contactId: "c4", dealId: "d3", type: "call", title: "David interested in Park County", description: "Wants to move forward, requesting title report", createdAt: "2026-05-09T11:00:00" },
  { id: "a5", contactId: "c5", dealId: "d4", type: "deal_closed", title: "Polk County deal closed", description: "Rachel closed at $55K, $2,500 referral earned", createdAt: "2026-05-15T09:00:00" },
  { id: "a6", contactId: "c1", type: "call", title: "Weekly check-in with Mike", description: "2 new deals: El Paso 10ac and Hudspeth 2.5ac", createdAt: "2026-05-18T10:00:00" },
  { id: "a7", contactId: "c6", dealId: "d1", type: "deal_sent", title: "Sent Mohave deal to Tom", description: "80 acres matches his AZ preference", createdAt: "2026-05-16T13:00:00" },
  { id: "a8", contactId: "c3", type: "meeting", title: "Coffee with James in Denver", description: "He has off-market leads from estate sales", createdAt: "2026-05-20T15:00:00" },
  { id: "a9", contactId: "c7", type: "email", title: "Lisa sent Brevard County lead", description: "15 acres, good road access, near development zone", createdAt: "2026-05-24T08:00:00" },
  { id: "a10", contactId: "c8", type: "call", title: "Kevin found 160ac Culberson", description: "Huge parcel, county confirmed road access, motivated seller", createdAt: "2026-05-25T11:30:00" },
];

// ── Pipeline Stats ──
export function getPipelineStats() {
  const active = deals.filter(d => !["closed", "dead"].includes(d.status));
  const closed = deals.filter(d => d.status === "closed");
  const pipelineValue = active.reduce((s, d) => s + (d.estimatedValue || 0), 0);
  const totalEarned = referrals.filter(r => r.status === "paid").reduce((s, r) => s + (r.commission || 0), 0);
  const totalPending = referrals.filter(r => ["pending", "invoiced"].includes(r.status)).reduce((s, r) => s + (r.commission || 0), 0);
  const conversionRate = deals.length > 0 ? Math.round((closed.length / deals.length) * 100) : 0;
  const avgMargin = deals.filter(d => d.askingPrice && d.estimatedValue).reduce((s, d) => {
    const pct = ((d.estimatedValue! - d.askingPrice!) / d.askingPrice!) * 100;
    return s + pct;
  }, 0) / (deals.filter(d => d.askingPrice && d.estimatedValue).length || 1);

  return {
    totalDeals: deals.length,
    activeDeals: active.length,
    closedDeals: closed.length,
    deadDeals: deals.filter(d => d.status === "dead").length,
    pipelineValue,
    totalEarned,
    totalPending,
    conversionRate,
    avgMargin: Math.round(avgMargin),
    totalContacts: contacts.length,
    sources: contacts.filter(c => ["wholesaler", "scout", "realtor"].includes(c.role)).length,
    investors: contacts.filter(c => ["investor", "buyer"].includes(c.role)).length,
  };
}

export function getContact(id: string) {
  return contacts.find(c => c.id === id);
}

export function getDeal(id: string) {
  return deals.find(d => d.id === id);
}

export function getContactActivities(contactId: string) {
  return activities.filter(a => a.contactId === contactId);
}

export function getDealActivities(dealId: string) {
  return activities.filter(a => a.dealId === dealId);
}
