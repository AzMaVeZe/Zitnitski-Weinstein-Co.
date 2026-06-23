# Israel International Tax Guide — Project Notes

## What This Is

A static informational website (`index.html` + CSS/JS inline) about international tax considerations for individuals relocating to Israel. Single-file, no build step, no frameworks.

## Audience

English-speaking individuals (primarily US citizens) considering or completing aliyah, or professionals advising them. Assume general financial literacy but no deep tax expertise.

## Voice & Tone

- Professional but accessible — avoid dense legal jargon; explain terms when first used
- Informative, not prescriptive — describe rules, do not tell readers what to do
- Neutral and balanced — acknowledge complexity and edge cases rather than oversimplifying
- Never alarmist, never promotional

## Hard Rules

**Disclaimers are non-negotiable.** Every page and every significant content addition must include or link to the disclaimer section. Never remove or soften the disclaimer language.

**No legal or tax advice.** Do not write in the imperative ("you should," "you must file," "do this") when describing tax obligations. Use descriptive language ("individuals may be required to," "the rule generally provides that"). The site informs — it does not advise.

**No specific numbers without sourcing.** Dollar thresholds, penalty amounts, rates, and deadlines change. Any figure cited must reference the source (IRS publication, ITA circular, specific statute) and should note it may be subject to change.

## Authoritative Sources

Always ground content in official publications. Preferred sources:

- **Israeli Tax Authority (ITA):** [https://www.taxes.gov.il](https://www.taxes.gov.il) — Israeli Income Tax Ordinance (ITO), ITA circulars, and official guidance
- **IRS Publications:** IRS.gov — Publication 54 (Tax Guide for US Citizens Abroad), Publication 514 (Foreign Tax Credit), Publication 4261 (FBAR), and relevant forms/instructions
- **US–Israel Tax Treaty text:** Available via IRS treaty page and US Treasury
- **FinCEN:** fincen.gov — FBAR regulations (31 CFR 1010.350)
- **Israeli Aliyah statute:** Income Tax Ordinance Sections 14, 97(b), and related ITA circulars (e.g., Circular 1/2011 on new immigrants)

When adding or editing factual claims, note the source in a code comment or in the surrounding copy.

## Content Sections

| Section | Topic | Key Statute / Source |
|---|---|---|
| Tax Residency | Center-of-Life test, day-count rules | ITO § 1 (definition of "resident individual") |
| US–Israel Treaty | Double tax relief, withholding rates | US–Israel Income Tax Treaty (1994/1995) |
| Aliyah Benefits | 10-year foreign income exemption | ITO §§ 14, 97(b); ITA Circular 1/2011 |
| Reporting | FBAR, FATCA, Form 8938 | 31 CFR 1010.350; IRC § 6038D; FinCEN 114 |
| Disclaimer | Legal disclaimer | — |

## Technical Constraints

- **`index.html` is single-file** — all CSS and JS inline. Keep it that way unless the user explicitly asks to split it.
- **The calculator is intentionally split across files** (not a rule violation): `calculator.html` (Step 1) and `calculator2.html` (Step 2) share one stylesheet, `calculator.css`, and the Step-2 logic lives in `tax-engine.js` (pure, DOM-free engine) + `calculator2.sections.js` (DOM/UI layer). These load as **classic `<script src>` tags in order — engine first** (they share global scope; do **not** convert to ES modules, which break over `file://`). `calculator.css` is calc2's CSS plus calc1-only rules; calc1's two divergent card-spacing rules are preserved via `body.step1` overrides, so editing shared rules can affect both pages.
- **Capital gains are computed on the nominal gain.** The CPI-indexed real-gain override was intentionally removed from every CG scenario (signed-off simplification) — do not reintroduce it or a `realGain`/`cpiGain` field.
- **In distribution-scaling company sections, an empty ownership-% field reads as 0% (not 100%).** Where `ownership` only scales the dividend/distribution *after* corporate tax (regular Israeli rental, company RE-CG, company shares), `pnOr('..._ownershipPct', 0)` — empty hides only the dividend tier, corporate tax is unaffected; a typed 0 is respected. Do not change back. Income-scaling reads (transparent/Family/House rental, where `ownership` scales gross rent *before* the tax base) keep the `100` default — empty→0 there would zero the rent and blank the result.
- **Interest income is individuals-only.** The §125C 15%/25% capped rates and the substantial-shareholder/employee/special-relations recharacterization to marginal rates apply only to individuals, routed through `interestIndividual` in `tax-engine.js`. A company's Israeli-source interest is ordinary corporate income at the flat 23% rate — fold it into the existing corporate net base (`corporateIsraeli`/`corporateForeign`); never route company interest through `interestIndividual`.
- **A `modeled: false` engine result must never render a computed figure.** Interest connected to an Israeli permanent establishment (`connectedToIsraeliPE`, branch `pe_business_profits`) is re-sourced and taxed as Israeli business profits — outside the passive engine. The UI surfaces the disclosure note for these branches and shows no rate/tax/effective number. Do not add an EXPECT correctness entry for any `modeled:false` branch — drift-lock only.
- **Treaty rates are user-input, never hardcoded.** Israeli withholding on Israeli-source passive income to a foreign resident displays as `min(statutory, treaty)` using a user-entered treaty rate; a treaty is a ceiling, not a floor, so a lower domestic rate or a domestic exemption (e.g. traded-bond / FX-deposit 0%) always wins. Do not build a per-country rate table or hardcode specific treaty figures.
- **No frameworks, CDN dependencies, or build step** — vanilla HTML, CSS, and JS only, referenced by relative paths. The site must work offline (opened directly via `file://`).
- **No cookies, no tracking, no external requests** — do not add analytics, fonts from CDN, or any third-party scripts.
- **Responsive** — must work on mobile. The current layout uses CSS Grid with `auto-fit` columns; maintain this pattern.

## What to Avoid

- Do not add a contact form or any server-side functionality
- Do not link to or recommend specific law firms, accountants, or services
- Do not state that any particular strategy "works" or "is safe" — use hedged language
- Do not describe enforcement priorities or suggest any approach to non-compliance other than the IRS Streamlined Procedures (which are official and publicly documented)
- Do not add content about countries other than the US–Israel context without explicit instruction
