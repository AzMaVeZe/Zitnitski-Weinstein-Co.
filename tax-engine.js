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
      exemptTax = calcTaxPassive(Net);
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

  // If the CPI-override field is filled (> 0), use it as the real gain.
  // Otherwise fall back to nominalGain and flag it so the UI can display
  // a "nominal — not CPI-indexed" label.
  // Returns { value: number, isNominal: boolean }
  function realGain(cpiGainOverride, nominalGainVal) {
    if (cpiGainOverride > 0) {
      return { value: cpiGainOverride, isNominal: false };
    }
    return { value: nominalGainVal, isNominal: true };
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
