export type MailStatus = "draft" | "queued" | "mailed" | "delivered" | "returned" | "responded";
export type MailType = "yellow_letter" | "postcard" | "offer_letter" | "follow_up";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface MailPiece {
  id: string;
  campaignId: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientState: string;
  recipientZip: string;
  type: MailType;
  status: MailStatus;
  dealId?: string;
  lobId?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: MailType;
  status: CampaignStatus;
  targetState?: string;
  targetCounty?: string;
  totalPieces: number;
  sentCount: number;
  deliveredCount: number;
  respondedCount: number;
  costPerPiece: number;
  createdAt: string;
}

export const MAIL_TYPE_LABELS: Record<MailType, string> = {
  yellow_letter: "Yellow Letter",
  postcard: "Postcard",
  offer_letter: "Offer Letter",
  follow_up: "Follow-up",
};

export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  draft: "Draft",
  queued: "Queued",
  mailed: "Mailed",
  delivered: "Delivered",
  returned: "Returned",
  responded: "Responded",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

const MAIL_STATUS_COLORS: Record<MailStatus, string> = {
  draft: "var(--muted)",
  queued: "var(--secondary)",
  mailed: "var(--primary)",
  delivered: "var(--success)",
  returned: "var(--tertiary)",
  responded: "var(--success)",
};

const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "var(--muted)",
  active: "var(--success)",
  paused: "var(--tertiary)",
  completed: "var(--primary)",
};

export function getMailStatusColor(status: MailStatus) {
  return MAIL_STATUS_COLORS[status];
}

export function getCampaignStatusColor(status: CampaignStatus) {
  return CAMPAIGN_STATUS_COLORS[status];
}

// Demo campaigns
export const campaigns: Campaign[] = [
  { id: "camp1", name: "Mohave County Blast", type: "yellow_letter", status: "active", targetState: "Arizona", targetCounty: "Mohave", totalPieces: 250, sentCount: 180, deliveredCount: 165, respondedCount: 8, costPerPiece: 1.12, createdAt: "2026-05-01" },
  { id: "camp2", name: "West Texas Postcards", type: "postcard", status: "active", targetState: "Texas", targetCounty: "Hudspeth", totalPieces: 500, sentCount: 500, deliveredCount: 470, respondedCount: 15, costPerPiece: 0.78, createdAt: "2026-04-20" },
  { id: "camp3", name: "Florida Follow-ups", type: "follow_up", status: "completed", targetState: "Florida", targetCounty: "Polk", totalPieces: 50, sentCount: 50, deliveredCount: 48, respondedCount: 6, costPerPiece: 1.12, createdAt: "2026-04-10" },
  { id: "camp4", name: "Colorado Offer Letters", type: "offer_letter", status: "draft", targetState: "Colorado", targetCounty: "Park", totalPieces: 100, sentCount: 0, deliveredCount: 0, respondedCount: 0, costPerPiece: 1.52, createdAt: "2026-05-25" },
];

export const mailPieces: MailPiece[] = [
  { id: "m1", campaignId: "camp1", recipientName: "John R. Miller", recipientAddress: "4521 Desert View Rd", recipientCity: "Kingman", recipientState: "AZ", recipientZip: "86401", type: "yellow_letter", status: "delivered", sentAt: "2026-05-02", deliveredAt: "2026-05-06", createdAt: "2026-05-01" },
  { id: "m2", campaignId: "camp1", recipientName: "Patricia Gomez", recipientAddress: "782 Cactus Lane", recipientCity: "Lake Havasu City", recipientState: "AZ", recipientZip: "86403", type: "yellow_letter", status: "responded", sentAt: "2026-05-02", deliveredAt: "2026-05-05", createdAt: "2026-05-01" },
  { id: "m3", campaignId: "camp2", recipientName: "Robert S. Davis", recipientAddress: "PO Box 1142", recipientCity: "Sierra Blanca", recipientState: "TX", recipientZip: "79851", type: "postcard", status: "delivered", sentAt: "2026-04-21", deliveredAt: "2026-04-25", createdAt: "2026-04-20" },
  { id: "m4", campaignId: "camp2", recipientName: "Maria L. Torres", recipientAddress: "3399 Ranch Rd 1111", recipientCity: "Van Horn", recipientState: "TX", recipientZip: "79855", type: "postcard", status: "responded", sentAt: "2026-04-21", deliveredAt: "2026-04-24", createdAt: "2026-04-20" },
  { id: "m5", campaignId: "camp2", recipientName: "William Chen", recipientAddress: "889 Mesa Dr", recipientCity: "Dell City", recipientState: "TX", recipientZip: "79837", type: "postcard", status: "returned", sentAt: "2026-04-21", createdAt: "2026-04-20" },
  { id: "m6", campaignId: "camp3", recipientName: "Sandra K. Brown", recipientAddress: "1205 Lake Shore Blvd", recipientCity: "Lakeland", recipientState: "FL", recipientZip: "33801", type: "follow_up", status: "responded", sentAt: "2026-04-11", deliveredAt: "2026-04-14", createdAt: "2026-04-10" },
  { id: "m7", campaignId: "camp1", recipientName: "Thomas Wright", recipientAddress: "6633 Hwy 93", recipientCity: "Wickenburg", recipientState: "AZ", recipientZip: "85390", type: "yellow_letter", status: "mailed", sentAt: "2026-05-22", createdAt: "2026-05-22" },
  { id: "m8", campaignId: "camp4", recipientName: "Jennifer Adams", recipientAddress: "412 Mountain View Rd", recipientCity: "Fairplay", recipientState: "CO", recipientZip: "80440", type: "offer_letter", status: "draft", createdAt: "2026-05-25" },
];

export function getCampaign(id: string) {
  return campaigns.find(c => c.id === id);
}

export function getCampaignPieces(campaignId: string) {
  return mailPieces.filter(m => m.campaignId === campaignId);
}

export function getMailerStats() {
  const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
  const totalDelivered = campaigns.reduce((s, c) => s + c.deliveredCount, 0);
  const totalResponded = campaigns.reduce((s, c) => s + c.respondedCount, 0);
  const totalSpent = campaigns.reduce((s, c) => s + (c.sentCount * c.costPerPiece), 0);
  const responseRate = totalSent > 0 ? ((totalResponded / totalSent) * 100) : 0;
  const costPerResponse = totalResponded > 0 ? totalSpent / totalResponded : 0;

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === "active").length,
    totalSent,
    totalDelivered,
    totalResponded,
    totalSpent: Math.round(totalSpent),
    responseRate: Math.round(responseRate * 10) / 10,
    costPerResponse: Math.round(costPerResponse * 100) / 100,
  };
}

// Letter templates
export const LETTER_TEMPLATES: { id: string; name: string; type: MailType; preview: string }[] = [
  {
    id: "tpl1",
    name: "Yellow Letter — Friendly Offer",
    type: "yellow_letter",
    preview: "Hi {{owner_name}},\n\nI noticed you own a beautiful piece of land in {{county}}, {{state}}. I'm interested in purchasing your property at {{address}}.\n\nI can offer a fair cash price and close quickly. Would you be open to a conversation?\n\nBest regards,\nTerraLot Team",
  },
  {
    id: "tpl2",
    name: "Postcard — Quick Cash Offer",
    type: "postcard",
    preview: "ATTENTION LANDOWNER\n\nWe want to buy your land in {{county}}, {{state}}!\n\n✓ Fair cash offer\n✓ No fees or commissions\n✓ Close in 14 days\n\nCall us: (555) 123-4567\nterralot.com",
  },
  {
    id: "tpl3",
    name: "Formal Offer Letter",
    type: "offer_letter",
    preview: "Dear {{owner_name}},\n\nRe: Purchase Offer for APN {{apn}}\n\nWe are writing to express our interest in purchasing your property located at {{address}}, {{county}}, {{state}}.\n\nOur offer: ${{offer_amount}}\n\nThis is a cash offer with no contingencies. We can close within 30 days.\n\nSincerely,\nTerraLot Acquisitions",
  },
  {
    id: "tpl4",
    name: "Follow-up Letter",
    type: "follow_up",
    preview: "Hi {{owner_name}},\n\nI reached out a few weeks ago about your property in {{county}}. I wanted to follow up — our offer still stands and we're flexible on terms.\n\nIf you've thought about it, I'd love to chat.\n\nBest,\nTerraLot Team",
  },
  {
    id: "tpl5",
    name: "Legal Purchase Agreement (All-Cash Offer)",
    type: "offer_letter",
    preview: "REAL ESTATE PURCHASE CONTRACT (ALL-CASH OFFER)\n\n1. PARTIES: TerraLot Acquisitions LLC (\"Buyer\") agrees to buy, and {{owner_name}} (\"Seller\") agrees to sell the property described below.\n2. PROPERTY DESCRIPTION: Land parcel located in {{county}} County, {{state}}, APN: {{apn}}.\n3. PURCHASE PRICE: Buyer shall pay Seller at closing: ${{offer_amount}} (All-Cash, no financing contingencies).\n4. CLOSING: Closing shall occur within 30 days. Title and escrow fees to be split equally.\n5. CONVEYANCE: Seller warrants marketable title, free of liens, conveyed by General Warranty Deed.\n\nSELLER SIGNATURE: _______________________ DATE: _________\n\nBUYER SIGNATURE: TerraLot Acquisitions Authorized Signatory",
  },
];
