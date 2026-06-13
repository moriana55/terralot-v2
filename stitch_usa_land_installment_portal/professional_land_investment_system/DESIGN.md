---
name: Professional Land Investment System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001a42'
  on-tertiary-container: '#3980f4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is engineered to project authority, transparency, and financial stability. It targets high-intent land investors and individuals seeking secure installment-based property ownership. 

The aesthetic follows a **Corporate/Modern** direction. It prioritizes clarity through generous whitespace, a structured grid, and a sophisticated color palette. The visual language avoids decorative flourishes in favor of precision, ensuring that the focus remains on data-driven decision-making and the tangible value of real estate. Every element is designed to feel "institutional"—evoking the same level of trust one would expect from a premium wealth management platform or a traditional brokerage.

## Colors
The color strategy reinforces the narrative of growth and stability.
- **Primary (Deep Navy):** Used for core branding, navigation, and primary headings. It provides the "anchor" for the UI, representing reliability.
- **Secondary (Emerald Green):** Reserved for "Available" statuses, CTA buttons, and indicators of financial growth or successful investment.
- **Tertiary (Action Blue):** Utilized for secondary interactions, links, and map markers to provide visual distinction from brand-heavy elements.
- **Neutral (Slate):** A range of grays used for borders, secondary text, and background layering to maintain a clean, high-contrast environment.

The default mode is **Light**, utilizing a crisp white background (#FFFFFF) with subtle slate-50 (#F8FAFC) surface tiers to establish hierarchy without over-relying on shadows.

## Typography
This design system utilizes **Inter** exclusively to leverage its systematic, utilitarian nature. The typeface is optimized for screen readability, which is critical for complex data tables and legal disclosures.

- **Headlines:** Use Bold (700) or SemiBold (600) weights with slight negative letter spacing to create a compact, authoritative look.
- **Body Text:** Standardized at 16px for optimal legibility. Use a "Slate-700" color for long-form text to reduce eye strain while maintaining high contrast.
- **Labels:** Use Medium (500) weight and uppercase styling for small metadata labels to distinguish them from interactive body text.

## Layout & Spacing
The layout follows a **Fixed Grid** model for desktop to ensure the premium feel of a curated financial dashboard, transitioning to a fluid model for mobile devices.

- **Desktop:** 12-column grid with a 1280px max-width.
- **Tablet:** 8-column grid with 24px gutters.
- **Mobile:** 4-column grid with 16px gutters.

Spacing follows an 8px geometric scale. Use large `stack-lg` (32px) increments to separate major sections (e.g., Land Features from Installment Tables) to maintain the "breathable" corporate feel.

## Elevation & Depth
Hierarchy is established through **Tonal Layers** supplemented by low-contrast outlines. 

1. **Base:** White (#FFFFFF) for the primary canvas.
2. **Surface:** Slate-50 (#F8FAFC) for container backgrounds (e.g., the sidebar or the listing filter tray).
3. **Overlays:** Cards and modals use a very subtle, highly-diffused ambient shadow (`0px 4px 20px rgba(15, 23, 42, 0.05)`).
4. **Borders:** Use 1px solid borders in Slate-200 for all cards and input fields. Avoid heavy shadows; prefer a "flat-but-layered" approach to maintain professional sobriety.

## Shapes
The design system adopts a **Soft** shape language. 
- **Standard Radius (4px):** Applied to buttons, input fields, and small UI components. This creates a disciplined, architectural feel.
- **Large Radius (8px):** Applied to listing cards and informational containers.
- **Sharp Corners:** Used for the map interface and certain full-width data headers to emphasize a "technical" and "precise" environment.

## Components
- **Listing Cards:** Feature high-resolution photography with a 1px Slate-200 border. Price and "Installment Start" rates must be prominently displayed in the Primary Navy color. Use the Emerald Green for a "Status: Available" badge in the top-right.
- **Data Tables:** Used for installment plans. Rows should have a subtle hover state (#F1F5F9). Column headers must be uppercase `label-md` with clear sorting icons.
- **Buttons:** 
    - *Primary:* Solid Deep Navy with white text for "Buy Now" or "Apply." 
    - *Secondary:* Outline (1px Slate-300) for "View Details" or "Compare."
    - *Success:* Solid Emerald Green for "Reserve Land."
- **Input Fields:** Minimalist design with a 1px border. Focus state uses a 2px Primary Navy ring with 0px offset.
- **Maps:** Use a custom-styled map (Silver or Retro theme) to match the Slate/Navy palette. Markers should be Secondary Emerald for available plots and Slate-400 for sold plots.
- **Progress Indicators:** For installment plan tracking, use a thick 8px bar in Emerald Green against a Slate-100 background.