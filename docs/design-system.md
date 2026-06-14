# Kentekenvergelijker design system

House style reference for UI work in this project. **Source of truth for tokens and utility classes:** `app/globals.css`.

Read this file before adding or changing styles.

---

## Brand feel

- Professional, trustworthy, Dutch automotive
- Teal-to-blue gradient from the brand logo: deep blue, teal, cyan
- Clean cards, cool blue-tinted backgrounds, green check accents
- Kenteken plate inputs keep authentic Dutch yellow (separate from brand UI accents)
- Avoid generic Tailwind blues (`blue-700`, `slate-*`) for new UI; use `kv-*` tokens instead

---

## Colors

Palette extracted from `public/logo.png`.

| Token | Hex | Usage |
| --- | --- | --- |
| `--kv-navy` | `#183878` | Primary text, table headers, footer |
| `--kv-navy-light` | `#104878` | Deeper blue accents |
| `--kv-navy-muted` | `#086080` | Mid teal-blue accents |
| `--kv-teal` | `#008090` | Primary accent, links, feature stripes |
| `--kv-teal-light` | `#08a8a0` | Hover highlights, badge borders |
| `--kv-teal-hover` | `#40a8b0` | Lighter accent highlights |
| `--kv-cyan` | `#48a8b0` | Gradient end / bright highlights |
| `--kv-green` | `#4caf50` | Success, checkmarks (from logo) |
| `--kv-bg` | `#edf3f6` | Page background |
| `--kv-bg-alt` | `#dce9ee` | Alternate sections (FAQ, stripes) |
| `--kv-surface` | `#ffffff` | Cards, header, table body |
| `--kv-text` | `#183878` | Body text (same as navy) |
| `--kv-muted` | `#5a7280` | Secondary / helper text |
| `--kv-border` | `#c5d8de` | Borders, dividers (cool blue-grey) |
| `--kv-plate-border` | `#111111` | Kenteken plate black border |
| `--kv-eu-blue` | `#003399` | EU strip on kenteken input (NL badge) |

`--kv-yellow` and `--kv-yellow-hover` are legacy aliases mapped to `--kv-teal` and `--kv-teal-light` for backwards-compatible class names.

### Tailwind utilities (from `@theme inline`)

Use these in JSX class names:

- Backgrounds: `bg-kv-bg`, `bg-kv-bg-alt`, `bg-kv-surface`, `bg-kv-navy`, `bg-kv-teal`
- Text: `text-kv-navy`, `text-kv-muted`, `text-kv-teal`, `text-kv-green`
- Borders: `border-kv-border`, `border-kv-navy`, `border-l-kv-teal`

Raw CSS variable when needed: `bg-[var(--kv-eu-blue)]`, `border-[var(--kv-plate-border)]`

---

## Typography

- **Sans:** Geist (`--font-geist-sans`) - body, headings, UI
- **Mono:** Geist Mono (`--font-geist-mono`) - kenteken plates only (`.kenteken-input`)

### Scale (typical)

| Element | Classes |
| --- | --- |
| H1 (hero) | `text-4xl sm:text-5xl font-bold tracking-tight text-kv-navy` |
| H2 (section) | `text-3xl font-semibold tracking-tight text-kv-navy` |
| H3 (card) | `text-lg font-semibold text-kv-navy` |
| Body | `text-base text-kv-muted` or `text-kv-navy` |
| Small / helper | `text-sm text-kv-muted` |

---

## Layout

- Max content width: `max-w-6xl mx-auto px-6`
- Section padding: `py-16` (hero: `py-16 lg:py-24`)
- Grid gap: `gap-6` or `gap-12` for hero
- Scroll anchor offset: `scroll-mt-24` where needed

---

## Component classes (`globals.css`)

Prefer these over one-off styling.

### `.kv-card`

White card with cool border and soft shadow. Use for forms, feature cards, FAQ items, comparison block.

```html
<div class="kv-card p-6 sm:p-8">...</div>
```

Feature cards add a teal accent: `kv-card border-l-4 border-l-kv-teal p-6`

### `.kv-btn-primary`

Brand gradient button (navy → teal → cyan). Pair with rounded corners and shadow in JSX:

```html
<button class="kv-btn-primary rounded-xl px-6 py-4 shadow-lg shadow-kv-teal/25">
  Vergelijk auto's
</button>
```

Links as buttons: same classes on `<a>`.

### `.kv-badge`

Pill label for hero/tags:

```html
<p class="kv-badge">Vergelijk auto's op kenteken</p>
```

---

## Kenteken plate styling

Shared classes in `app/globals.css`. Used in `kenteken-input.tsx` and `comparison-preview.tsx`.

### Structure

```html
<div class="kv-plate">
  <div class="kv-plate-eu">
    <span class="kv-plate-eu-stars" />
    <span class="kv-plate-eu-code">NL</span>
  </div>
  <input class="kenteken-input kv-plate-field" />
</div>
```

Table chips use `.kv-plate-chip` + `.kv-plate-chip-text` (same EU strip, smaller).

### Tokens

| Token | Hex | Usage |
| --- | --- | --- |
| `--kv-plate-yellow` | `#f7ca00` | Plate body |
| `--kv-plate-yellow-light` | `#ffe066` | Top gradient highlight |
| `--kv-plate-text` | `#111111` | Characters on plate (black, not navy) |
| `--kv-plate-border` | `#111111` | Outer plate border |
| `--kv-eu-blue` | `#003399` | EU strip background |

### Rules

- Plate text is **black** (`--kv-plate-text`), not navy
- Mono font via `.kenteken-input` on the field/chip text
- Wide letter-spacing on plate characters
- Use the full `.kv-plate-eu` strip, not a floating NL badge inside the field
- Focus state: `:focus-within` on `.kv-plate` uses teal ring

---

## Comparison table

- Wrapper: `overflow-x-auto rounded-xl border border-kv-border`
- Header row: `bg-kv-navy text-white`
- Header label column: `text-white/70`
- Body rows: alternate `bg-kv-surface` / `bg-kv-bg/60`
- Row borders: `border-t border-kv-border`
- Empty cells: `-` in `text-kv-muted` (never em dash)

---

## Header & footer

**Header** (`components/site-header.tsx`):

- `border-b border-kv-border bg-kv-surface/95 backdrop-blur`
- Logo: `public/logo.png` via `next/image`, 48×48 rounded

**Footer** (`components/site-footer.tsx`):

- `border-t border-kv-navy bg-kv-navy`
- Text: `text-white/80` and `text-white/60` for secondary line

**Favicon:** `app/favicon.ico`, `app/icon.png` (32×32), and `app/apple-icon.png` (180×180)

---

## Hero background

Subtle brand gradients on `bg-kv-bg` (see `app/page.tsx`):

```html
<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgb(8_168_160_/_16%),transparent_42%)]" />
<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgb(24_56_120_/_10%),transparent_50%)]" />
```

---

## Errors & states

- Error alert: `border border-red-200 bg-red-50 text-red-800`
- FAQ open state: `open:border-kv-teal/30` on `.kv-card`
- Success / checkmarks: `text-kv-green`

---

## Copy & typography rules

- Language: Dutch UI copy, `lang="nl"` on `<html>`
- **Never use the em dash** (Unicode U+2014). Use `-`, `,`, `:`, or rephrase.
- Placeholder kenteken example: `AB-123-C` (not a real user plate)

---

## File map

| File | Role |
| --- | --- |
| `app/globals.css` | CSS variables, `@theme`, component classes |
| `app/favicon.ico` | Browser favicon |
| `app/icon.png` | PNG favicon |
| `app/layout.tsx` | Geist fonts, body defaults |
| `public/logo.png` | Brand logo |
| `components/site-header.tsx` | Site header |
| `components/site-footer.tsx` | Site footer |
| `components/kenteken-form.tsx` | Form + `.kv-card` + `.kv-btn-primary` |
| `components/kenteken-input.tsx` | Plate input styling |
| `components/comparison-preview.tsx` | Comparison table styling |

When adding new UI, extend tokens in `globals.css` first, document here, then use `kv-*` utilities in components.
