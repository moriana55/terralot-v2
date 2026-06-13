---
name: Elite Terroir
colors:
  surface: '#fbf8fc'
  surface-dim: '#dbd9dd'
  surface-bright: '#fbf8fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f7'
  surface-container: '#efedf1'
  surface-container-high: '#e9e7eb'
  surface-container-highest: '#e4e2e5'
  on-surface: '#1b1b1e'
  on-surface-variant: '#44464e'
  inverse-surface: '#303033'
  inverse-on-surface: '#f2f0f4'
  outline: '#75777f'
  outline-variant: '#c5c6cf'
  surface-tint: '#4c5e86'
  primary: '#00081e'
  on-primary: '#ffffff'
  primary-container: '#0a1f44'
  on-primary-container: '#7687b2'
  inverse-primary: '#b4c6f4'
  secondary: '#4a6549'
  on-secondary: '#ffffff'
  secondary-container: '#ccebc7'
  on-secondary-container: '#506b4f'
  tertiary: '#0e0800'
  on-tertiary: '#ffffff'
  tertiary-container: '#281f0a'
  on-tertiary-container: '#95866a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b4c6f4'
  on-primary-fixed: '#041a3f'
  on-primary-fixed-variant: '#34466d'
  secondary-fixed: '#ccebc7'
  secondary-fixed-dim: '#b0cfad'
  on-secondary-fixed: '#07200b'
  on-secondary-fixed-variant: '#334d33'
  tertiary-fixed: '#f3e0c0'
  tertiary-fixed-dim: '#d6c4a5'
  on-tertiary-fixed: '#231a06'
  on-tertiary-fixed-variant: '#51452d'
  background: '#fbf8fc'
  on-background: '#1b1b1e'
  surface-variant: '#e4e2e5'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
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
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 16px
  stack-md: 32px
  stack-lg: 64px
---

## Brand & Style

The brand personality for this design system is **Elite but Accessible**. It bridges the gap between high-end institutional real estate and modern fintech ease. The emotional response should be one of immediate trust, transparency, and the quiet confidence of a secure investment.

The design style follows a **Corporate / Modern** aesthetic with **Minimalist** leanings. We utilize expansive white space to denote luxury and clarity, while grounding the interface with high-end architectural precision. The UI avoids unnecessary ornamentation, focusing instead on structural integrity, crisp alignment, and a sophisticated interplay between deep corporate tones and organic, earth-inspired accents.

## Colors

The palette is designed to evoke both the stability of a financial institution and the physical reality of land ownership.

- **Primary (Deep Navy):** Used for primary navigation, headers, and core action buttons to convey authority and security.
- **Secondary (Sage Green):** Representing growth and the environment, this is used for success states and secondary highlights.
- **Tertiary (Sand):** A sophisticated neutral used for subtle background sections and dividers to soften the industrial feel of the navy.
- **Accent (Clay):** Reserved for high-value call-to-outs and specific thematic accents related to soil and earth.
- **Neutral:** A crisp white (#FFFFFF) is the primary surface, supported by a very light grey (#F9F9F9) for subtle layout containment.

## Typography

This design system utilizes a dual-font strategy to balance technical precision with utilitarian readability. 

**Geist** is employed for headlines and labels. Its technical, slightly monospaced influence communicates the "fintech" aspect of the platform—precise, modern, and data-driven. **Inter** is used for all body copy and long-form text, providing a neutral, highly legible experience that ensures investment details are easy to digest.

Scale headlines down aggressively for mobile devices to maintain a clean, single-column reading experience without excessive line wrapping.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** model for desktop to maintain an institutional, structured feel. We utilize a 12-column grid with a maximum container width of 1280px.

- **Desktop:** 64px outer margins with 24px gutters. Elements should align strictly to the grid to reinforce the "secure" brand personality.
- **Tablet:** 40px outer margins. Use an 8-column configuration.
- **Mobile:** 20px outer margins. Use a 4-column configuration or a single-column stack.

The spacing rhythm is built on an 8px baseline. Use larger vertical "stacks" (64px+) between major sections to emphasize high-end minimalism and allow the property photography to breathe.

## Elevation & Depth

To maintain a "high-end" feel, this design system avoids heavy shadows in favor of **Tonal Layers** and **Low-contrast Outlines**.

Hierarchy is primarily established through subtle background shifts (using the Sand and Neutral Base colors). When depth is required—such as for hovering property cards or modal dialogues—use **Ambient Shadows**. These should be extra-diffused (20px-40px blur), very low opacity (5-8%), and slightly tinted with the Primary Navy color to ensure they feel integrated into the environment rather than "floating" on top of it.

For input fields and secondary containers, use 1px solid borders in a light neutral (#E2E8F0) to maintain a crisp, architectural finish.

## Shapes

The shape language is **Soft**. We use a 0.25rem (4px) base radius for buttons and small components. This provides a subtle "human" touch to an otherwise rigorous corporate layout without appearing overly "bubbly" or consumer-grade.

- **Standard Elements:** 4px radius (e.g., Checkboxes, input fields).
- **Large Elements:** 8px (rounded-lg) for property cards and modal containers.
- **Pill Shapes:** Specifically reserved for status indicators (e.g., "Available", "Sold") and trust badges to differentiate them from actionable buttons.

## Components

### Property Cards
Property cards are the core of the experience. Use a vertical stack with high-resolution imagery at the top. The "Installment Focus" should be highlighted in a dedicated "Pricing Bar" at the bottom of the card, using the Deep Navy background with Sand text to draw the eye to the financial terms.

### Buttons
- **Primary:** Solid Deep Navy with White text. 4px radius.
- **Secondary:** Transparent with a 1px Navy border or Sage Green background for "Success" or "Purchase" actions.
- **Tertiary:** Text-only with a subtle underline or right-arrow icon for "View Details."

### Forms & Checkout Wizards
Forms must be sleek and unobtrusive. Use top-aligned labels in `label-md` Geist. Fields should have a 1px border that thickens to 2px on focus using the Navy color. For checkout wizards, use a minimalist horizontal progress bar at the top of the container.

### Trust Badges & Iconography
Iconography should be "Line Art" style with 1.5px or 2px stroke weights. Icons representing land features (acres, road access, utilities) should be paired with the Sage or Clay colors. Trust badges (e.g., "Verified Title") should utilize the "Pill" shape and be placed prominently near pricing or call-to-action areas.

### Lists
Use "Institutional Lists" for property specifications—clean lines, 1px horizontal dividers, and `label-md` Geist for the keys (e.g., APN, COUNTY) with `body-md` Inter for the values.