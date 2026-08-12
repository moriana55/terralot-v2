# Security policy

## Supported areas

Security fixes apply to the latest `main` versions of `dashboard/`, `landforever/`, and `scraper/`.

## Reporting

Use GitHub private vulnerability reporting or contact the repository owner privately through their GitHub profile. Do not publish credentials, parcel-owner personal data, production database contents, or destructive proof-of-concept code in a public issue.

Include the affected component/source, reproduction steps, impact, and suggested mitigation where possible.

## Sensitive data

Supabase service-role, Clerk, external parcel API, model-provider, mail, cron, Mapbox, and notification credentials are server-only unless explicitly named as public client configuration. Scraped owner/contact data may be regulated or contractually restricted; keep it out of commits, screenshots, issues, and demo fixtures.
