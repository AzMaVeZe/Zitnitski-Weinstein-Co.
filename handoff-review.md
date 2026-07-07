# Handoff review

## Part 1 — State & known findings

Reviewed 2026-07-03. Read-only pass; nothing was edited, staged, or committed by this review.

### Git state

`git log --oneline -15`:

```
1ed323a Add Ind_Shares_CG section UI, FTC breakdown, and routing
77a4217 Add Selling Shares activity option to Step 1 (individual-only)
d235ccc Add sharesIndividualCG engine function and EXPECT tests (101 cases)
4c0364e Add StockOptions section UI, initStockOptions routing, and disclosures
ebfbafb Add Stock Options / RSUs option to Step 1 (individual-only)
159ea3c Add section102 engine function and EXPECT tests (89 cases)
c5a7d7f Bring Ind_Crypto disclosure notes to parity and elevate sourcing note to amber
4194a55 Add over60 and otherAnnualIncome inputs to Ind_Interest rechar branch
2750cfd Add Ind_Crypto section UI and initIndCrypto routing
2560b2b Add Crypto asset option to Step 1 (individual-only)
934b1b4 Add cryptoIndividual engine function and EXPECT tests (76 cases)
337c413 Smoothly animate top-level section collapse and lift its scroll target
799d474 Untrack unrelated spec, ignore tooling scratch, document interest rules
ca3b9d5 Build Ind_Interest section UI over interestIndividual engine helper
06f0c62 Add Israeli-PE carve-out to interest engine; PE-connected returns not-computed
```

`git status`: on branch `master`, up to date with `origin/master`. Nothing staged. Four files modified but not staged: `.gitignore`, `calculator.css`, `calculator.html`, `calculator2.html`. No untracked files (`audit-report.md` exists on disk but is ignored by the working-tree `.gitignore`).

**Ind_Shares_CG FTC-breakdown-row work: COMMITTED.** It is part of HEAD (`1ed323a`, "Add Ind_Shares_CG section UI, FTC breakdown, and routing"):

- `git show HEAD:calculator2.html` contains `shcg_ftcRow` (line 952), `shcg_statutoryOut` (955), `shcg_foreignOut` (959), `shcg_netOut` (963), `shcg_totalBurdenOut` (967). Working-tree lines are 954/957/961/965/969 (shifted +2 by an uncommitted, unrelated hint line — see below).
- `calculator2.sections.js` is clean (no working-tree diff), so its wiring is committed: ids referenced at lines 1082, 1087, 1141, and 1169–1173.

The uncommitted `calculator2.html` diff does NOT touch the FTC row itself; it changes the hero badge (line 19) and adds three new `input-hint` explainer lines under the effective-rate rows (working lines 680, 815, 976).

### Test suite

`node tax-engine.test.cjs` summary line:

```
SUMMARY: 101 cases | regression drift: 0 | EXPECT checks: 95 (fail 0) | engine≠EXPECT: 0
```

Matches expected (101 cases, drift 0, EXPECT 95, fail 0). No Critical.

### Known findings — verification

An **uncommitted fix pass** sits in the working tree that already addresses findings (a), (c), and (d). Several findings as previously described are therefore stale — verdicts below distinguish HEAD vs working tree.

**(a) Stale hero badge / "two quick questions" — TRUE AT HEAD, ALREADY FIXED (UNCOMMITTED) IN WORKING TREE.**
- HEAD: `calculator.html:19` and `calculator2.html:19` both read `<div class="hero-badge">🏠 Real Estate Tax</div>`; `calculator.html:21` reads "Answer two quick questions…".
- Working tree: badge is now `🧮 Israel Tax Calculator` in both files (line 19), and `calculator.html:21` reads "Answer a few quick questions…". The fix exists only as an unstaged diff.

**(b) `israel_tax_calculator_prompt.md` tracked — ⚠️ NOT AS DESCRIBED / STALE FINDING.** The file is NOT tracked: `git ls-files | grep israel_tax_calculator_prompt` returns nothing. It was untracked in commit `799d474` ("Untrack unrelated spec, ignore tooling scratch…") and is listed in `.gitignore` (line 8). The file still exists on disk, ignored. No action needed.

**(c) Dead CSS `.active-bracket` and `.track-inputs` — TRUE AT HEAD, ALREADY DELETED (UNCOMMITTED) IN WORKING TREE.**
- HEAD `calculator.css`: `.active-bracket` rules at lines 166–174, `.track-inputs` at 262–265 plus `@media` at 266. Zero references to either class in any HTML/JS file — confirmed dead.
- Working tree: both groups already removed (the 14-line deletion in the unstaged `calculator.css` diff).
- As instructed, `.cg-flag-yes`, `.cg-flag-no`, `.two-col`, `.filled` were not flagged (they are referenced).

**(d) `.gitignore` lacks `.claude/` and `audit-report.md` — ⚠️ NOT AS DESCRIBED, but with a real nuance.** HEAD `.gitignore` DOES contain `.claude/` (line 7) and an `audit-report.md` line (line 9). However, the HEAD line is `audit-report.md          # uncommitted audit scratch from the read-only sweep` — gitignore comments only start at the beginning of a line, so the trailing `#` text is part of the pattern and the HEAD entry does NOT actually ignore `audit-report.md`. The unstaged `.gitignore` diff fixes this by moving the comment to its own line; with the working-tree version, `audit-report.md` is correctly ignored (confirmed: `git status` shows no untracked files despite `audit-report.md` existing).

**(e) Route to tax AI — 10-year exemption reporting claim.** `index.html:573` asserts, for the Sections 14/97(b) 10-year new-immigrant exemption: "No reporting to Israeli tax authorities is required for this exempt income during the exemption period." **Check against ITO Amendment 272 (2024)**, which may have repealed the reporting exemption for residents arriving from 2025 — if so, this sentence is wrong for new arrivals and needs a date-qualified rewrite. Copy left unchanged per instructions.

### Notes for later parts

- The four-file unstaged diff is a coherent "audit fixes + result-hint copy" pass: hero badges (a), dead CSS removal (c), `.gitignore` comment fix (d), plus three new `input-hint` lines in `calculator2.html` (working lines 680, 815, 976) that were not part of any previously described finding and should be reviewed on their own merits before committing.
- `audit-report.md` exists in the repo root on disk (ignored, untracked).

## Part 2 — Ship list & link integrity

Reviewed 2026-07-05 against the working tree (HEAD `1ed323a` plus the four-file unstaged diff). Read-only pass; nothing was edited, staged, or committed by this review. Findings were produced by a per-page extraction fan-out plus an independent adversarial re-scan using different search patterns; the re-scan surfaced zero missed references and zero incorrect claims.

### 1. Deployable set — CONFIRMED

`git ls-files` returns exactly 10 tracked files. The deployable set is exactly the six intended files; each exists on disk, is tracked, and its on-disk filename matches the tracked name character-for-character (exact case — relevant if the site is ever hosted on a case-sensitive server):

**DELIVER:** `index.html`, `calculator.html`, `calculator2.html`, `calculator.css`, `tax-engine.js`, `calculator2.sections.js`

**DO-NOT-DELIVER** (every other tracked file):

| Tracked file | Why not shipped |
|---|---|
| `.gitignore` | Git tooling config, not part of the site |
| `CLAUDE.md` | Project instructions (internal documentation) |
| `tax-engine.baseline.json` | Regression baseline for the test harness |
| `tax-engine.test.cjs` | Node test harness, development-only |

⚠️ **Prompt-list discrepancies** (consistent with Part 1 finding (b)): `audit-report.md` and `israel_tax_calculator_prompt.md` are **not tracked** — both exist on disk and both are ignored (working-tree `.gitignore` lines 10 and 8 respectively) — and **nothing under `.claude/` is tracked** (the directory exists on disk, untracked/ignored). Those three cannot leak through a git-based deploy; they are only a risk in a naive copy-the-folder deploy. Also on disk: `handoff-review.md` (this file) is untracked and **not** ignored (shows as `??`) — exclude it from any delivery as well.

### 2. calculator2.html `<script src>` tags — BOTH RESOLVE, ENGINE FIRST

- `calculator2.html:2316` → `<script src="tax-engine.js">` — file exists, exact-case name match.
- `calculator2.html:2317` → `<script src="calculator2.sections.js">` — file exists, exact-case name match.

Classic scripts (no `type="module"`), engine loaded before the UI layer — matches the CLAUDE.md ordering requirement for `file://` operation.

### 3. Link integrity across all three pages — NO BROKEN REFERENCES

Every relative `href`/`src`/JS-navigation target resolves to an existing file with an exact-case name match, and **no page contains any external URL reference** (no http/https/mailto/tel anywhere in the three HTML files).

**index.html** (fully self-contained; two inline `<script>` blocks at lines 371 and 963, zero `<script src>`):
- Line 398 → `calculator.html` (nav-bar link) ✓; line 412 → `calculator.html` (hero CTA) ✓.
- Nine `href="#…"` in-page anchors (nav brand + six section links + explore CTA) — in-page only.
- The one `url(...)` at line 79 is a `data:image/svg+xml` URI (inline SVG background); the `http://www.w3.org/2000/svg` inside it is the SVG xmlns namespace, not a network request.

**calculator.html** (zero `<script src>`; single inline script at lines 114–197):
- Line 7 → `calculator.css` (stylesheet) ✓; lines 13, 14 → `index.html` (nav links) ✓.
- Line 195 → `calculator2.html` via `window.location.href` (Step 1 → Step 2 JS navigation) ✓.

**calculator2.html** (no inline scripts; no `<style>` blocks):
- Line 7 → `calculator.css` ✓; line 13 → `index.html` ✓; line 14 → `calculator.html` ✓; line 2306 → `calculator.html` (fallback "go back" link) ✓.
- Lines 2316–2317 → the two script tags per §2 ✓.

Bonus sweep beyond the requested scope: `calculator.css` contains exactly one `url(...)` (line 120, a data-URI select-dropdown chevron) and no `@import`; `tax-engine.js` and `calculator2.sections.js` contain no URLs, no fetch/XHR/WebSocket, no dynamic `import()`, and no dynamic script/image loading. The whole deliverable set is consistent with the no-external-requests / offline-`file://` constraints.

### Notes for later parts

- All line numbers in this section are working-tree; the unstaged `calculator2.html` diff shifts committed line numbers by a few lines in places (see Part 1).

## Part 3 — Consistency & compliance

Reviewed 2026-07-05 against the working tree (HEAD `1ed323a` + unstaged diff). Read-only; nothing edited, staged, or committed. Method: six focused finder agents plus an independent adversarial verification pass that re-checked every claim at its cited line — 22 findings CONFIRMED, 1 PARTIAL (counts corrected below), 0 refuted, and 3 additional items the verifier surfaced are folded in. All line numbers are working-tree.

### Findings index

| ID | Sev | Where | One-liner |
|---|---|---|---|
| P3-C1 | Critical | calculator2.sections.js:2178 | Foreign-co dividend treaty figure not capped at statutory rate — violates CLAUDE.md min(statutory, treaty) |
| P3-H1 | High | calculator2.html:680 | New (uncommitted) interest effective-rate hint mischaracterizes the rendered figure |
| P3-H2 | High | calculator2.sections.js:917 | FTC breakdown shows a ₪0 credit block in Interest/Crypto/Dividends but hides it in Shares-CG |
| P3-H3 | High | calculator2.html:841 | High-income surtax disclosed four different ways across four sibling sections (twice in Crypto) |
| P3-H4 | High | calculator2.html:983 | Unsourced specific figures in visible copy (₪721,560 ×3; 10%/1994 ×4; 2009 date) — CLAUDE.md hard rule |
| P3-M1 | Medium | calculator2.html:510 | Individual Dividend still has a bare "Effective Rate" label with no denominator hint |
| P3-M2 | Medium | calculator2.html:954 | shcg_ftcRow placed above the Effective-rate row; Interest/Crypto place it below |
| P3-M3 | Medium | calculator2.html:537 | Foreign-resident/treaty caveat is a muted footer in Dividends but an amber box in Shares-CG |
| P3-M4 | Medium | calculator2.html:780 | Crypto security-token carve-out is a tiny input-hint while lesser caveats are amber |
| P3-M5 | Medium | calculator2.sections.js:1382 | StockOptions "figure is provisional" warning uses the neutral tier; amber used for lesser notes |
| P3-M6 | Medium | calculator2.html:478 | "Foreign tax withheld" is a % in three sections, a ₪ amount in two; labels split paid/withheld |
| P3-M7 | Medium | calculator2.html:477 | shares_foreignWithheld always visible; every sibling FTC input is conditionally hidden |
| P3-M8 | Medium | calculator2.html:589 | Treaty label drift: "Treaty rate (%)" vs "Treaty withholding rate (%)" |
| P3-M9 | Medium | calculator2.html:2206 | Treaty hint drift: ceiling explanation and terminal period missing in coforsh hint |
| P3-M10 | Medium | calculator2.sections.js:2177 | Typed 0% treaty rate shows a ₪0 row in Interest, nothing in foreign-co dividends |
| P3-M11 | Medium | CLAUDE.md:52 | Nominal-gain bullet doesn't document the Ind_Shares_CG indexed-basis convention its UI copy describes |
| P3-L1 | Low | calculator2.html:680 | The three denominator hints exist only as uncommitted edits (commit requires hunk-level staging) |
| P3-L2 | Low | calculator2.html:691 | FTC block source comments inconsistent/missing |
| P3-L3 | Low | calculator2.html:957 | shcg FTC value-span id scheme diverges from intr_/cryp_ convention |
| P3-L4 | Low | calculator2.html:439 | Consult-footer margin-top mixes 1rem and .75rem (incl. the identical RE-CG twins) |
| P3-L5 | Low | calculator2.html:840 | Note tiers are duplicated inline style strings (amber ×10, blue ×13+1) instead of classes |
| P3-L6 | Low | calculator2.html:480 | Twelve income-wrap inputs repeat inline `padding:.65rem .9rem` to dodge the prefix-assuming CSS rule |

### 1. Effective-rate labels (Ind_Interest / Ind_Crypto / Ind_Shares_CG)

**Confirmed:** all three sections render the identical bare label "Effective rate" — `calculator2.html:677` (`intr_effectiveDisplay`), `:812` (`cryp_effectiveDisplay`), `:973` (`shcg_effectiveDisplay`) — over three different formulas. **One correction to the brief:** the interest formula as *rendered* is not (foreign+Israeli)/amount. The engine computes that FTC-inclusive field (`tax-engine.js:246`) but the UI never displays it — `calculator2.sections.js:906–909` renders `headlineTax / r.amount`, where on FTC branches `headlineTax = r.israeliTax` = **net Israeli tax after the credit** (`tax-engine.js:213`). Crypto renders the engine's (foreign+Israeli)/gain (`tax-engine.js:313`, rendered at sections.js:1034) and Shares-CG renders net-Israeli/proceeds (`tax-engine.js:395`, deliberate per-spec comment, rendered at sections.js:1163) — both as described and signed off.

The label-differentiation fix already exists in the **uncommitted working tree**: three static `input-hint` lines at `calculator2.html:680/815/976` (the same three lines Part 1 flagged as unreviewed). The crypto and shares hints accurately describe their formulas. The interest hint does not:

- **P3-H1 · High · calculator2.html:680.** The new hint reads "As a share of the interest amount. Includes credited foreign tax where a foreign tax credit applies." — but the adjacent figure *excludes* credited foreign tax (worked example: ₪1,000 foreign-source interest, 15% withheld → row shows 10.0%, not 25%; the combined burden appears only in the "Total tax paid (foreign + Israeli)" row, html:705). *Why it matters:* the caption added to remove confusion introduces a factually wrong description of a computed figure, and the identical wording is true in the crypto section, making it look authoritative. Whether the row *should* instead render the engine's FTC-inclusive field → **Route to tax AI** (display of a computed number). *Fix prompt (copy-level only):* "In calculator2.html ONLY, replace the input-hint under the Interest Effective-rate row (~line 680) with: 'As a share of the interest amount. Where a foreign tax credit applies, this is the net Israeli tax after the credit — the combined burden appears in the "Total tax paid (foreign + Israeli)" row below.' Do NOT modify tax-engine.js, calculator2.sections.js, any other hint, or any displayed number."
- **P3-M1 · Medium · calculator2.html:510.** Individual Dividend is now the only individual passive section with a bare "Effective Rate" label (id `shares_effective`, :511) and no denominator hint; its figure is FTC-inclusive totalBurden/dividend (sections.js:753). *Fix prompt:* "In calculator2.html ONLY, add a hint under the Individual Dividend 'Effective Rate' metric (~lines 507–512), matching the crypto hint pattern: 'As a share of the dividend. Includes credited foreign tax where a foreign tax credit applies.' Match surrounding metric-grid markup; change no JS, labels, or values."
- **P3-L1 · Low.** The three hints exist only as uncommitted hunks (`@@ -677`, `@@ -811`, `@@ -971` vs HEAD). If the repo is handed off from HEAD, the ambiguity ships. **Caution from the verifier:** the same uncommitted calculator2.html diff contains a fourth hunk (hero badge, line 19), so "commit only the hints" requires `git add -p` hunk-level staging, and P3-H1's copy correction should land first.

Completeness map (facts, no action): every other section's effective-rate label or adjacent note already names its base — RE-CG "Effective rate on gain" (:271/:291/:428), rentals over gross rent (:103/:122/:141), StockOptions totalTax/gain (:1133), company sections "on net"/"on gross"/"on gain" (:1251, :1880, :1455 etc.). Title-case "Effective Rate" in metric grids vs sentence-case "Effective rate" in track rows is a per-component convention, not drift.

### 2. Cross-section drift (FTC rows, tiers, liveComma, treaty inputs, advisor notes)

**FTC row labels — PASS.** All four labels match verbatim across Interest (:693–705), Crypto (:819–831), Shares-CG (:956–968): "Gross Israeli tax", "Foreign tax credited", "Net Israeli tax owed", "Total tax paid (foreign + Israeli)". Population logic in sections.js is the same four `fmt()` expressions in all three (917–923, 1036–1042, 1168–1174).

- **P3-H2 · High · calculator2.sections.js:917.** Zero-foreign-tax behavior differs: the frozen engine sets `ftcActive=true` unconditionally for Israeli-resident foreign-source interest (`tax-engine.js:214`) and all Israeli-resident crypto (`:296`), but gates shares-CG on `foreignWithheld > 0` (`:383`); the UI gates only on the flag. So an empty foreign-tax field shows a redundant ₪0 credit block in Interest and Crypto but nothing in Shares-CG. **Verifier addition:** the Individual Dividend section behaves like Interest/Crypto (`sections.js:745`, `shares_ftcBreakdown` html:516–533) — a fix limited to Interest+Crypto would leave Dividends as the sole ₪0-block section. *Why it matters:* three-way behavioral inconsistency across parallel sections; the numbers are correct, so it is presentation-only, but the flag lives in the frozen engine, so any fix must stay in the UI layer. *Fix prompt:* "READ CLAUDE.md first. In calculator2.sections.js ONLY, align FTC-breakdown visibility with the Shares-CG convention (hide when no foreign tax): change the display gates to `if (r.ftcActive && r.foreignWithheld > 0)` at ~917 (Interest), ~1036 (Crypto), and the equivalent gate in the Dividend section (~760, shares_ftcBreakdown). No engine edits, no changes to displayed values. Verify over file://: empty foreign-tax field → no breakdown; nonzero → identical to before."
- **P3-M2 · Medium · calculator2.html:954.** `shcg_ftcRow` sits *between* "Tax owed" and "Effective rate"; Interest and Crypto place the block *after* the effective-rate row. The shares hint (:976) says "shown separately in the breakdown **above**". *Fix prompt:* "In calculator2.html ONLY, move the `shcg_ftcRow` block (954–971 incl. its comment on 953) to after the Effective-rate row + hint (after 976), matching intr_/cryp_ order, and change the hint's 'breakdown above' to 'breakdown below'. No id/label/JS changes."
- **P3-L2 / P3-L3 · Low.** Source comments above the three blocks are inconsistent ("paid" :953 vs "withheld" :816 vs none before :691); shcg value-span ids (`shcg_statutoryOut/foreignOut/netOut/totalBurdenOut`) diverge from the `*_grossTax/foreignTax/netTax/totalBurden` convention. Mechanical unification prompts are in the workflow output; both are non-user-visible.

**Disclosure tiers.** As built: amber tier = `.foreign-notice` (calculator.css:318), `.bl-note` (:302), plus an inline amber paragraph style; neutral = inline blue info style on the JS-populated `#*_note` elements, muted centered footers, and `.input-hint`. All JS-injected branch notes consistently land in the blue tier. **Advisor notes — PASS:** all eight individual sections end with the identical "Consult a tax advisor for your exact liability." (:151, :305, :439, :537, :714, :842, :983, :1143); none missing.

- **P3-H3 · High · calculator2.html:841.** The surtax is disclosed four different ways across four adjacent sections: Crypto has a standalone amber box ("3% base plus an additional 2%…") *plus* a footer mention (double disclosure, :841/:842); Shares-CG folds "5% on the capital-gains portion" into its footer (:983); StockOptions "5% … and 3% on the employment-income portion" (:1143); Interest just says "and the high-income surtax" with no threshold (:714). The 3%+2% vs 5% framings describe the same total but read as different rules. *Why it matters:* looks like three different surtax regimes; the receiving company can't tell which presentation is canonical. **Canonical phrasing → Route to tax AI**; placement/tier harmonization is copy-level. *Fix prompt:* "In calculator2.html only, after the tax reviewer confirms the canonical surtax description (do not change ₪721,560 or any rate), harmonize the surtax disclosure across ~841–842, ~983, ~1143, ~714 into ONE pattern (recommend the muted footer, as Shares-CG/StockOptions already do) and remove Crypto's duplicate amber box."
- **P3-H4 · High · calculator2.html:983 (et al.).** CLAUDE.md hard rule: "No specific numbers without sourcing." Unsourced figures in visible copy, no source comment anywhere: ₪721,560 at :841, :983, :1143; "pre-1994 inflationary portion taxed at 10% (post-1994 exempt)" in four identical amber notes at :1489, :1618, :2073, :2162 (verifier addition); "acquired on or after 1 January 2009" at :2256 (verifier addition). *Why it matters:* year-indexed figures will silently go stale; the company inherits no trail of which tax year they reflect. Figures themselves are frozen — only sourcing may be added. *Fix prompt:* "In calculator2.html only, add HTML source comments (not visible text) above each figure-bearing note at ~841, ~983, ~1143 (surtax: ITO §121B — confirm exact reference with the tax reviewer; note annual indexation) and ~1489, ~1618, ~2073, ~2162, ~2256 (inflationary-gain and 2009 acquisition rules). Change no visible copy, no numbers, no code."
- **P3-M3 · Medium · :537 vs :982.** The foreign-resident/treaty caveat is a muted footer sentence in Dividends but a prominent amber box in Shares-CG. *Fix prompt:* "In calculator2.html, Ind_Shares section: move 'Foreign residents: treaty rates may substantially reduce the withholding shown.' from the footer (~537) into its own amber note above the footer, using the exact inline amber style from line 982. Footer's other sentences unchanged."
- **P3-M4 · Medium · :780.** Crypto's security-token carve-out ("a different rate may apply") is a tiny `.input-hint` while weaker caveats in the same section are amber. *Fix prompt:* "In calculator2.html Ind_Crypto, restyle the security-token paragraph at ~780 to the amber note style used at line 840. Text unchanged."
- **P3-M5 · Medium · sections.js:1382.** The one note saying the rendered figure is provisional (listed-at-grant, missing 30-day average → whole gain shown at CG rate) is injected into the neutral blue `#so_note`, while non-figure-affecting caveats (:1141–1142) are amber — tier inversion. *Fix prompt:* "UI-only: in initStockOptions (~1382), toggle #so_note to the amber presentation while this specific prompt is shown; restore blue for regular NOTE[branch] texts. Do not touch section102() or any computed value."
- **P3-L4 · Low.** Footer margin-top mixes `1rem` (:151, :305, :537, :1284, :1904) and `.75rem` (12 others), including the otherwise byte-identical RE-CG twin footers (:305 vs :439). Normalize to `.75rem` (majority).
- **P3-L5 · Low (PARTIAL-corrected).** Both note tiers are duplicated inline style strings; the verifier corrected the finder's counts: the amber string occurs **10×** (438, 840, 841, 982, 1141, 1142, 1489, 1618, 2073, 2162) and the blue string **13×** (536, 713, 839, 981, 1140, 1357, 1488, 1617, 1775, 1977, 2072, 2161, 2296) plus a variant at 1219 — a fix must cover all instances or it worsens the inconsistency. *Fix prompt:* "Zero-visual-change refactor: add `.note-info` and `.note-warn` classes to calculator.css (values per the existing inline strings), then replace ALL 10 amber and 13(+1) blue inline style strings in calculator2.html at the lines above with the classes, preserving any display:none. Stylesheet is shared with calculator.html — add classes, don't edit existing rules."

**liveComma — PASS.** All **73** `inputmode="decimal"` inputs in calculator2.html are wired by the single selector at `calculator2.sections.js:148` (runs in showSection on DOMContentLoaded; the storage read above it is try/catch-wrapped so it always executes; no inputs are created dynamically). No input is wired without the attribute (wiring is selector-driven). The 10 `type="number"` percent fields and 6 DD/MM/YYYY text fields are correctly excluded — load-bearing, since liveComma strips `/` and `setSelectionRange` throws on number inputs. calculator.html has only `<select>`s. Verifier recount matched: 73 decimal, 10 number, 6 date.

- **P3-M6 · Medium · :478 et al.** "Foreign tax withheld" is a **percent** in Dividends (:478), Interest (:598), Co-IL-Shares (:1672) but a **₪ amount** in Crypto (:769, "withheld") and Shares-CG (:897, "paid") — same-named field, different units; the two ₪ fields even share an identical hint while splitting paid/withheld in the label. Unit harmonization maps to frozen engine signatures (`foreignWithheldPct` vs `foreignWithheld`) → **Route to tax AI**; only labels are safely alignable now. *Fix prompt:* "In calculator2.html ONLY (keep all ids/types/inputmode): change the label at ~897 from 'Foreign tax paid' to 'Foreign tax withheld (₪ amount)' and at ~769 from 'Foreign tax withheld' to 'Foreign tax withheld (₪ amount)'. Leave the three '(%)' labels untouched."
- **P3-M7 · Medium · :477.** `shares_foreignWithheld` is always visible (plain `<div class="field">`), relying on hint copy, while all four sibling FTC inputs are conditionally shown (sections.js:863, :994, :1123, :2045); a typed value is silently ignored on non-qualifying branches. *Fix prompt:* "Visibility only, no tax computation changes: in calculator2.html give the wrapper at ~477 `id="shares_foreignWithheldField" style="display:none"`; in calculator2.sections.js runSharesCalc (~710) toggle it shown only when residency==='israeli' && source==='foreign' && !oleh (the only branch that reads it, ~747), mirroring line 1123; drop the now-redundant 'Only applies to…' hint sentence at ~482."
- **P3-L6 · Low.** Twelve non-prefixed income-wrap inputs repeat `style="padding:.65rem .9rem;"` (480, 591, 600, 1032, 1039, 1198, 1424, 1553, 1648, 1674, 1838, 2204) to compensate for `.income-wrap input`'s prefix-assuming `.2rem` left padding (calculator.css:141–143) — undocumented magic; a `.no-prefix` class would single-source it.

**Treaty-rate inputs.** Exactly two exist: `intr_treatyPct` (:591) and `coforsh_treatyPct` (:2204). Attribute parity is clean (both `type="number" min="0" max="100" placeholder="optional"`, no step/value). No hardcoded per-country table or bilateral figure anywhere in the three JS/HTML files; the only treaty numbers are hedged examples ("about 5% … or about 15% … depends on the specific treaty") in `#coforsh_treatyNote` (:2296) — noted as the one candidate for further sourcing under the no-numbers rule.

- **P3-C1 · Critical · calculator2.sections.js:2178.** The foreign-company dividend treaty figure is computed in the DOM layer as `(treatyPct/100) * dividend`, clamped only 0–100 (:2175) with **no cap at the statutory rate** (0.25/0.30, :2164); the verdict string (:2191) repeats the uncapped figure. Entering 40% against a 25% statutory rate renders a "treaty-reduced" withholding *higher* than statutory. The Interest path does it correctly (`Math.min(0.25, …)`, tax-engine.js:188). *Why it matters:* direct violation of CLAUDE.md's frozen rule ("a treaty is a ceiling, not a floor; displays as min(statutory, treaty)") that can render a wrong-direction computed figure. **Because it changes a displayed computed number, route for tax sign-off before applying — but the correct behavior is already specified in CLAUDE.md and the code lives in the DOM layer, not the engine.** *Fix prompt:* "In calculator2.sections.js initCoFORShares → runDividend (~2174–2191): cap the treaty withholding at the statutory rate already computed as `rate` — `Math.min(treatyPct/100, rate) * dividend` — and use the same capped figure in the verdict string at ~2191. Do not modify tax-engine.js, the 25%/30% rates, or any other section. Flag for tax sign-off before committing since it changes a displayed number."
- **P3-M8 / P3-M9 · Medium.** Label drift ("Treaty rate (%)" :589 vs "Treaty withholding rate (%)" :2202) and hint drift (:593 explains the ceiling rule and ends with a period; :2206 does neither). Align both to the Interest wording (prompts in workflow output).
- **P3-M10 · Medium · sections.js:2177.** A typed 0% treaty rate (full exemption) shows a computed ₪0 row in Interest (raw-empty check at :871/:883 + engine `>= 0` at tax-engine.js:187) but nothing in coforsh (`if (treatyPct > 0)`; `pn()` returns 0 for both empty and "0"). *Fix prompt:* "In calculator2.sections.js runDividend (~2174–2186): gate the treaty row on `raw !== ''` (mirroring Interest, ~871) instead of `treatyPct > 0`, so an explicit 0% renders ₪0/0.0%. Coordinate with the P3-C1 cap fix in the same function."

### 3. CLAUDE.md compliance — Ind_Shares_CG + shareActivity (newest code)

All six requested checks **PASS** mechanically:

- **id-parity:** calculator2.html defines exactly 23 `shcg_*` ids (section spans :853–986); calculator2.sections.js references exactly the same 23 (≈:1079–1185); set-difference empty both ways. `shareActivity`: markup (calculator.html:93–95), inline script (:132 setVisible, :192 read, :194 stored in `taxForm`), Step-2 read + routing (sections.js:78, :97, :105 → `Ind_Shares_CG` for `capital_gain`, :163 dispatch) all agree; missing/legacy value falls back to the dividend section by design.
- **label[for]:** all five `for=` targets in Ind_Shares_CG resolve; the two checkboxes use wrapping labels (valid, no orphans). `label for="shareActivity"` resolves.
- **Duplicate ids:** zero duplicates in calculator.html (12 ids), calculator2.html (396 ids), index.html (10 ids) — whole-file extraction, verifier re-ran independently.
- **Load order:** engine first (:2316 → :2317), classic scripts.
- **Statute leak:** no §/Section/97(b)/102/125C strings in Ind_Shares_CG or shareActivity visible copy; statute refs live in engine comments only (tax-engine.js:320–336, which itself states "Statute refs live in comments only"). **Observation for a company ruling (not a finding):** the Step-1 dropdown option "Stock Options / RSUs (Sec. 102)" (calculator.html:58) and the track labels "102 Capital Gains (trustee)" etc. (calculator2.html:1022–1025) sit inside the approved §102/3(i) exception, but the Step-1 dropdown is visible to every user — confirm the carve-out covers it.
- **Disclaimers intact:** index.html full disclaimer section (:933, heading :937, footer :958, TOC link :397); calculator.html footer (:111); calculator2.html footer (:2313).

Two compliance findings:

- **P3-H4** (above) — the unsourced ₪721,560/5% figures include this section's own footer (:983).
- **P3-M11 · Medium · CLAUDE.md:52.** CLAUDE.md's "nominal gain only — do not reintroduce indexing" bullet doesn't document the Ind_Shares_CG convention its UI copy advertises: html:875 "Share gains are taxed on the real (inflation-adjusted) gain — the inflationary portion since 1994 is exempt", label :870 "Indexed (CPI-adjusted) Cost Basis", sections.js:1076 "The real gain is taxed at the capital-gains rate." The engine stays nominal (`gain = max(0, proceeds − costBasis)`, tax-engine.js:346) — the real gain deliberately lives in the user-supplied input (engine comment block :320–336 even points at CLAUDE.md, which is silent). *Why it matters:* a maintainer reading the rule next to the live copy will conclude one is a bug and may "fix" either direction — including adding engine indexing. *Fix prompt (doc-only):* "In CLAUDE.md only, extend the nominal-gain bullet with one sentence: the Ind_Shares_CG section asks for an already-CPI-indexed cost basis and the engine still computes proceeds − costBasis with no indexing machinery — the real gain lives in the input, never the engine (see the sharesIndividualCG comment block); do not add engine indexing to 'match' the UI copy. No code changes. Rewording the visible '1994' sentence itself is tax-substantive — route to the tax AI first."

### Route to tax AI (Part 3 bucket)

1. **P3-C1 sign-off:** cap the coforsh dividend treaty figure at min(statutory, treaty) — behavior already specified in CLAUDE.md; changes a displayed number.
2. Whether the Interest effective-rate row should render the engine's FTC-inclusive `effective` field (tax-engine.js:246, currently unused) instead of net-Israeli/amount — display choice of a computed figure.
3. Canonical surtax phrasing: "3% base plus an additional 2%" vs "5% on the capital-gains portion" (and confirm ITO §121B as the source reference for the ₪721,560 comments).
4. Foreign-tax-withheld unit harmonization (% vs ₪ maps to frozen engine signatures foreignWithheldPct/foreignWithheld).
5. The visible claim "the inflationary portion since 1994 is exempt" (html:875) and the 10%/1994 and 2009 figures (:1489 etc., :2256), if ever reworded.
6. Whether the dividends section should gain a treaty-rate input like Interest/coforsh (currently discloses treaty relief as footer text only) — computation change, out of copy scope.

### Notes

- The two finder-reported sourcing findings (₪721,560 from the tiers finder and from the compliance finder) were the same defect and are merged into P3-H4.
- Verifier cautions for whoever applies fixes: line anchors are working-tree (uncommitted calculator2.html diff has four hunks including the hero badge); P3-H2's fix must include the Dividend section or the inconsistency survives; P3-L5's fix must cover the corrected 10+13(+1) instances.

## Part 4 — Copy review

Reviewed 2026-07-05 against the working tree. Read-only; nothing edited, staged, or committed. Method: one full-page copy scan per HTML file, a cross-page terminology/title/meta agent, and a scripted emoji inventory, followed by an adversarial verification pass that re-checked **every** finding at its cited line. Score: of 69 copy findings, **66 CONFIRMED, 3 PARTIAL, 0 REFUTED**; all 12 terminology pairs confirmed; the emoji inventory was reproduced **exactly** by an independent second method. All line numbers are working-tree. Scope caveat: this part covers the three HTML files only — the many user-visible strings injected at runtime by `calculator2.sections.js` (verdicts, badges, branch notes) were NOT audited and should get the same sweep before handoff.

### A. High-severity findings

| ID | Where | Cat | Finding |
|---|---|---|---|
| P4-H1 | index.html:617 | advice-voice | "Continue to earn foreign income tax-free in Israel." — second-person imperative + promotional "tax-free". → "Foreign-source income remains exempt from Israeli tax throughout this period." |
| P4-H2 | index.html:624 | advice-voice | "Consider restructuring foreign holdings, trust arrangements, or timing of asset disposals." — imperative tax-planning advice, a direct no-advice violation. → "Some individuals review the structure of foreign holdings, trust arrangements, and the timing of asset disposals at this stage." |
| P4-H3 | index.html:874 | typo | "The catch-all for domestic vendors or undefined deals is withheld at 30%." — subject-verb mismatch (the category isn't withheld; payments are) + informal. → "Payments in the residual category — domestic vendors or unclassified transactions — are subject to withholding at 30%." |
| P4-H4 | index.html:691 | factual | FBAR non-willful penalty stated as "$10,000/year **per account**" — contradicts *Bittner v. United States* (2023): per report, not per account; amounts also inflation-adjust. → "Up to $10,000 per report … (amounts subject to periodic inflation adjustment)". **Route to tax AI** (cited figure; verify before edit). |
| P4-H5 | index.html:573 (+610) | factual | "No reporting to Israeli tax authorities is required for this exempt income" — likely stale after the 2024 legislation removing the reporting (not tax) exemption for residents arriving from mid-2025. Same claim repeats at :610. Already logged as Part 1(e); **Route to tax AI** with a date-qualified rewrite. |
| P4-H6 | calculator2.html:1846 | typo | Option text "File Israeli return — taxed on 23% of net" reads as if the *base* were 23% of net income. → "File an Israeli return — taxed at 23% on net income". (Describes the actual computation; confirm wording with tax reviewer since it characterizes a rate.) |

**Verifier-caught factual items the first pass missed (both Route to tax AI):**

- **P4-H7 · index.html:447.** The day-count presumption is misstated: page says "30+ days current year and 425+ days over **prior 2 years**", but the ITO §1 test counts the 425 days over the current year **plus** the two preceding years (current-year days count toward the 425). As written, 200 days this year + 300 over the prior two fails the page's version but meets the actual test. Suggested: "30+ days in the current year and 425+ days in total over the current and two preceding years."
- **P4-H8 · index.html:494.** "17.5% for individual shareholders" as the treaty dividend rate appears wrong — the US–Israel treaty caps dividends at 25% generally / 12.5% for a 10%+ corporate holder; **17.5% is the treaty's interest rate** (used correctly at :499). Unsourced cited figure; verify against the treaty text before any edit.

### B. Medium/Low copy findings

**index.html** (21 Medium, 5 Low):

| Line | Cat | Current → Suggested |
|---|---|---|
| 631 | advice | "must now include … Advance planning is critical." → "generally must then include …; many individuals find it useful to plan for this transition well in advance." |
| 623 | advice | Heading "Mid-Point Review — Plan Ahead" → "Mid-Point Review" |
| 514 | advice | "dual-filers must still file US returns annually" → "affected individuals generally remain required to file US returns annually" |
| 647 | advice | "must still file annual US tax returns…" → "generally remain required to file annual US tax returns…" |
| 540 | typo | "favourable" (lone British spelling) → "favorable" |
| 749 | factual-tone | "(always required)" → "(generally required)" (filing thresholds exist) |
| 698 | style | "$50K single/$100K…" → "$50,000 single / $100,000 married filing jointly, or $200,000 / $400,000 for taxpayers living abroad" |
| 750 | style | "over $10K aggregate" → "over $10,000 aggregate" |
| 458 | informal | "anywhere on the globe" → "anywhere in the world" |
| 522 | informal | "escape US tax obligations" → "generally cannot … eliminate US tax obligations" |
| 591 | informal | "also get a reduced benefit" → "may receive a reduced benefit" |
| 735 | informal | "Almost certainly yes, if…" → "Generally yes, if…" |
| 798 | informal | "The catch:" → "Important caveat:" |
| 821 | informal | "The Oleh Trap" → "A Common Pitfall for Olim" (CLAUDE.md: never alarmist) |
| 857 (+889) | informal | "…the Foreign-Resident Trap" → "…the Foreign-Resident Pitfall" (fix both consistently) |
| 862 | informal | "if no valid certificate shows up" → "if no valid certificate appears in the system" |
| 862 (+874, 917) | informal | "deal(s)" → "transaction(s)" throughout |
| 890 | informal | "locked out … on autopilot" → "has no access to the system that issues certificates … automatically" |
| 905 | informal | "Deliberately locked out…" → "Excluded by design from the automated system…" |
| 779 | informal | "enough of an active presence … to be taxed here" → "a sufficient active presence in Israel to be subject to Israeli tax" ("here" assumes an Israel-located reader) |
| 6 | title-meta | No meta description (see §D) |
| 942 | Low typo | "This is General Information Only" → "This Is …" (title-case; does not soften the disclaimer) |
| 948 | Low typo | "currentness" → "timeliness" (standard disclaimer term; meaning preserved) |
| 917 | Low (PARTIAL) | "the agent protects themselves" — verifier: singular "themselves" is accepted usage (page uses singular "their" at :787); register preference only, not an error |
| 822 | Low | "stays personally exempt" → "remains personally exempt" |
| 395 | Low | Nav label "Establishment" → "Permanent Establishment" (ambiguous truncation; section title at :774 is "Permanent Establishment (PE)") |

**calculator.html** (3 Medium, 3 Low):

| Line | Cat | Current → Suggested |
|---|---|---|
| 35 | terminology | "Entity & Property Classification" → "Entity & Asset Classification" (form covers shares/interest/crypto/options, and the field label is "Asset Type") |
| 21 | informal | "a few quick questions to see the tax rules that apply to your situation" → "a few questions to see an overview of the tax rules that may apply to your situation" |
| 46 | terminology | "Company (LTD)" → "Company (Ltd.)" (index.html itself uses "Ltd." at :717) |
| 36 | Low | "All visible fields are required" → "All fields shown are required" (dev phrasing) |
| 19 | Low | 🧮 hero badge duplicates the h1 verbatim → "Interactive Calculator" (or drop emoji — firm decision, §E) |
| 13 | Low | 🇮🇱 nav-brand emoji — flag-for-decision, keep or drop site-wide consistently |

**calculator2.html** (20 Medium, 11 Low — repeats listed at first occurrence):

| Line | Cat | Current → Suggested |
|---|---|---|
| 581 | terminology | "the Tel Aviv exchange" → "the Tel Aviv Stock Exchange" |
| 145 (+1351, 1971) | terminology | "~12% Bituach Leumi … Tracks A & B" → "approximately 12% National Insurance (Bituach Leumi) contributions … Tracks A and B" (also aligns with "National Insurance" at :1143) |
| 385 | informal | "Worst-case assumed: entire gain taxed at 47%" → "A worst-case assumption is applied: the entire gain is taxed at 47% (the pre-2001 marginal rate)." |
| 438 | informal | "may also trigger VAT — verify separately" → "may also be subject to VAT, which is not assessed here — consult a tax advisor" |
| 622 (+634) | informal | "I'm a 10%+ shareholder, employee, or have special relations…" → "I am a 10%+ shareholder or an employee of the payer, or I have special relations with the payer" |
| 655 | terminology | "flat-rate branches" (engine jargon) → "flat-rate results"; fix fragment |
| 780 | informal | "your crypto" → "your digital asset" |
| 1081 | informal | "Age doesn't affect…" → "Age does not affect the stock-option tax rate — this selection has no effect on the result shown." |
| 1091 | informal | "stacks on top … Has no effect … pure 25%" → "…is taxed on top of this amount. It has no effect on the flat 25% capital-gains result." |
| 1141 / 1142 | informal | "isn't computed here" ×2 → "is not computed here" (parallel notices use the uncontracted form) |
| 1224 | informal | "+"-chained election shorthand; "20 or fewer" missing its noun → spelled-out conditions ("20 or fewer shareholders…") |
| 1255 (+1459, 1588, 1746) | informal | "This is the floor" → "This is the minimum liability" |
| 1730 (+1750) | terminology | "Retained in company"/"Distributed to shareholder" → match sibling card naming "Profits Retained"/"Fully Distributed" style and case |
| 1830 | informal | "unlocking the individual tracks" → "making the individual tracks available" |
| 1978 | informal | "often cheaper" + bare "credit points" → "often results in a lower liability" + "personal tax credit points" |
| 478 (+589, 598, 769, 897, 1672, 2202) | style | Sentence-case field labels amid Title Case siblings → title-case the seven labels |
| 650 (+1086) | terminology | "Other annual income (NIS)" (field already shows a ₪ prefix) → "Other Annual Income (₪)" or drop the parenthetical |
| 548 (+727, 856, 997) | terminology | Four individual-only section headings lack the "Individual — " prefix used by their four siblings (verifier corrected anchor 549→548) |
| 2305 | informal | "Content for this combination is coming soon." → "A calculator for this combination is not yet available." (placeholder sections stay unbuilt by design) |
| 2067 (+2156, 2291) | Low | "outside Israeli tax" → "outside the scope of Israeli tax" |
| 1016 | Low | Hint "0 for RSUs." → "Enter 0 for RSUs." |
| 84 (+248) | Low | "Which Track Is Better For You?" → lowercase "for" |
| 264 | Low | Track A rate slot repeats the card name "Single-Home Exemption" verbatim (:263); siblings show a rate → "Exempt" |
| 299 | Low | "once-per-4-years" → "once-every-four-years" |
| 746 | Low | "FIFO" never expanded → "First-in, first-out (FIFO) acquisition cost…" |
| 910 (+1075) | Low | "10%+" vs "10% or more" (:489, :2212) → "10% or more" |
| 644 (+1079) | Low | "I am over 60" vs "I am over 60 years old" (:77) → align (verifier corrected anchor 646→644) |
| 754 (+883) | Low | "(within 10-year window)" vs "(within the 10-year exemption window)" (:493, :630) → align |
| 19 / 13 | Low | Hero-badge 🧮 / nav 🇮🇱 — same branding decision as calculator.html |
| 6 | Low | Title fine; no meta description (§D) |

### C. Cross-page terminology matrix (12 pairs, all verifier-confirmed)

| Concept | Variants (file:lines) | Recommendation | Sev |
|---|---|---|---|
| Foreign tax credit label | "withheld" (c2: 478, 482, 598, 602, 769, 1672) vs "paid" (c2: 897, 976) | "Foreign tax withheld" (majority form); the result-row "Total tax paid (foreign + Israeli)" is a different concept — leave it | Med |
| Retained-amount card in CG sections | "Profits Retained" (c2:1443, 1572) amid "gain" labels in the same cards | "Gain Retained" in the two CG sections; keep "Profits Retained" in rentals | Med |
| Israel Tax Authority | full name (idx:798, 805, 862); "ITA" first used at idx:727 BEFORE ever being defined; "the tax authority" (c2:840, 875, 1977); "Israeli tax authorities" (idx:573) | "Israel Tax Authority (ITA)" at first mention per page, "ITA" after; idx:234's "home-country tax authority" is a different (foreign) authority — leave | Med |
| Currency notation | "(NIS)" labels with ₪ prefixes in the same field (c2:650, 1086); "(₪)" headers (c2:47, 48, 1161, 1380, 1509, 1688); no unit (c2:1180, 1813) | Standardize on ₪ | Med |
| capital gains hyphenation | unhyphenated (c2:163, 234, 376, 792, 934, 1022; idx:546) vs hyphenated (c2:983, 1113, 1121, 1142, 2254) — clash within the StockOptions card (934 vs 1113/1121) | Unhyphenated "capital gains" everywhere (dominant + US standard) | Med |
| Calculator product name | "Israel Tax Calculator" (both calc pages 6/19/20) vs "Tax Comparison Calculator" (idx:412, used nowhere else) vs "This tool" (c2:982) | Rename the idx CTA to "Israel Tax Calculator"; nav "Calculator" fine | Med |
| Site brand | nav "Israel Tax Guide" vs footer "Israel International Tax Guide" vs index title "International Tax Guide" / h1 "Your International Tax Guide" | Canonical: "Israel International Tax Guide" (already every footer); use in index title | Med |
| favourable/favorable | idx:540 lone British spelling | "favorable" | Med |
| new immigrant / oleh | idx glosses Hebrew (567, 591, 821); calculator2 never introduces "oleh" (493, 630, 754, 883) | "new immigrant" + "(oleh)" gloss at first use per page | Low |
| Non-resident vs foreign resident | idx:458 vs c2 consistent "foreign resident" | Both correct in context; optional alignment | Low |
| "Individual —" heading prefix | prefixed (c2:39, 162, 315, 448) vs bare (c2:548, 727, 856, 997) | One pattern for all eight | Low |
| Back-link wording | "← Back to Step 1" (c2:14) vs "← Go back to Step 1" (c2:2306) | "Back to Step 1" for both | Low |

**Checked and consistent (no action):** "US" style (never "U.S."); "advisor" (never "adviser"); lowercase "aliyah" in prose; "10-year" (never "ten-year"); "Step 1/Step 2" formatting; identical FTC total-row label across all four breakdowns; identical footer disclaimer on all three pages; aria-labels consistent. **Verifier correction:** the first pass claimed "United States" never appears in visible text — false; it appears at idx:482 and idx:948 (the "U.S."-with-periods half of the claim does hold).

### D. Titles & meta descriptions

| Page | `<title>` (line 6) | Meta description |
|---|---|---|
| index.html | "Relocating to Israel — International Tax Guide" | **missing** |
| calculator.html | "Israel Tax Calculator — Step 1" | **missing** |
| calculator2.html | "Israel Tax Calculator — Step 2" | **missing** |

Titles are internally tidy (em-dash, title case) but don't cohere as a set: the index title brands the site differently from both the nav and footer, and the calculator titles carry no site/firm brand, so a bookmarked or search-listed calculator page is unattributable. No page has a meta description — search engines will synthesize snippets from arbitrary copy (possibly disclaimer text or field labels). Recommendation: "Page name — Israel International Tax Guide" pattern; add a hedged descriptive meta description at least to index.html (drafts in the workflow output), and either describe or noindex the calculator pages when folded into the firm's domain.

### E. Emoji inventory (complete — 28 occurrences; independent re-scan matched exactly)

Per-file: index.html 24, calculator.html 2, calculator2.html 2. Frequency: 🧮 ×4, 🇮🇱 ×3, 🏠 ×2, 🏢 ×2, 👤 ×2, and ×1 each 🔍 💼 📈 🏦 🎓 ⚠️ ✅ 📅 🏛️ 📋 🔄 🌐 ✈️ 🧾 ⚖️.

| File:line | Emoji | Context |
|---|---|---|
| index:388 | 🇮🇱 | nav brand "Israel Tax Guide" |
| index:398 | 🧮 | nav link "Calculator" |
| index:407 | 🔍 | hero badge "International Tax Law Overview" |
| index:412 | 🧮 | hero CTA "Tax Comparison Calculator" |
| index:487 | 💼 | card icon "Employment & Business Income" |
| index:492 | 📈 | card icon "Dividends" |
| index:497 | 🏦 | card icon "Interest & Royalties" |
| index:502 | 🏠 | card icon "Real Property" |
| index:507 | 🎓 | card icon "Students & Researchers" |
| index:512 | ⚠️ | card icon "US Citizenship Override" |
| index:584 | ✅ | gold card "Income Types Covered" |
| index:589 | 👤 | gold card "Who Qualifies" |
| index:594 | 📅 | gold card "Timing & Election" |
| index:710 | 🏛️ | card icon "Israeli Pension Accounts" |
| index:715 | 🏢 | card icon "Israeli Business Interests" |
| index:720 | 📋 | card icon "Streamlined Filing Programs" |
| index:725 | 🔄 | card icon "Israel–US FATCA IGA" |
| index:810 | 🏠 | card icon "Home-Office Employee" |
| index:815 | 🌐 | card icon "Internet-Based Activity" |
| index:820 | ✈️ | card icon "The Oleh Trap" |
| index:872 | 🧾 | card icon "Services or Assets" |
| index:877 | 🏢 | card icon "Foreign Company" |
| index:882 | 👤 | card icon "Foreign Individual" |
| index:940 | ⚖️ | disclaimer icon "Not Legal/Tax Advice" |
| calc1:13 | 🇮🇱 | nav brand |
| calc1:19 | 🧮 | hero badge |
| calc2:13 | 🇮🇱 | nav brand |
| calc2:19 | 🧮 | hero badge |

Borderline (functional glyphs, not emoji — keep): ☰/✕ mobile-menu (idx:400 + JS), ↓ hero cue (idx:411), → rule arrows (idx:446–447; c2:1222–1224), ≠ "FATCA ≠ FBAR" (idx:703), ← back-links (calc1:14; c2:14, 2306), → "Next →" (calc1:105), ✓ step indicator (c2:26), ≥ "Owned ≥ 18 months" (c2:227), − true minus ×5 (c2), ₪ ×30 (all functional currency), ↑ JS "Collapse ↑" button (idx). **Verifier addition:** both passes initially missed the visible step-bar separator `›` (U+203A) at calculator.html:27 and calculator2.html:27. Box-drawing (─ ═) and middot (·) occurrences are comment-only, never rendered. Audit note for the future: the 🇮🇱 flag (regional-indicator pair) is NOT matched by `\p{Extended_Pictographic}` — emoji scans must include U+1F1E6–1F1FF.

### F. Route to tax AI (Part 4 bucket)

1. **P4-H5** — idx:573/:610 ten-year-exemption reporting claim vs the 2024 legislation (= Part 1(e), ITO Amendment 272 check).
2. **P4-H4** — idx:691 FBAR penalty framing (Bittner: per report, not per account) — verify before editing a cited figure.
3. **P4-H7** — idx:447 day-count presumption wording (425-day window includes the current year).
4. **P4-H8** — idx:494 "17.5% for individual shareholders" dividend rate (appears to be the treaty *interest* rate) — verify against treaty text.
5. **P4-H6** — c2:1846 wording characterizes the 23% computation; confirm phrasing.

### G. Suggested fix prompts (scoped, apply-after-sign-off)

1. **index.html copy pass:** "In index.html ONLY, apply the Part 4 §A/§B index.html replacements from handoff-review.md EXCEPT the five Route-to-tax-AI items (lines 447, 494, 573+610, 691 — leave verbatim; and confirm 1846-style wording separately). Visible copy only; do not touch structure, ids, JS, CSS, or the disclaimer's substance; the :942/:948 tweaks are case/word-choice only and must not soften disclaimer language."
2. **calculator.html copy pass:** "In calculator.html ONLY, apply the six Part 4 §B replacements (35, 21, 46, 36; 19/13 only if the firm decides to drop emoji). Labels/copy only — do not rename ids, options' value attributes, or touch the inline script."
3. **calculator2.html copy pass:** "In calculator2.html ONLY, apply the Part 4 §B calculator2 replacements including listed repeats. Visible text only: never change id/value attributes, numbers, rates, or anything read by calculator2.sections.js; run node tax-engine.test.cjs after (expect 101/0/95/0) and click through one section per family over file://."
4. **Terminology standardization:** "Across the three HTML pages ONLY, apply the Part 4 §C matrix recommendations (withheld/paid, Gain Retained, ITA first-mention gloss, ₪ notation, capital gains unhyphenated, product name, brand in index title, favorable). Do not modify calculator2.sections.js in this pass; a separate sweep must apply the same standards to its injected strings."
5. **Titles/meta:** "Add meta descriptions per Part 4 §D and align the three titles on 'X — Israel International Tax Guide'. Head-only edits."
6. **Emoji (decision first):** keep or remove is a firm branding call; if removal is chosen: "Remove the emoji listed in Part 4 §E from nav brands, hero badges/CTA, and card icons across the three pages, leaving the functional glyphs (arrows, ✓, ›, ₪, ☰/✕) intact; check card layouts don't collapse where the icon div empties."

### Notes

- The disclaimer sentence at index.html:948 — "This content has not been reviewed or verified by a licensed tax professional" — becomes self-undermining once the site sits on an accounting firm's domain. Per the hard rule, disclaimer language must not be removed or softened without sign-off, so this is a **firm-level decision to make before launch**, not a copy fix.
- PARTIAL verdicts: idx:917 (singular "themselves" is accepted usage — downgraded to optional register preference); c2 anchors 549→548 and 646→644 corrected above. Nothing was refuted.
- calculator.html:58 "Stock Options / RSUs (Sec. 102)" vs calculator2's bare "102 …" track labels: defensible select-label shorthand, borderline Low; ties into the Part 3 observation about the §102 visible-text carve-out ruling.

## Part 5 — Robustness

Reviewed 2026-07-06 against the working tree. Read-only; nothing edited, staged, or committed. Method: five code-trace agents (traces grounded by eval-loading the real `tax-engine.js` in node from the scratchpad — no repo writes) plus an adversarial verifier that independently re-traced **all 21 claimed issues (21 CONFIRMED, 0 refuted, 0 partial)**, re-derived every engine figure in node, swept all 24 `toFixed` call sites, and added 2 missed findings. Duplicates across topics are consolidated below. **Headline: zero Critical findings — no reachable path renders `NaN`/`₪NaN`/`NaN%` anywhere in the app.**

### Findings index

| ID | Sev | Where | One-liner |
|---|---|---|---|
| P5-H1 | High | calculator2.sections.js:633 | Commercial RE-CG: reversed/same-day dates render **₪0 tax against a positive gain** + garbled verdict |
| P5-H2 | High | calculator2.sections.js:604 | Commercial RE-CG: cleared sale date → silent 47% worst case mislabeled "pre-2001", no warning |
| (=P3-C1) | Critical | calculator2.sections.js:2178 | Co_FOR_Shares treaty figure uncapped above statutory — independently rediscovered by this part; see Part 3 |
| P5-M1 | Medium | calculator2.sections.js:381 | Residential RE-CG: cleared sale date → false "held < 18 months" reason; noDateWarn stays hidden |
| P5-M2 | Medium | calculator2.sections.js:340 | Owned-18-months flag renders "✗ No (-N months)" on reversed dates |
| P5-M3 | Medium | calculator2.sections.js:1285 | §102 holding flag renders "✗ Not met (-N months — early sale)" on reversed dates |
| P5-M4 | Medium | calculator2.sections.js:1326 | 10%+ holder dead-ended by a date gate that cannot affect their figure |
| P5-M5 | Medium | calculator2.sections.js:1268 | Holding flag ignores the 10% box — contradictory flag/note pairs (figures unaffected) |
| P5-M6 | Medium | calculator2.sections.js:1292 | Listed/avg30 controls stay editable on branches that ignore them — dead controls, no feedback |
| P5-M7 | Medium | calculator2.sections.js:1263 | **Route to tax AI:** calendar-month holding count can flip met/not-met ±~30 days vs date-to-date |
| P5-M8 | Medium | calculator2.sections.js:1462 | Israeli-co rental retained card hardcodes "23.0%" effective even when net = 0 (sibling card says 0.0%) |
| P5-M9 | Medium | calculator2.sections.js:1750 | *(verifier catch)* Co_FOR transparent path reads the expenses field that the default withholding basis keeps **disabled** — Track C silently omits expenses, or consumes a stale greyed value |
| P5-L1 | Low | calculator.html:194 | sessionStorage key `taxForm` is un-namespaced on a shared origin (requested item 5) |
| P5-L2 | Low | calculator2.sections.js:306 | Three raw `JSON.parse(sessionStorage…)` re-reads (306/1409/1726) bypass the hardened read — unreachable with bad data today, fragile invariant |
| P5-L3 | Low | calculator2.sections.js:154 | Valid-JSON-but-stale shapes get "coming soon" instead of the expired-session message |
| P5-L4 | Low | calculator2.sections.js:1764 | Company guards are truthiness-only (`!gross`) — negatives would render "₪-23"-style; unreachable today only because liveComma strips `-` |
| P5-L5 | Low | calculator2.sections.js:2030 | Shares sections' reset never restores base/tax labels — stale "Dividend received: —" over CG inputs after an income-type switch |
| P5-L6 | Low | calculator2.sections.js:1393 | §102 date fields lack the RE sections' live character filter; the RE filter silently eats dashes ("01-01-2025" → "01012025") |
| P5-L7 | Low | calculator2.sections.js:1366 | "Capital-gains tax ₪0" row renders unconditionally while sibling rows hide-when-zero |
| P5-L8 | Low | calculator2.sections.js:1380 | *(verifier catch)* Typed 30-day average ≤ exercise price → split note still claims an employment-income portion that is ₪0/hidden |

### 1. Direct visit to calculator2.html with missing/corrupted sessionStorage — PASS

The read is centralized and hardened in `showSection` (calculator2.sections.js:72–175): `getItem` + `JSON.parse` wrapped in try/catch **plus** a shape guard rejecting non-objects, `null`, and arrays (:77–91).

- **Missing entry:** routes to `fallback`, unhides the fallback card (calculator2.html:2303), and overwrites the stub with the verbatim message **"We could not read your selections from Step 1 — the session may have expired. Please start again."** (:155–156) plus the "← Go back to Step 1" link (:2306). No exception, page fully renders.
- **Corrupted entry** (non-JSON string, `"null"`, `"42"`, `"[1]"` — all node-verified against a replica of the guard): `JSON.parse` throws, is caught, same fallback message. **The page can never blank on corrupted storage.** The catch also covers a throwing `getItem` (storage disabled).
- **Valid JSON, wrong shape** (old-schema/foreign object): passes the shape guard (`storageOk` stays true), keys degrade to `''` via `(saved.entity || '').trim()`, routes to `fallback` — but shows the stub **"Content for this combination is coming soon."** instead of the session explanation (P5-L3, confusing-but-safe).
- P5-L2: the three secondary raw re-parses (:306, :1409, :1726) are provably unreachable with bad data today (they only run after the guarded parse routed successfully) but violate the file's own stated hardening intent. *Fix prompt:* have showSection pass its validated `saved` object into those three inits; delete the raw reads. Plumbing only.

### 2. NaN / negative / zero in every section's primary input — PASS (no renderable NaN)

Helper ground truth (node-verified): `pn` → 0 for `''`/`'abc'`, 1234 for `'1,234'`, −5 for `'-5'` (passes negatives), never NaN (`Number.isFinite` gate); `pnOr` → default for empty/garbage, respects a typed 0; **`fmt` (tax-engine.js:39) renders `'—'` for NaN/Infinity**; `effPct` guards `base > 0`. Defense against negatives: every ₪ field is a liveComma text input whose handler strips `-` (and `e`) on every input event including paste; the type=number percent fields that *can* hold a typed `-5` are all neutralized (UI clamp at :710, engine `treatyRatePct >= 0` guard at tax-engine.js:187, `clampPct` at :142). The verifier independently swept **all 24 `toFixed` sites** — every division sits behind a strictly-positive-denominator or engine-internal guard — and confirmed the engine returns no NaN in any field for zero/negative/overflow inputs across `computeTracks`, `corporateIsraeli`, `corporateForeign`, `companyRealEstateCG`, `companyDividendIsraeli`, and the individual functions. Blank/zero primary inputs reset every section to "—". The `modeled:false` PE branch renders "—" for rate/tax/effective per CLAUDE.md. Pathological input (400-digit numbers, `1e999`) self-neutralizes (liveComma strips `e`; ownership clamps catch Infinity).

**Ownership-% conformance:** all six `pnOr` ownership reads match the CLAUDE.md rule exactly — empty→0 at :1438, :1668, :2083 (distribution-scaling), empty→100 at :1518, :1825 (income-scaling), all clamped 0–100.

Issues in this area: P5-M8 (hardcoded 23.0% on a ₪0-net card — *fix prompt:* replace the constant at :1462 with `effPct(corpTax, net)`, matching how the CG section renders the same cell); P5-M9 (verifier catch: `cofor_expenses` is disabled under the **default** withholding basis yet read by the transparent Track C path at :1822 — a user checking "Transparent entity" can't type expenses without flipping an irrelevant dropdown, and a stale greyed value still feeds the computation; *fix prompt:* make `updateCoFORPanel` re-run `syncExpensesEnabled` with transparent-awareness so the field enables when the transparent path reads it — UI wiring only); P5-L4 (guard hardening: change company guards to `<= 0` like the individual rental's :212 pattern); P5-L5 (label reset). Non-issues recorded: crypto effective can exceed 100% with foreign tax ≫ gain (engine's documented burden/gain definition, frozen — noted for the tax AI only if the company considers it substantive); `fmt(-0)` unreachable.

### 3. Garbage in the DD/MM/YYYY date fields — parser is robust; the gaps are *empty-sale-date* and *reversed dates*

Single shared parser `parseDMY` (tax-engine.js:594–601), node-verified against every mandated input: `"aa/bb/cccc"` → null; **`"31/02/2025"` → null (the JS Date rollover to 03/03 is explicitly rejected** by the round-trip check at :599); `"1/1/25"` → null (4-digit year required); `"2025/01/01"` → null; `"01-01-2025"` → null; US-style `"05/31/2025"` → null; leap logic correct (29/02/2024 ok, 29/02/2025 null). Every typed-but-invalid state cleanly blocks: RE sections reset + show `badDateWarn` (:375–379, :598–602); §102 resets + verdict "Check the date format — dates must be DD/MM/YYYY" (:1326–1331). Empty **purchase** date is disclosed properly (res: noDateWarn + Track-B assumption text; com: "full gain at 47% (worst case — no purchase date)"). The engine's `section102` never receives raw dates, only the UI-computed `holdingMet` boolean.

What the invalid-gate cannot see:

- **P5-H1 · :633.** Both dates format-valid but sale ≤ purchase: `linearSplit` returns `[]` (node: reversed and same-day both), the split loop never runs, and the commercial section renders **₪0 Base Tax / ₪0 Grand Total / 0.0%** against a positive displayed gain, with the garbled verdict `"Split: . Base tax ₪0 (0.0% of gain)."` — no warning fires. One-character year typo against the today-prefilled sale date reproduces it. (Residential inconsistently falls back to 25% on the full gain — safe but divergent.) *Fix prompt:* UI chronology guard after the invalid-date check in `runCGComCalc` **and** `runCGResCalc` — if both parse and `saleDate_ <= purchaseDate`, reset cards + "The sale date must be after the purchase date." No engine changes; verify over file:// with purchase 01/01/2027 vs prefilled sale.
- **P5-H2 · :604.** `noDate = !purchaseDate` keys the worst-case disclosure to the purchase date only. Clearing the prefilled **sale** date (valid purchase entered) silently takes the `pre2001 = gain` branch — a confident, warning-free **47% on the whole gain**, verdict mislabeled "pre-2001 at 47%" even for a 2020 purchase. *Fix prompt:* in `runCGComCalc`, when sale-date state is `'empty'` and a sale price is entered, reset + ask for the sale date (mirror badDateWarn). 
- **P5-M1 · :381.** Same cleared-sale-date case in the residential section: Track A declared ineligible with the untrue reason "held < 18 months" (ownedMonths ternary yields 0) and Track B silently taxes the full gain at 25% with `cg_res_noDateWarn` hidden. Same fix pattern.
- **P5-M2/M3 · :340, :1285.** Reversed dates render raw negative month counts: "✗ No (-12 months)" / "✗ Not met (-3 months — early sale)". Figures are safe worst cases; the text is nonsense and misdiagnoses the problem. *Fix prompt:* na-style flag "Sale date is before the purchase/grant date — check the dates above" when months < 0 (fold into the P5-H1 chronology guard; for §102 extend `holdingInfo` with a `'reversed'` dateProblem handled like the existing ones).
- **P5-L6 · :1393.** §102 date fields lack the RE sections' live `[^\d/]` filter; conversely the RE filter eats dashes, leaving "01012025" + a format warning that no longer matches what was typed. *Fix prompt:* unify the handlers; optionally map `-`/`.` → `/` before stripping.

### 4. StockOptions — 10%-holder × early-sale state matrix

Engine branch precedence (tax-engine.js:430–506, node-verified): **10%-holder (`3i_controlling_holder`) > cg early-sale (`cg_violation_early_sale`) > listed split.** Node 2×2 at proceeds 300k / exercise 50k / other income 200k: cell (No,No) = cg_private **₪62,500 / 25.0%**; the other three cells all = **₪84,729 / 33.9%** (whole gain as employment income). So every contradiction below is **cosmetic — the figures are never wrong**, and the note machinery itself is sound (single note element, all inputs wired to recalc, conditional rows re-hidden per run, `setGroup` clears cg-only inputs on track change — no stale-output or order-of-clicks bugs found).

- **P5-M4 · :1326.** With the 10% box checked and dates missing/invalid on a trustee track, runCalc dead-ends at "Enter the grant and sale dates above to determine the holding period" — but the engine's 10%-holder branch ignores `holdingMet` entirely (node: identical output either way), and the same holder gets an instant result on the nontrustee/3(i) tracks. *Fix prompt:* skip the dateProblem early-return when the 10% box is checked; keep it otherwise.
- **P5-M5 · :1268.** `updateHoldingFlag` never reads the 10% box: a barred holder sees a green "✓ Holding period met" flag (or, with early sale, a red flag giving a *different* reclassification reason than the note). *Fix prompt:* render an na-style "Not applicable — 10%+ holders are taxed outside the 102 tracks" flag when checked, and have the checkbox listener call `updateHoldingFlag()` before `runCalc()`.
- **P5-M6 · :1292.** `syncVisibility` keys the listed/avg30 group solely off `track === 'cg'`, so on the early-sale and 10%-holder branches those inputs stay editable with zero effect (node: byte-identical results with/without them). *Fix prompt:* show a muted "Does not affect this result…" hint on those branches; do **not** hide via setGroup (it clears values and the early-sale state is transient while typing dates).
- **P5-M7 · :1263 — Route to tax AI.** `holdingInfo` counts calendar months, discarding day-of-month: grant 25/06/2020 → sale 01/06/2022 counts as 24 ("met") though 24 full months elapse only on 25/06; the reverse case flips to "not met" at 23mo30d. This UI-computed boolean selects the frozen engine's branch, swinging the headline between 25% and marginal rates. It deliberately mirrors the CG sections' 18-month convention (:333–334; comment at calculator2.html:991–993) — whether §102's 24/12-month trustee periods are date-to-date is a tax question; do not change without sign-off (and ask whether the 18-month flag should follow).
- **P5-L7 · :1366** (unconditional ₪0 row) and **P5-L8 · :1380** (verifier catch: a *typed* 30-day average at or below the exercise price yields employmentPortion 0 while the split note still claims an employment-income portion — the special prompt covers only a *blank* field). Related wording gap for tax review: the engine comment says listed "within 90 days" of grant also triggers the split (tax-engine.js:404–408) while the checkbox label says only "listed at grant" (calculator2.html:1056).

### 5. sessionStorage key namespacing (requested Low)

**P5-L1 · calculator.html:194.** The key is the generic string `'taxForm'` at exactly five touchpoints (write :194; reads sections.js:78, :306, :1409, :1726 — repo-wide grep, nothing else touches sessionStorage). On the accounting firm's origin, any other app using `taxForm` stomps this app's routing (or vice versa). *Fix prompt:* rename to a namespaced key (e.g. `israelTaxGuide.taxForm`) at all five sites, with a one-line legacy-key fallback in the showSection read only, so a mid-session user isn't dumped to the fallback screen during the rename. No shape or routing changes. (Part 6 notes the same key also matters for the embedding decision.)

### Route to tax AI (Part 5 bucket)

1. **P5-M7** — calendar-month vs date-to-date measurement of the §102 24/12-month holding periods (and the CG sections' mirrored 18-month convention).
2. Crypto effective rate exceeding 100% when foreign tax ≫ gain — engine's documented burden/gain definition; flag only if the company deems it substantive.
3. "Listed at grant" checkbox label vs the engine's "listed within 90 days of grant" comment — any label change needs tax review.

### Notes

- Verification: all 21 issues re-traced and CONFIRMED at their cited lines with node-reproduced figures (linearSplit `[]` → ₪0 path; residential 25% fallback ₪250,000 on a ₪1M gain; §102 ₪62,500 / ₪84,728.8 cells; interest treaty cap ₪25,000; corporateForeign −23). Clean claims probed by independent methods (sessionStorage grep, JSON.parse grep, toFixed sweep, full date-parse call-site inventory).
- The Co_FOR_Shares uncapped-treaty issue was independently rediscovered by this part's 2b trace — same defect as **P3-C1**; not double-counted.
- All suggested fixes are UI-layer only; no engine math, rates, brackets, or branch changes are proposed anywhere in this part.

## Part 6 — Embedding risk

Reviewed 2026-07-06 against the working tree. Read-only; nothing edited, staged, or committed. Method: three inventory agents (calculator.css globals; index.html inline-style globals; whole-page ownership assumptions across all five files) plus an adversarial verifier that independently brace-parsed both stylesheets and re-checked every cited mechanism. Result: **zero missed global selectors** (the verifier's independent extraction reproduced both inventories exactly), 24/24 spot-checked claims CONFIRMED, and four numeric slips corrected (noted inline; two of them *understated* the risk). Line numbers are working-tree.

**Bottom line first: none of this matters if the pages ship standalone or in an iframe (§6).** Every finding below applies only to pasting the markup/CSS into a host page template. The site was written to own its whole document — there is no namespace wrapper anywhere; every rule competes site-wide on paste-in.

### 1. Global / bare-element selectors — calculator.css (linked by both calculator pages)

Quantified by the verifier: **129 rule blocks, 12 global (~9%)**; all 8 `@media` blocks target classes only; all attribute selectors are class-scoped compounds.

| Line | Selector | Risk | Effect on a host page |
|---|---|---|---|
| 1 | `*, *::before, *::after` | High | Universal reset — zeroes margin/padding and forces border-box on **every host element**; single most dangerous rule in the sheet |
| 2–18 | `:root` (15 vars) | High | `--text, --muted, --border, --bg, --white, --radius, --shadow, --shadow-sm, --green, --blue…` are common theme-token names; whichever sheet loads last silently recolors/reshapes the other site |
| 19 | `html` | Low | `scroll-behavior:smooth` site-wide, unrequested |
| 20–25 | `body` | High | Repaints host background/font AND sets `min-height:100vh; display:flex; flex-direction:column` — **turns the host `<body>` into a flex column**, breaking block-flow/float host layouts; if the host wins instead, the calculator loses its sticky footer and 16px baseline |
| 27 | `input, select, button` | Low | `font-family:inherit` on every host form control |
| 29 | `a:focus-visible` | Medium | Blue 3px focus ring on every host link; a later host `outline:none` reset strips the calculator's only focus affordance |
| 32–35 | `nav` | High | Every host `<nav>` becomes white, sticky, `z-index:100` — double-sticky headers, stacking wars |
| 168–171 | `@keyframes slideIn` | Medium | Globally-named keyframe; a host `slideIn` definition swaps animations in either direction |
| 352–355 | `footer` | High | Every host `<footer>` repainted dark blue, centered small white text |
| 356 | `footer strong` | Medium | White `<strong>` in any host footer — invisible on light backgrounds |
| 383 | `body.step1 .card` | Medium | Host-body-class contract (see §4) + `.card` is a Bootstrap name |
| 384 | `body.step1 .card-header` | Medium | Same contract; `.card-header` is a Bootstrap name |

### 2. Global / bare-element selectors — index.html inline `<style>` (lines 7–370, single block, no linked sheets)

Quantified: **111 rule blocks, 7 global (~6%)**; 4 `@media` blocks (191, 275, 325, 358 — verifier corrected the inventory's "three"), all class-only; **no** `@keyframes`, `::selection`, or scrollbar styling; all pseudo-element rules class-scoped.

| Line | Selector | Risk | Effect on a host page |
|---|---|---|---|
| 8 | `*, *::before, *::after` | High | Same universal reset as above |
| 10–24 | `:root` (13 vars) | Medium | Same generic token names (minus green/amber, plus `--gold`, `--gold-light`) |
| 26 | `html` | Medium | `scroll-behavior:smooth` site-wide |
| 28–34 | `body` | High | Host typeface, 16px base, 1.7 line-height, text color, page background — typography-only (no flex here) |
| 37–42 | `nav` | High | Same sticky/white/z-100 restyle of every host `<nav>` |
| 350–354 | `footer` | High | Same dark-blue repaint of every host `<footer>` |
| 355 | `footer strong` | Medium | Same invisible-text risk |

### 3. Framework-identical class names (two-way restyling on paste-in)

The ~91–94% "scoped" majority is misleading: many class names are framework-core elsewhere. **High risk** (near-certain collision on a Bootstrap/Bulma/WP host):

| Where | Classes | Worst effect |
|---|---|---|
| calculator.css 94–107, 383–384 | `.card` / `.card-header` | Bootstrap-core names; two-way merge of card styling |
| calculator.css 291–297 | `.badge` / `.badge-warning` | `.badge-warning` is literally a Bootstrap 4 class |
| calculator.css 110–126, 359–362 | `.field` / `.fields` | Bulma-core + WP form plugins; misaligns both sides' forms |
| calculator.css 50–65; index 69–96 | `.hero` (+ sub-parts) | Bulma component/theme staple; gradient repaints host hero (index adds an absolute `::before` overlay) |
| index 127 | `.container` | Bootstrap/Tailwind/WP universal; re-widths host wrappers |
| index 222–249, 266 | `.accordion` / `.accordion-item` / `.accordion-body` | Bootstrap 5-exact names — **`.accordion-body { max-height:0; overflow:hidden }` visually collapses any host Bootstrap accordion content** (worst single class collision) |
| index 53–62, 359–363 | `.nav-links` | Common theme menu class — host menu named `.nav-links` **vanishes under 820px** unless `.open` |
| index 130–135, 209, 235 | `.section` | Very generic + **structural** `:nth-child(even)` zebra: section backgrounds depend on sibling position inside whatever host wrapper the markup lands in |
| index 368–369 | `.reveal` | `opacity:0; translateY(24px)` by default — **any host element classed `reveal` becomes invisible** until this page's IntersectionObserver deigns to mark it `.visible` |

Medium risk: `.step/.active/.done/.pending` wizard vocabulary, `.page`, `.nav-inner/.nav-brand/.back-link`, `.two-col` (both files), `.btn-row/.btn-next` (Bootstrap's `btn-` namespace + wizard plugins), `.metrics/.metric*`, `.cards`, `.card-icon`, `.section-header`, `.hero-*` sub-parts, `.timeline*`, `.disclaimer/.disclaimer-icon` (a firm site very plausibly styles `.disclaimer` — and this one must stay legible), `.nav-toggle`; plus the reverse direction: the JS toggles bare `open`/`active`/`visible` state classes that trigger **host** rules. Low/safe: the distinctively prefixed majority (`.track-*`, `.cg-*`, `.income-*`, `.bl-note`, `.foreign-notice`, `.opt-grid`, `.steps-*`, `.section-acc*`, `.input-table` family, `.ai-notice`).

### 4. Whole-page ownership assumptions (beyond selector collisions)

**Layout & stacking:**
- Sticky nav `z-index:100` in both files (calculator.css:34, index:38) — sits *below* Bootstrap's fixed navbar (1030) and most WP headers (999+), *above* ordinary host content: two competing sticky bars in any realistic template. Mobile `.nav-links` dropdown positions against whatever host ancestor is the containing block (index:359).
- `body` flex-column + `.page { flex:1 }` sticky-footer contract (calculator.css:20–25, 91) — the flex rule is destructive to hosts; without it, `.page` flex is silently inert (cosmetic).
- `body.step1` contract: calculator.html:9 sets the class on **its own** body; calculator.css:383–384 key Step-1 card spacing on it. Impossible in an inline embed without editing the host `<body>`; omit it and Step-1 silently reverts to Step-2 spacing; add it to a Bootstrap host body and `body.step1 .card { margin-bottom:0 }` collapses every host `.card`.
- Full-bleed hero (`<header class="hero">`, all three pages) and steps bar render as orphaned full-width strips inside a constrained host column. Duplicate viewport meta / in-body `<title>` can hijack the host tab title (Low).
- `.section { scroll-margin-top:70px }` (index:135) is tuned to this site's ~57px nav; under a host header of another height, anchor landings hide under the banner.

**Scroll & URL behavior (index.html head script, lines 371–380 — runs before body parse):**
- `history.scrollRestoration = 'manual'` (:376) — disables scroll restoration for the **entire host page** (High).
- Hash-strip via `history.replaceState(...split('#')[0])` (guard :377, call :378) — **destroys every deep link on the host page on every load**, including host hash-routing and skip-links (High).
- `window.addEventListener('hashchange')` (:1007) re-intercepts all host hash navigation (try/catch'd querySelector, mostly harmless).
- Both stylesheets force `html { scroll-behavior:smooth }` site-wide.

**JS document-scope (the part CSS scoping can't fix):**
- `calculator2.sections.js:148` wires **every** `input[inputmode="decimal"]` in the document to liveComma (lines 10–22), which rewrites keystrokes (strips non-`[0-9.]`, inserts en-IL separators) — **host payment/quantity/donation inputs get hijacked** (High).
- `index.html:965–967`: `navToggle`/`navLinks` dereferenced **without null checks** at the top of the page's single script block — remove the site nav (the web team's obvious first edit) and the throw kills accordions, collapse buttons, scroll-spy AND the reveal observer, leaving all `.reveal` content permanently at `opacity:0` (High). (`exploreCta` at :998 *is* guarded.)
- Scroll-spy observes `document.querySelectorAll('section[id], header')` (:1099) — host sections drive `.active` highlighting; `document.querySelector('nav')` (:1033) measures the **first** nav in the document (the host's) for scroll math; document-wide wiring of `.accordion-trigger` (:1010), `.section-acc` (:1077), `.accordion-item` (:1087), `.reveal` (:1113) attaches this page's handlers to host elements, including injecting "Collapse ↑" buttons into host accordions.
- `calculator2.sections.js:2244`: `DOMContentLoaded` is the **sole** entry point, no `readyState` fallback — scripts injected after the host's DOMContentLoaded (tag managers, lazy CMS embeds) never initialize and every `.calc-section` stays `display:none`: **blank calculator** (High).
- **339** unguarded `document.getElementById` calls in sections.js (verifier-exact count) against ids that include generic names (`rentalIncome`, `expensesInput`, `otherIncome`, `fallback`…); calculator.html likewise (`nextBtn`, `purpose`, `assetType`…). One host id collision or one pruned section → throw inside init, section renders but never computes (Medium).
- Classic ordered scripts sharing implicit globals (`fmt`, `pn`, `blank`, `computeTracks`, `liveComma`, `showSection`…) — host defer/async/concatenation breaks engine-first order; short global names can collide with host JS, last definition silently wins (Medium). `tax-engine.js` itself is verified DOM-free (its only `window`/`document` grep hit is the English word "window." in a comment at :285).

**State & navigation contracts:**
- `sessionStorage.setItem('taxForm', …)` unguarded at calculator.html:194, then `window.location.href = 'calculator2.html'` at :195 — **relative, top-frame navigation**: pasted inline, Next navigates the whole host page to `<host-dir>/calculator2.html` (404 unless deployed exactly there), and in storage-blocked contexts setItem throws so the button silently does nothing (High). Step-2 guards its main read (sections.js:77–91) but has raw `JSON.parse(sessionStorage.getItem('taxForm') || '{}')` at :306, :1409, :1726 (`|| '{}'` doesn't cover a storage-access throw). The un-namespaced `taxForm` key can collide with any host app on the same origin (Part 5's Low item).
- **Duplicate-instance impossibility:** calculator2.html carries **17** `.calc-section` divs and **~396** unique ids (verifier corrected the inventory's ~15/~180 — the risk is ~2× as stated). Two embeds on one host page = second instance completely dead, handlers cross-wired into the first.

**The four riskiest paste-in items** (each independently breaks a realistic host page): calculator.css:20 (host body becomes a flex column) · index.html:377–378 (host deep links destroyed on every load) · calculator2.sections.js:148 (host decimal inputs hijacked) · calculator.html:195 (Next navigates the whole host page to a relative URL).

### 5. Verifier corrections (for the record)

Four numeric slips, none changing a risk rating: index.html has **4** @media blocks (not "three"); calculator2.html has **~396 ids / 17 sections** (not ~180/15 — understated); calculator.css has **128+1** rule blocks (not ~100) and 384 lines (not 385); index.html has **19** inline `style=` lines (not ~15). Zero global selectors missed; the `~339` getElementById estimate was exactly right.

### 6. What makes all of this moot

- **Standalone pages on their own URLs** (host site links to them): every finding above is moot. Each file owns its document; resets, bare selectors, body flex, `:root` tokens, the hash-strip script, document-wide JS wiring, generic ids, `taxForm`, and z-indexes all operate exactly as designed. This is how the site works today.
- **`<iframe>` embed:** equally moot for **all** CSS and DOM/JS-scope items — the frame is an isolated document (even two calculators per host page work; each frame has its own document and tab-scoped sessionStorage). Four things still need care: **(1) height** — the pages grow/shrink dynamically and there is no postMessage resize hook in the code, so fix a generous height or add a resizer; the sticky nav also sticks only within the frame, which looks odd mid-page. **(2) Viewport** — the frame's own viewport meta is ignored; mobile behavior is governed by the host's tag (layout is fluid, mostly harmless). **(3) Storage/sandbox** — the Step-1→Step-2 handoff happens inside the frame and works same-origin and under modern partitioned storage; it fails only where third-party storage is blocked outright or the iframe is sandboxed without `allow-scripts allow-same-origin` — and because setItem is unguarded, the failure mode is a silently dead Next button. **(4) Deep-linking/history** — the frame's internal state isn't reflected in the host URL (no bookmarking Step 2), and in-frame navigations join the host tab's session history, so the browser Back button steps the iframe back before the host page — flag this UX surprise to the web team.

**If (and only if) the web team mandates inline embedding**, the scoped fix prompt is: "Namespace the calculator for embedding: wrap each page's markup in `<div class="itg-root">`, prefix every selector in calculator.css and the index style block under `.itg-root` (replacing the `*`, html, body, nav, footer rules with `.itg-root`-scoped equivalents), rename all CSS variables with an `--itg-` prefix, rename `slideIn`, replace the `body.step1` hook with a class on the wrapper, scope the liveComma/accordion/scroll queries to the wrapper element, guard navToggle/getElementById derefs, add a `readyState` fallback to the DOMContentLoaded init, remove the hash-strip/scrollRestoration head script, and namespace the sessionStorage key — then re-run node tax-engine.test.cjs and manually verify both pages standalone AND embedded." This is a substantial rework touching frozen-adjacent files; it needs its own review cycle and should not be attempted casually.

### Questions the web team must answer

1. **Integration mode** — standalone pages on their own URLs, `<iframe>` embed, or inline markup-paste into the firm's template? (Standalone or iframe: near-zero work, all Part 6 findings moot. Inline: the full §1–§4 register applies and requires the namespacing rework above.)
2. **Branding & navigation** — does the site's own nav/hero/footer chrome ship, or does the firm's template supply chrome? If the firm's: the pages' nav/footer markup must be removed *and* (index.html) the unguarded `navToggle` wiring fixed first, or the page's JS dies. Do the emoji stay (Part 4 §E inventory feeds this same decision)?
3. **Does index.html ship at all** — guide + calculator, calculator only, or guide folded into existing firm content? (Affects the Part 4 copy fixes, the Route-to-tax-AI items on index.html, and both nav link targets in the calculator pages.)
4. **URL structure** — final paths/filenames for the three pages (the Step-1→Step-2 handoff and all cross-links are relative: `calculator2.html`, `calculator.html`, `index.html` must remain siblings or every link and the JS navigation at calculator.html:195 breaks); is `calculator2.html?` renamed to something client-facing; are the calculator pages indexed or noindexed (ties to Part 4 §D meta descriptions); same-origin guarantee for sessionStorage; and who owns TLS/hosting for the `file://`-safe no-CDN constraint (nothing to change — just don't add a CDN during integration).
