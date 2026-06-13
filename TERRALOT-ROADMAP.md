# TerraLot — US Land Installment Sales Platform
## Business & Technical Roadmap

---

## VISION
Buy undervalued US land at county tax auctions (50-75% below market), sell globally via installment plans (12/24/36 months). AI-powered parcel discovery, automated payments, self-sustaining portfolio.

---

## PHASE 1: FOUNDATION (Week 1-4)
**Goal:** Legal structure + first 3-5 test parcels

### Business Setup
- [ ] Open Wyoming LLC ($100 — privacy + no state tax)
- [ ] Open US business bank account (Mercury or Relay)
- [ ] Stripe account for recurring payments
- [ ] Land contract template from attorney ($500 one-time)
- [ ] EIN number from IRS (free)

### First Acquisitions
- [ ] Target states: Texas, New Mexico, Arizona (cheapest entry)
- [ ] Budget: $5,000-$10,000 for 3-5 parcels
- [ ] Source: County tax deed auctions, tax lien sales
- [ ] Due diligence per parcel:
  - Zoning (buildable?)
  - Road access (Google Maps + id.land)
  - Flood zone check (FEMA)
  - Back taxes / liens (county records)
  - Utilities proximity
- [ ] Close purchases, record deeds

### Platform MVP
- [x] Landing page with listings (DONE)
- [x] Admin dashboard (DONE)
- [x] Financial analytics (DONE)
- [ ] Stripe Checkout integration (down payment + recurring)
- [ ] Customer portal (payment history, contract download)
- [ ] Email automation (welcome, payment reminders, receipts)

**Budget: ~$7,000-12,000**
**Revenue: $0 (building phase)**

---

## PHASE 2: FIRST SALES (Week 5-10)
**Goal:** Sell 3-5 parcels, validate demand, prove the model

### Marketing
- [ ] Facebook/Instagram ads — target: US, LATAM, Middle East
  - "Own US land for $99 down, $149/month"
  - Budget: $500-1,000 test
- [ ] TikTok organic content (drone footage, parcel walkthrough)
- [ ] SEO pages per state/county
- [ ] Google Ads — "buy land in Texas no credit check"

### Sales Process
- [ ] Lead comes in → auto email with parcel details
- [ ] Payment link → Stripe checkout
- [ ] Contract auto-generated with buyer info
- [ ] Deed held in trust until final payment (or contract for deed)

### Metrics to Track
- Cost per lead (target: $10-30)
- Lead to sale conversion (target: 5-10%)
- Average sale price
- Down payment collected
- Monthly recurring revenue (MRR)

**Budget: $1,500-3,000 (marketing)**
**Target Revenue: $1,000-3,000 MRR**

---

## PHASE 3: AI-POWERED SCALING (Week 11-20)
**Goal:** Automate parcel discovery, scale to 20-50 parcels

### AI Parcel Discovery Engine
- [ ] Integrate id.land API or county GIS data
- [ ] Auto-scan tax auction listings across 10+ states
- [ ] AI scoring: location, buildability, road access, price vs market
- [ ] Alert system: "New parcel found — $1,200 cost, estimated $5,000 sale"
- [ ] Comparable sales analysis (auto-pricing)

### Platform Upgrades
- [ ] Multi-language support (Spanish, Arabic, Portuguese)
- [ ] WhatsApp integration for international buyers
- [ ] Automated payment default handling:
  - Day 1 late: email reminder
  - Day 7: SMS + WhatsApp
  - Day 30: default notice
  - Day 60: repossession process
- [ ] Buyer referral program ($50 credit per referral)

### Scaling Operations
- [ ] Reinvest MRR into new parcels (self-sustaining flywheel)
- [ ] Hire VA for customer support ($400-600/mo)
- [ ] Target: 5-10 new parcels per month from cash flow

**Budget: Funded by MRR (self-sustaining)**
**Target Revenue: $5,000-15,000 MRR**

---

## PHASE 4: FULL AUTOMATION (Month 6-12)
**Goal:** 100+ parcel portfolio, fully automated pipeline

### Advanced Features
- [ ] AI chatbot for buyer questions (24/7, multilingual)
- [ ] Auto-generated listing pages with drone imagery
- [ ] Dynamic pricing based on demand/season
- [ ] Investor dashboard (for partners — read-only financials)
- [ ] Mobile app for buyers (payment, contract, parcel map)

### Portfolio Growth
- [ ] 100+ active parcels across 15+ states
- [ ] Diversified: desert, forest, mountain, farmland
- [ ] Price range: $3,000-$50,000
- [ ] Average margin: 40-60%

### Revenue Projections
| Month | Parcels | MRR | Cumulative Revenue |
|-------|---------|-----|--------------------|
| 1     | 5       | $750 | $2,000 |
| 3     | 12      | $2,500 | $12,000 |
| 6     | 30      | $6,500 | $40,000 |
| 9     | 60      | $13,000 | $95,000 |
| 12    | 100     | $22,000 | $200,000+ |

*Assumes avg sale $8,000, avg monthly $180, 30% default rate, reinvestment of cash flow*

---

## FINANCIAL MODEL

### Unit Economics (Per Parcel)
| Item | Amount |
|------|--------|
| Acquisition cost | $2,000-5,000 |
| Due diligence / closing | $200-500 |
| Total cost | $2,200-5,500 |
| Sale price | $5,000-15,000 |
| Down payment | $99-499 |
| Monthly payment | $79-299 |
| Term | 12-36 months |
| Gross margin | 40-65% |
| Default rate | ~30% (parcel returns to inventory) |
| Net margin after defaults | 30-50% |

### Monthly Costs (Operational)
| Item | Cost |
|------|------|
| LLC maintenance | $0/mo (Wyoming) |
| Stripe fees | 2.9% + $0.30/tx |
| id.land subscription | $20/mo |
| Hosting (Vercel) | $20/mo |
| Marketing (scaled) | $500-2,000/mo |
| VA support | $400-600/mo |
| Property taxes (per parcel) | $5-30/mo avg |
| **Total fixed** | **~$1,000-3,000/mo** |

---

## INVESTOR STRUCTURE (RECOMMENDED)

### Option A: Technology Partner Model (RECOMMENDED)
- Investor provides acquisition capital ($10-50K)
- You provide: platform, technology, operations
- Revenue split: 60% investor / 40% you (technology + operations fee)
- Platform ownership: 100% yours
- Investor gets: read-only dashboard, monthly reports
- Exit: investor can sell their share, platform stays with you

### Option B: Monthly Retainer + Performance
- Monthly technology fee: $2,000-3,000/mo
- Plus 15-20% of net profit
- Platform ownership: 100% yours
- Minimum 12-month contract
- If investor leaves, platform stops

### Key Protection Points
- Source code: never shared, hosted on your infrastructure
- Payment processing: through your Stripe account
- Domain & hosting: your accounts
- Customer relationships: managed through your platform
- Investor gets financial dashboard access only

---

## TECH STACK
| Component | Technology | Status |
|-----------|-----------|--------|
| Landing page | Next.js + TailwindCSS | DONE |
| Admin dashboard | Next.js + Prisma | DONE |
| Financial analytics | Custom charts | DONE |
| Database | PostgreSQL (Neon/Supabase) | DONE |
| Hosting | Vercel | DONE |
| Payments | Stripe (TODO) | PLANNED |
| AI engine | OpenAI + custom scoring | PLANNED |
| CRM | Built-in | PLANNED |
| Email | Resend / SendGrid | PLANNED |
| WhatsApp | Evolution API | PLANNED |

---

## RISK MITIGATION
1. **Bad parcels:** Strict due diligence checklist, AI scoring before purchase
2. **High defaults:** Priced into model (30%), parcel returns to inventory = resold
3. **Legal issues:** State-specific land contracts, attorney-reviewed
4. **Market risk:** Land is tangible, doesn't go to zero, low volatility
5. **Competition:** Tech advantage — most competitors use Craigslist/Facebook manual posts
6. **Cash flow gap:** Start small, reinvest, don't over-leverage

---

## IMMEDIATE NEXT STEPS (THIS WEEK)
1. Open Wyoming LLC
2. Set up Mercury bank account
3. Research 5 target counties for first purchases
4. Integrate Stripe into TerraLot checkout
5. Prepare investor pitch deck from this roadmap

---

*Document generated: May 2026*
*TerraLot — Democratizing US Land Ownership*
