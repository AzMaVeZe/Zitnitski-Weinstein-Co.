// ── tax-engine.js ──────────────────────────────────────────────────
// Pure, DOM-free tax engine for the Israel real-estate calculator.
// No document/window access. Loaded as a classic script BEFORE
// calculator2.sections.js (which provides the DOM/UI layer). No build step.

  // ── Tax brackets (monthly NIS, 2024) ────────────────────────────
  const BRACKETS = [
    { min: 0,     max: 7010,     rate: 0.10, label: '₪0 – ₪7,010'       },
    { min: 7010,  max: 10060,    rate: 0.14, label: '₪7,011 – ₪10,060'  },
    { min: 10060, max: 16150,    rate: 0.20, label: '₪10,061 – ₪16,150' },
    { min: 16150, max: 22440,    rate: 0.31, label: '₪16,151 – ₪22,440' },
    { min: 22440, max: 46690,    rate: 0.35, label: '₪22,441 – ₪46,690' },
    { min: 46690, max: Infinity, rate: 0.47, label: 'Above ₪46,690'      },
  ];

  function calcTaxPassive(annualIncome) {
    const t31 = BRACKETS[3].max * 12;
    const t35 = BRACKETS[4].max * 12;
    let tax = 0;
    tax += Math.min(annualIncome, t31) * 0.31;
    if (annualIncome > t31) tax += (Math.min(annualIncome, t35) - t31) * 0.35;
    if (annualIncome > t35) tax += (annualIncome - t35) * 0.47;
    return tax;
  }

  function calcTaxActive(annualIncome) {
    let tax = 0;
    for (const b of BRACKETS) {
      const lo = b.min * 12;
      const hi = b.max === Infinity ? Infinity : b.max * 12;
      if (annualIncome <= lo) break;
      tax += (Math.min(annualIncome, hi) - lo) * b.rate;
    }
    return tax;
  }

  // Non-finite input (NaN / ±Infinity) renders as the empty-state em-dash
  // rather than "₪NaN", matching the UI's blank-field convention.
  function fmt(n) { return Number.isFinite(n) ? '₪' + Math.round(n).toLocaleString('en-IL') : '—'; }

  // ── Three-track rental tax (pure: no DOM read/write) ─────────────
  // Inputs are ANNUAL figures. Returns { flatTax, exemptTax, fullyExempt, progTax }.
  // isResidential=false → Tracks A (exemption) & B (flat) are unavailable
  // (returned as null) so commercial callers can gray them; only Track C applies.
  function computeTracks({ grossAnnual, otherAnnualIncome = 0, annualExpenses = 0, over60 = false, isResidential = true }) {
    const C_EXEMPT = 67848;

    const R   = grossAnnual;
    const O   = otherAnnualIncome;
    const E   = Math.min(annualExpenses, R);
    const Net = Math.max(0, R - E);

    // Track C: Progressive Rate (residential and commercial)
    let progTax;
    if (over60) {
      progTax = calcTaxActive(Net);
    } else if (O > 0) {
      let T;
      if (O <= 269280)      T = 0.31;
      else if (O <= 560280) T = 0.35;
      else                  T = 0.47;
      progTax = T * Net;
    } else {
      progTax = calcTaxPassive(Net);
    }

    // Tracks A & B apply to residential only
    if (!isResidential) {
      return { flatTax: null, exemptTax: null, fullyExempt: false, progTax };
    }

    // Track B: Flat Rate
    const flatTax = 0.10 * R;

    // Track A: Standard Exemption
    let exemptTax;
    let fullyExempt = false;

    if (R <= C_EXEMPT) {
      exemptTax = 0;
      fullyExempt = true;
    } else if (R >= 2 * C_EXEMPT) {
      // Above 2x the ceiling the standard exemption is fully phased out, so the
      // rent is taxed exactly like the progressive track (Track C) — the full
      // ladder for an over-60, other-income stacking otherwise — not the under-60
      // passive floor (per ITA, rental income of an individual aged 60+ uses the
      // personal-exertion starting brackets).
      exemptTax = progTax;
    } else {
      let T;
      if (O > 0) {
        if (O <= 269280)      T = 0.31;
        else if (O <= 560280) T = 0.35;
        else                  T = 0.47;
      } else {
        T = over60 ? 0.10 : 0.31;
      }
      exemptTax = T * (2 * (R - C_EXEMPT) * (1 - Math.min(E / R, 1)));
    }

    return { flatTax, exemptTax, fullyExempt, progTax };
  }

  // ── Capital Gains shared helpers (§48A linear-split method) ──────

  // purchasePrice − depreciationClaimed + capitalImprovements
  function adjustedBasis(purchasePrice, depreciationClaimed, capitalImprovements) {
    return purchasePrice - depreciationClaimed + capitalImprovements;
  }

  // Gross gain before tax; floored at 0 (no negative gain)
  function nominalGain(salePrice, saleExpenses, acquisitionExpenses, basis) {
    return Math.max(0, salePrice - saleExpenses - acquisitionExpenses - basis);
  }

  // ── Individual interest income (§125C two-rate regime) ───────────
  // INDIVIDUALS ONLY. Israeli-source interest of an individual is taxed under
  // ITO §125C at 25% when the principal is CPI- or FX-linked, else 15%.
  // Foreign residents are exempt on interest from a traded Israeli bond
  // (ITO §15D) and on certain foreign-currency deposits; their other
  // Israeli-source interest bears 25% statutory withholding, which a treaty may
  // reduce. New-immigrant / returning-resident relief (ITO §14, §9(15)) exempts
  // foreign-source interest. Interest paid to a substantial shareholder, an
  // employee, or under special relations is recharacterized and taxed on the
  // marginal ladder (mirrors computeTracks Track C; reuses calcTaxActive /
  // calcTaxPassive). Companies use the ordinary corporate pipeline, not this
  // helper. Statute refs live in comments only — never in a return value.
  function interestIndividual({
    amount = 0,
    residency = 'foreign',          // 'foreign' | 'israeli'
    source = 'israeli',             // 'israeli' | 'foreign'
    instrument = 'other',           // 'traded_bond' | 'fx_deposit' | 'other'
    linked = false,                 // CPI/FX-linked → 25%; unlinked → 15%
    recharacterize = false,         // substantial shareholder / employee / special relations
    oleh = false,
    over60 = false,
    otherAnnualIncome = 0,          // stacking for the recharacterized progressive branch
    treatyRatePct = null,           // foreign-resident Israeli-source 'other' override
    foreignWithheldPct = 0,         // FTC input for the Israeli-resident foreign-source branch
    connectedToIsraeliPE = false,   // effectively connected to an Israeli permanent establishment
  }) {
    const clampPct = (p) => Math.min(100, Math.max(0, p));

    let exempt          = false;
    let statutoryTax    = 0;
    let israeliTax      = 0;
    let treatyTax       = null;
    let foreignWithheld = 0;
    let ftcActive       = false;
    let modeled         = true;
    let branch          = 'none';

    // No interest → all-zero result (guards effective against 0/0).
    if (amount <= 0) {
      return { amount, exempt, statutoryTax, israeliTax, treatyTax,
               foreignWithheld, ftcActive, effective: 0, modeled, branch };
    }

    // Permanent-establishment carve-out (takes precedence over every branch below):
    // PE re-sources the income to Israel and taxes it as business profits
    // attributable to the PE — outside this passive helper; disclosed in UI. This
    // stops a blanket 0%/exempt path from silently misstating a PE-connected case.
    if (connectedToIsraeliPE) {
      return { amount, exempt: false, statutoryTax: 0, israeliTax: 0, treatyTax: null,
               foreignWithheld: 0, ftcActive: false, effective: 0, modeled: false,
               branch: 'pe_business_profits' };
    }

    if (residency === 'foreign') {
      if (source !== 'israeli') {
        // Foreign-source interest of a foreign resident is outside Israeli tax.
        branch = 'foreign_resident_foreign_source';
      } else if (instrument === 'traded_bond') {
        // §15D: foreign resident exempt on interest from a traded Israeli bond.
        exempt = true;
        branch = 'exempt_traded_bond_15D';
      } else if (instrument === 'fx_deposit') {
        // Foreign resident exempt on qualifying foreign-currency deposit interest.
        exempt = true;
        branch = 'exempt_fx_deposit';
      } else {
        // Foreign resident, Israeli-source 'other' interest: 25% statutory
        // withholding, optionally reduced by a user-supplied treaty rate
        // (capped at the 25% statutory rate).
        statutoryTax = 0.25 * amount;
        israeliTax   = statutoryTax;
        if (treatyRatePct != null && treatyRatePct >= 0) {
          const tRate = Math.min(0.25, clampPct(treatyRatePct) / 100);
          treatyTax  = tRate * amount;
          israeliTax = treatyTax;
        }
        branch = 'foreign_resident_israeli_source';
      }
    } else {   // Israeli resident
      if (source !== 'israeli') {
        if (oleh) {
          // §14 / §9(15): new-immigrant exemption on foreign-source interest.
          exempt = true;
          branch = 'oleh_foreign_source_exempt';
        } else {
          // §125C: a foreign-currency exchange rate is a linkage index, so a foreign-currency
          // interest asset is "linked" → the 25% cap applies (not 15%). Foreign tax relief is a
          // direct FTC capped at the Israeli liability with no refund of excess, so the burden
          // collapses to max(Israeli rate, foreign withholding). Recharacterization (≥10% holder
          // in the foreign payer / employee / special relations) → marginal ladder, same as domestic.
          const gross = recharacterize
            ? (over60 ? calcTaxActive(amount)
               : otherAnnualIncome > 0 ? (otherAnnualIncome <= 269280 ? 0.31 : otherAnnualIncome <= 560280 ? 0.35 : 0.47) * amount
               : calcTaxPassive(amount))
            : 0.25 * amount;
          foreignWithheld = (clampPct(foreignWithheldPct) / 100) * amount;
          statutoryTax    = gross;
          israeliTax      = Math.max(0, gross - foreignWithheld);
          ftcActive       = true;
          branch = recharacterize ? 'israeli_resident_foreign_source_recharacterized'
                                  : 'israeli_resident_foreign_source';
        }
      } else if (recharacterize) {
        // Recharacterized interest (substantial shareholder / employee / special
        // relations) is taxed on the marginal ladder — mirrors computeTracks
        // Track C exactly.
        if (over60) {
          israeliTax = calcTaxActive(amount);
        } else if (otherAnnualIncome > 0) {
          const T = otherAnnualIncome <= 269280 ? 0.31
                  : otherAnnualIncome <= 560280 ? 0.35
                  : 0.47;
          israeliTax = T * amount;
        } else {
          israeliTax = calcTaxPassive(amount);
        }
        statutoryTax = israeliTax;
        branch = 'recharacterized_marginal';
      } else {
        // §125C: 25% if CPI/FX-linked, else 15%. (Oleh Israeli-source interest is
        // taxed identically; any FX carve-out is a UI note only.)
        const rate   = linked ? 0.25 : 0.15;
        israeliTax   = rate * amount;
        statutoryTax = israeliTax;
        branch = linked ? 'israeli_resident_linked_25' : 'israeli_resident_unlinked_15';
      }
    }

    let effective;
    if (exempt)         effective = 0;
    else if (ftcActive) effective = (foreignWithheld + israeliTax) / amount;
    else                effective = israeliTax / amount;

    return { amount, exempt, statutoryTax, israeliTax, treatyTax,
             foreignWithheld, ftcActive, effective, modeled, branch };
  }

  // ── Individual crypto / digital-asset capital gain (§88 property) ─
  // INDIVIDUALS ONLY. A digital asset is "property" under ITO §88, not a bond, so
  // a disposal is an ordinary capital gain taxed on the NOMINAL gain (no inflation
  // indexing — see CLAUDE.md) at the §91/§121B 25% capital-gains rate. Source
  // matters only for an oleh: the §14 new-immigrant relief exempts a FOREIGN-source
  // gain for ten years, while an Israeli-source gain is taxed from day one. A
  // foreign resident has no traded-bond / FX-deposit carve-out here (crypto is §88
  // property, not §15D debt), so any crypto gain is Israeli-taxable at 25%. An
  // Israeli resident's foreign tax is a direct FTC capped at the Israeli liability
  // (no refund of excess), so the burden collapses to max(Israeli tax, foreign tax).
  // Crypto has no permanent-establishment carve-out. A security token granting
  // equity rights in a corporation can attract a different rate — that case is not
  // modeled here (standard crypto only); it's disclosed in the UI. Statute refs
  // live in comments only — never in a return value.
  function cryptoIndividual({
    amount = 0,                     // gross proceeds (NIS)
    costBasis = 0,                  // FIFO cost basis incl. fees (NIS)
    residency = 'foreign',          // 'foreign' | 'israeli' | 'oleh'
    source = 'foreign',             // 'foreign' | 'israeli' — only distinguishes the oleh branch
    foreignWithheld = 0,            // foreign tax withheld (NIS) — FTC input for the Israeli-resident branch
  }) {
    const RATE = 0.25;
    const gain = Math.max(0, amount - costBasis);

    let exempt    = false;
    let rate      = RATE;
    let ftcActive = false;
    let fw        = 0;
    const modeled = true;
    let branch;

    if (residency === 'oleh' && source === 'foreign') {
      // §14: foreign-source crypto gain is exempt within the 10-year window.
      exempt = true;
      rate   = 0;
      branch = 'oleh_foreign_source_exempt';
    } else if (residency === 'foreign') {
      // Foreign resident: 25% on any-source crypto gain (no §15D carve-out).
      rate   = RATE;
      branch = 'foreign_resident_crypto';
    } else if (residency === 'israeli') {
      // Israeli resident (non-oleh): 25%, direct FTC for foreign tax withheld.
      rate      = RATE;
      ftcActive = true;
      branch    = 'israeli_resident_crypto';
    } else {
      // Oleh, Israeli-source crypto: taxed from day one at 25%.
      rate   = RATE;
      branch = 'oleh_israeli_source_crypto';
    }

    const statutoryTax = exempt ? 0 : rate * gain;
    let israeliTax = statutoryTax;
    if (ftcActive) {
      fw         = Math.max(0, foreignWithheld);
      israeliTax = Math.max(0, statutoryTax - fw);
    }

    let effective;
    if (gain <= 0 || exempt) effective = 0;
    else if (ftcActive)      effective = (fw + israeliTax) / gain;   // = max(statutory, foreign) / gain
    else                     effective = israeliTax / gain;

    return { amount, gain, costBasis, exempt, statutoryTax, israeliTax,
             foreignWithheld: fw, ftcActive, effective, modeled, branch };
  }

  // ── Company (corporate) tax helpers ──────────────────────────────
  // Pure mirrors of the inline corporate math in calculator2.sections.js
  // (runCoILRegCalc / runCoFORRegCalc) so the company real-estate CG section
  // can share one source of truth with the rental sections.

  // Israeli company: flat corporate tax (ITO §126(a), 23%) on net company
  // income, then a dividend on the after-tax profit distributed to a
  // "substantial shareholder" (a ≥10% holder; ITO §125B(b), 30%). The dividend
  // is taken in proportion to ownershipPct; full distribution at 100% gives the
  // ~46.1% combined burden.
  function corporateIsraeli({ grossAnnual = 0, annualExpenses = 0, ownershipPct = 100 }) {
    const CORP_RATE     = 0.23;
    const DIVIDEND_RATE = 0.30;
    const net       = Math.max(0, grossAnnual - annualExpenses);
    const ownership = Math.min(100, Math.max(0, ownershipPct)) / 100;
    const corpTax   = net * CORP_RATE;
    const afterTax  = net * (1 - CORP_RATE);
    const divTax    = afterTax * ownership * DIVIDEND_RATE;
    const combined  = corpTax + divTax;
    const combinedEffective = net > 0 ? combined / net : 0;
    return { net, corpTax, afterTax, divTax, combined, combinedEffective };
  }

  // Foreign company: corporate tax (ITO §126(a), 23%). On the withholding basis
  // the 23% applies to gross (deductible expenses ignored); on a filed return it
  // applies to net. Foreign shareholders owe no Israeli dividend tax on
  // distribution, so dividendTax is 0 and the combined effective Israeli rate
  // equals the corporate effective rate.
  function corporateForeign({ grossAnnual = 0, annualExpenses = 0, withholdingBasis = false }) {
    const CORP_RATE = 0.23;
    const base        = withholdingBasis ? grossAnnual : Math.max(0, grossAnnual - annualExpenses);
    const tax         = CORP_RATE * base;
    const effective   = grossAnnual > 0 ? tax / grossAnnual : 0;
    const dividendTax = 0;
    return { base, tax, effective, dividendTax, combinedEffective: effective };
  }

  // A company's Israeli real-estate capital gain is taxed at the FLAT corporate
  // rate (23%) on the nominal gain (inflation indexing is not applied) — no
  // individual-style §48A 47/20/25 historical split and no single-residence
  // exemption, regardless of holding period; residential and commercial are
  // computationally identical for a company. Distribution then follows the
  // rental rules above (Israeli → +30% dividend to a substantial shareholder;
  // foreign → no Israeli dividend tax).
  function companyRealEstateCG({ purchasePrice = 0, depreciation = 0, improvements = 0,
      salePrice = 0, saleExpenses = 0, acqExpenses = 0,
      israeli = true, ownershipPct = 100 }) {
    const basis = adjustedBasis(purchasePrice, depreciation, improvements);
    const gain  = nominalGain(salePrice, saleExpenses, acqExpenses, basis);
    const corp = israeli
      ? corporateIsraeli({ grossAnnual: gain, annualExpenses: 0, ownershipPct })
      : corporateForeign({ grossAnnual: gain, annualExpenses: 0, withholdingBasis: false });
    return { gain, ...corp };
  }

  // Israeli company receiving a dividend on shares it holds.
  // A dividend out of another ISRAELI company's Israeli-source income is excluded
  // from the recipient company's taxable income — 0% corporate (ITO §126(b)). A
  // FOREIGN-source dividend is included at the 23% corporate rate (ITO §126(c)),
  // with a DIRECT foreign tax credit for foreign withholding (excess is not
  // refunded). An indirect/underlying FTC election can further offset the foreign
  // corporate tax — NOT computed here (disclosed in the UI). Distributing the
  // after-tax amount to a substantial individual shareholder then adds 30% (§125B).
  function companyDividendIsraeli({ dividend, source = 'israeli', foreignWithheldPct = 0, ownershipPct = 100 }) {
    const CORP_RATE     = 0.23;
    const DIVIDEND_RATE = 0.30;
    const own = Math.min(100, Math.max(0, ownershipPct)) / 100;
    let corpTax = 0, foreignWithheld = 0;
    if (source !== 'israeli') {
      foreignWithheld = (Math.min(100, Math.max(0, foreignWithheldPct)) / 100) * dividend;
      const gross = CORP_RATE * dividend;              // §126(c): included at 23%
      corpTax = Math.max(0, gross - foreignWithheld);  // direct FTC, no refund of excess
    }
    const companyBurden = corpTax + foreignWithheld;
    const afterTax      = Math.max(0, dividend - companyBurden);
    const distributed   = afterTax * own;
    const divTax        = DIVIDEND_RATE * distributed; // 30% to substantial individual
    const combined      = companyBurden + divTax;
    const combinedEffective = dividend > 0 ? combined / dividend : 0;
    return { corpTax, foreignWithheld, companyBurden, afterTax, distributed, divTax, combined, combinedEffective };
  }

  // ── DD/MM/YYYY (Israeli format) date helpers ─────────────────────
  // Parse "DD/MM/YYYY" → local-midnight Date.  Returns null if blank,
  // malformed, or a non-existent calendar date (e.g. 31/02/2020).
  // Built by hand because new Date("DD/MM/YYYY") misparses the order.
  function parseDMY(str) {
    const m = (str || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const day = +m[1], month = +m[2], year = +m[3];
    const d = new Date(year, month - 1, day);   // local midnight
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }

  // Format a Date → "DD/MM/YYYY" (local).
  function formatDMY(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + d.getFullYear();
  }

  // Days between two Date objects (d2 − d1)
  function daysBetween(d1, d2) {
    return Math.round((d2.getTime() - d1.getTime()) / 86400000);
  }

  // §48A straight-line allocation of gainValue across periods defined by
  // cutoffDates (array of Date objects).  Cutoffs outside the ownership
  // window are silently ignored.
  // Returns: Array of { from: Date, to: Date, days: number, gain: number }
  function linearSplit(gainValue, purchaseDate, saleDate, cutoffDates) {
    const total = daysBetween(purchaseDate, saleDate);
    if (total <= 0) return [];

    // Build sorted boundary list, clipped to [purchaseDate, saleDate]
    const inner = cutoffDates
      .filter(d => d > purchaseDate && d < saleDate)
      .sort((a, b) => a - b);
    const boundaries = [purchaseDate, ...inner, saleDate];

    return boundaries.slice(0, -1).map((from, i) => {
      const to   = boundaries[i + 1];
      const days = daysBetween(from, to);
      return { from, to, days, gain: gainValue * (days / total) };
    });
  }
