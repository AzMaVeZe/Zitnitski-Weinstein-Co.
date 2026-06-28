// ─────────────────────────────────────────────────────────────────────────
// tax-engine.test.cjs — characterization / regression baseline for tax-engine.js
//
//   node tax-engine.test.cjs
//
// WHAT THIS DOES
//   • Loads tax-engine.js WITHOUT modifying it (it's a classic <script>, no
//     exports) by wrapping its text in `new Function` and returning its symbols.
//   • Captures the engine's CURRENT outputs and locks them as a regression
//     baseline in tax-engine.baseline.json (created on first run). On later runs,
//     any drift from that snapshot is reported as DRIFT. Re-baseline by deleting
//     the json.
//   • This is a GOLDEN-MASTER of "what the engine does today" — NOT a claim that
//     the numbers are tax-correct. Fill the EXPECT slots below with hand-verified
//     figures to additionally assert correctness; mismatches between the engine
//     and your EXPECT value are reported separately.
//   • Pure functions only — no DOM, no jsdom.
// ─────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

// ── Load the engine without touching the file ──
const engineSrc = fs.readFileSync(path.join(__dirname, 'tax-engine.js'), 'utf8');
const engine = new Function(engineSrc + `
  ; return { BRACKETS, calcTaxPassive, calcTaxActive, fmt, computeTracks,
             adjustedBasis, nominalGain, interestIndividual, cryptoIndividual,
             corporateIsraeli, corporateForeign, companyRealEstateCG, companyDividendIsraeli,
             parseDMY, formatDMY, daysBetween, linearSplit };`)();
const {
  BRACKETS, calcTaxPassive, calcTaxActive, fmt, computeTracks,
  adjustedBasis, nominalGain, interestIndividual, cryptoIndividual,
  corporateIsraeli, corporateForeign, companyRealEstateCG, companyDividendIsraeli,
  parseDMY, formatDMY, daysBetween, linearSplit,
} = engine;

const C_EXEMPT = 67848;                 // mirror of the engine constant (for case labels only)
const D  = (y, m, d) => new Date(y, m - 1, d);            // local-midnight Date
const sp = arr => arr.map(p => ({ from: formatDMY(p.from), to: formatDMY(p.to), days: p.days, gain: p.gain }));
const dmy = s => { const d = parseDMY(s); return d ? formatDMY(d) : null; };

// Normalize for stable, readable comparison: round numbers to 6dp; stringify
// non-finite numbers (NaN/Infinity) so JSON keeps them; recurse arrays/objects.
function norm(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : String(v);
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = norm(v[k]); return o; }
  return v;
}

// ── EXPECT: known-correct values ──────────────────────────────────────────
//   Verified against authoritative Israeli tax figures: 2024 brackets &
//   ceilings (frozen 2025–2027 by the Dec-2024 freeze law); §121 passive /
//   age-60 floor; §122 flat-10%; §49 single-residence cap + §48A linear.
//   Each value was reproduced by an independent calc from the confirmed annual
//   brackets and matched the engine exactly.
//
//   TWO PREVIOUSLY OMITTED CASES — now resolved (see chat):
//   • residential | gross>2*C_EXEMPT | no other | OVER60
//       Fixed in the engine: above 2x the ceiling the standard exemption is fully
//       phased out, so Track A now equals the progressive track (Track C = 30074,
//       the full age-60 ladder) instead of the under-60 passive floor (62000).
//   • residential | gross>C_EXEMPT | expenses 40k | under60
//       Confirmed correct as-is: Track A reduces its taxable base by the
//       proportional (1 - E/R) expense deduction (exemptTax = 11960.544).
const EXPECT = {
  "BRACKETS :: table (2024, monthly NIS)": [
    {
      "min": 0,
      "max": 7010,
      "rate": 0.1,
      "label": "₪0 – ₪7,010"
    },
    {
      "min": 7010,
      "max": 10060,
      "rate": 0.14,
      "label": "₪7,011 – ₪10,060"
    },
    {
      "min": 10060,
      "max": 16150,
      "rate": 0.2,
      "label": "₪10,061 – ₪16,150"
    },
    {
      "min": 16150,
      "max": 22440,
      "rate": 0.31,
      "label": "₪16,151 – ₪22,440"
    },
    {
      "min": 22440,
      "max": 46690,
      "rate": 0.35,
      "label": "₪22,441 – ₪46,690"
    },
    {
      "min": 46690,
      "max": "Infinity",
      "rate": 0.47,
      "label": "Above ₪46,690"
    }
  ],
  "calcTaxPassive :: income 0": 0,
  "calcTaxPassive :: income 50000": 15500,
  "calcTaxPassive :: income 84120": 26077.2,
  "calcTaxPassive :: income 269280": 83476.8,
  "calcTaxPassive :: income 269281": 83477.15,
  "calcTaxPassive :: income 400000": 129228.8,
  "calcTaxPassive :: income 560280": 185326.8,
  "calcTaxPassive :: income 700000": 250995.2,
  "calcTaxActive :: income 0": 0,
  "calcTaxActive :: income 50000": 5000,
  "calcTaxActive :: income 84120": 8412,
  "calcTaxActive :: income 200000": 30074,
  "calcTaxActive :: income 269280": 51550.8,
  "calcTaxActive :: income 560280": 153400.8,
  "calcTaxActive :: income 700000": 219069.2,
  "computeTracks :: residential | gross<C_EXEMPT | no other | under60": {
    "flatTax": 5000,
    "exemptTax": 0,
    "fullyExempt": true,
    "progTax": 15500
  },
  "computeTracks :: residential | gross=C_EXEMPT | no other | under60": {
    "flatTax": 6784.8,
    "exemptTax": 0,
    "fullyExempt": true,
    "progTax": 21032.88
  },
  "computeTracks :: residential | gross>C_EXEMPT (<2x) | no other | under60": {
    "flatTax": 10000,
    "exemptTax": 19934.24,
    "fullyExempt": false,
    "progTax": 31000
  },
  "computeTracks :: residential | gross=2*C_EXEMPT | no other | under60": {
    "flatTax": 13569.6,
    "exemptTax": 42065.76,
    "fullyExempt": false,
    "progTax": 42065.76
  },
  "computeTracks :: residential | gross>2*C_EXEMPT | no other | under60": {
    "flatTax": 20000,
    "exemptTax": 62000,
    "fullyExempt": false,
    "progTax": 62000
  },
  "computeTracks :: residential | gross>C_EXEMPT | other 300k | under60": {
    "flatTax": 10000,
    "exemptTax": 22506.4,
    "fullyExempt": false,
    "progTax": 35000
  },
  "computeTracks :: residential | gross>C_EXEMPT | other 600k | under60": {
    "flatTax": 10000,
    "exemptTax": 30222.88,
    "fullyExempt": false,
    "progTax": 47000
  },
  "computeTracks :: residential | gross>C_EXEMPT | no other | OVER60": {
    "flatTax": 10000,
    "exemptTax": 6430.4,
    "fullyExempt": false,
    "progTax": 10635.2
  },
  "computeTracks :: residential | gross>2*C_EXEMPT | no other | OVER60": {
    "flatTax": 20000,
    "exemptTax": 30074,
    "fullyExempt": false,
    "progTax": 30074
  },
  "computeTracks :: residential | gross>C_EXEMPT | expenses 40k | under60": {
    "flatTax": 10000,
    "exemptTax": 11960.544,
    "fullyExempt": false,
    "progTax": 18600
  },
  "computeTracks :: commercial | gross>C_EXEMPT | no other | under60": {
    "flatTax": null,
    "exemptTax": null,
    "fullyExempt": false,
    "progTax": 31000
  },
  "computeTracks :: commercial | gross>C_EXEMPT | other 600k | under60": {
    "flatTax": null,
    "exemptTax": null,
    "fullyExempt": false,
    "progTax": 47000
  },
  "computeTracks :: commercial | gross>C_EXEMPT | no other | OVER60": {
    "flatTax": null,
    "exemptTax": null,
    "fullyExempt": false,
    "progTax": 10635.2
  },
  "computeTracks :: commercial | gross<C_EXEMPT | no other | under60": {
    "flatTax": null,
    "exemptTax": null,
    "fullyExempt": false,
    "progTax": 15500
  },
  "adjustedBasis :: price 1.0M, depr 50k, improv 200k": 1150000,
  "adjustedBasis :: price 1.0M, no depr/improv": 1000000,
  "nominalGain :: sale 2.0M − 30k − 20k − basis 1.15M": 800000,
  "nominalGain :: underwater (floored at 0)": 0,
  "linearSplit :: 2010→2020, cutoff 2014": [
    {
      "from": "01/01/2010",
      "to": "01/01/2014",
      "days": 1461,
      "gain": 320043.81161
    },
    {
      "from": "01/01/2014",
      "to": "01/01/2020",
      "days": 2191,
      "gain": 479956.18839
    }
  ],
  "linearSplit :: cutoff before purchase (ignored)": [
    {
      "from": "01/01/2016",
      "to": "01/01/2020",
      "days": 1461,
      "gain": 800000
    }
  ],
  "linearSplit :: sale before purchase → []": [],
  "linearSplit :: same day → []": [],
  "companyRealEstateCG :: israeli | sale 2.0M / basis 1.0M | 100% own": {
    "gain": 1000000,
    "net": 1000000,
    "corpTax": 230000,
    "afterTax": 770000,
    "divTax": 231000,
    "combined": 461000,
    "combinedEffective": 0.461
  },
  "companyRealEstateCG :: israeli | sale 2.0M / basis 1.0M | 50% own": {
    "gain": 1000000,
    "net": 1000000,
    "corpTax": 230000,
    "afterTax": 770000,
    "divTax": 115500,
    "combined": 345500,
    "combinedEffective": 0.3455
  },
  "companyRealEstateCG :: foreign | sale 2.0M / basis 1.0M": {
    "gain": 1000000,
    "base": 1000000,
    "tax": 230000,
    "effective": 0.23,
    "dividendTax": 0,
    "combinedEffective": 0.23
  },
  "companyDividendIsraeli :: domestic | dividend 100k | own 100%": {
    "corpTax": 0,
    "foreignWithheld": 0,
    "companyBurden": 0,
    "afterTax": 100000,
    "distributed": 100000,
    "divTax": 30000,
    "combined": 30000,
    "combinedEffective": 0.3
  },
  "companyDividendIsraeli :: domestic | dividend 100k | own 50%": {
    "corpTax": 0,
    "foreignWithheld": 0,
    "companyBurden": 0,
    "afterTax": 100000,
    "distributed": 50000,
    "divTax": 15000,
    "combined": 15000,
    "combinedEffective": 0.15
  },
  "companyDividendIsraeli :: foreign | 100k | withholding 15% | own 100%": {
    "corpTax": 8000,
    "foreignWithheld": 15000,
    "companyBurden": 23000,
    "afterTax": 77000,
    "distributed": 77000,
    "divTax": 23100,
    "combined": 46100,
    "combinedEffective": 0.461
  },
  "companyDividendIsraeli :: foreign | 100k | withholding 30% | own 100%": {
    "corpTax": 0,
    "foreignWithheld": 30000,
    "companyBurden": 30000,
    "afterTax": 70000,
    "distributed": 70000,
    "divTax": 21000,
    "combined": 51000,
    "combinedEffective": 0.51
  },
  "interestIndividual :: foreign | israeli-source | other | no treaty": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 25000,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0.25,
    "modeled": true,
    "branch": "foreign_resident_israeli_source"
  },
  "interestIndividual :: foreign | israeli-source | other | treaty 15%": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 15000,
    "treatyTax": 15000,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0.15,
    "modeled": true,
    "branch": "foreign_resident_israeli_source"
  },
  "interestIndividual :: foreign | israeli-source | traded_bond": {
    "amount": 100000,
    "exempt": true,
    "statutoryTax": 0,
    "israeliTax": 0,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0,
    "modeled": true,
    "branch": "exempt_traded_bond_15D"
  },
  "interestIndividual :: foreign | foreign-source": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 0,
    "israeliTax": 0,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0,
    "modeled": true,
    "branch": "foreign_resident_foreign_source"
  },
  "interestIndividual :: israeli | israeli-source | unlinked | no rechar": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 15000,
    "israeliTax": 15000,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0.15,
    "modeled": true,
    "branch": "israeli_resident_unlinked_15"
  },
  "interestIndividual :: israeli | israeli-source | linked | no rechar": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 25000,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0.25,
    "modeled": true,
    "branch": "israeli_resident_linked_25"
  },
  "interestIndividual :: israeli | israeli-source | recharacterize | under60 | no other": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 31000,
    "israeliTax": 31000,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0.31,
    "modeled": true,
    "branch": "recharacterized_marginal"
  },
  "interestIndividual :: israeli | israeli-source | recharacterize | over60 | no other": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 10635.2,
    "israeliTax": 10635.2,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0.106352,
    "modeled": true,
    "branch": "recharacterized_marginal"
  },
  "interestIndividual :: oleh | foreign-source": {
    "amount": 100000,
    "exempt": true,
    "statutoryTax": 0,
    "israeliTax": 0,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0,
    "modeled": true,
    "branch": "oleh_foreign_source_exempt"
  },
  "interestIndividual :: israeli | foreign-source | non-oleh | fw 15%": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 10000,
    "treatyTax": null,
    "foreignWithheld": 15000,
    "ftcActive": true,
    "effective": 0.25,
    "modeled": true,
    "branch": "israeli_resident_foreign_source"
  },
  "interestIndividual :: israeli | foreign-source | non-oleh | fw 30%": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 0,
    "treatyTax": null,
    "foreignWithheld": 30000,
    "ftcActive": true,
    "effective": 0.3,
    "modeled": true,
    "branch": "israeli_resident_foreign_source"
  },
  "interestIndividual :: israeli | foreign-source | non-oleh | recharacterize | under60 | no other | fw 0": {
    "amount": 100000,
    "exempt": false,
    "statutoryTax": 31000,
    "israeliTax": 31000,
    "treatyTax": null,
    "foreignWithheld": 0,
    "ftcActive": true,
    "effective": 0.31,
    "modeled": true,
    "branch": "israeli_resident_foreign_source_recharacterized"
  },
  "cryptoIndividual :: foreign | gain 100k": {
    "amount": 150000,
    "gain": 100000,
    "costBasis": 50000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 25000,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0.25,
    "modeled": true,
    "branch": "foreign_resident_crypto"
  },
  "cryptoIndividual :: israeli | gain 100k | fw 0": {
    "amount": 150000,
    "gain": 100000,
    "costBasis": 50000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 25000,
    "foreignWithheld": 0,
    "ftcActive": true,
    "effective": 0.25,
    "modeled": true,
    "branch": "israeli_resident_crypto"
  },
  "cryptoIndividual :: israeli | gain 100k | fw 15k": {
    "amount": 150000,
    "gain": 100000,
    "costBasis": 50000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 10000,
    "foreignWithheld": 15000,
    "ftcActive": true,
    "effective": 0.25,
    "modeled": true,
    "branch": "israeli_resident_crypto"
  },
  "cryptoIndividual :: israeli | gain 100k | fw 30k (excess, no refund)": {
    "amount": 150000,
    "gain": 100000,
    "costBasis": 50000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 0,
    "foreignWithheld": 30000,
    "ftcActive": true,
    "effective": 0.3,
    "modeled": true,
    "branch": "israeli_resident_crypto"
  },
  "cryptoIndividual :: oleh | foreign-source (exempt)": {
    "amount": 150000,
    "gain": 100000,
    "costBasis": 50000,
    "exempt": true,
    "statutoryTax": 0,
    "israeliTax": 0,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0,
    "modeled": true,
    "branch": "oleh_foreign_source_exempt"
  },
  "cryptoIndividual :: oleh | israeli-source (taxed day one)": {
    "amount": 150000,
    "gain": 100000,
    "costBasis": 50000,
    "exempt": false,
    "statutoryTax": 25000,
    "israeliTax": 25000,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0.25,
    "modeled": true,
    "branch": "oleh_israeli_source_crypto"
  },
  "cryptoIndividual :: foreign | underwater (gain floored at 0)": {
    "amount": 50000,
    "gain": 0,
    "costBasis": 80000,
    "exempt": false,
    "statutoryTax": 0,
    "israeliTax": 0,
    "foreignWithheld": 0,
    "ftcActive": false,
    "effective": 0,
    "modeled": true,
    "branch": "foreign_resident_crypto"
  },
  "parseDMY :: '15/06/2020' valid": "15/06/2020",
  "parseDMY :: '31/02/2020' invalid": null,
  "parseDMY :: '' empty": null,
  "daysBetween :: 01/01/2020 → 31/01/2020": 30,
  "fmt :: 1234567": "₪1,234,567",
  "fmt :: 0": "₪0",
  "fmt :: -5000": "₪-5,000",
  "fmt :: NaN": "—"
};

// ── Cases ──────────────────────────────────────────────────────────────────
const cases = [];
const add = (group, name, value) => cases.push({ id: `${group} :: ${name}`, group, value });

// constants snapshot (locks the 2024 bracket table + ordering)
add('BRACKETS', 'table (2024, monthly NIS)', BRACKETS);

// ===== bracket functions =====
for (const inc of [0, 50000, 84120, 269280, 269281, 400000, 560280, 700000])
  add('calcTaxPassive', `income ${inc}`, calcTaxPassive(inc));
for (const inc of [0, 50000, 84120, 200000, 269280, 560280, 700000])
  add('calcTaxActive', `income ${inc}`, calcTaxActive(inc));

// ===== computeTracks — RESIDENTIAL =====
add('computeTracks', 'residential | gross<C_EXEMPT | no other | under60',
  computeTracks({ grossAnnual: 50000, isResidential: true }));
add('computeTracks', 'residential | gross=C_EXEMPT | no other | under60',
  computeTracks({ grossAnnual: C_EXEMPT, isResidential: true }));
add('computeTracks', 'residential | gross>C_EXEMPT (<2x) | no other | under60',
  computeTracks({ grossAnnual: 100000, isResidential: true }));
add('computeTracks', 'residential | gross=2*C_EXEMPT | no other | under60',
  computeTracks({ grossAnnual: 2 * C_EXEMPT, isResidential: true }));
add('computeTracks', 'residential | gross>2*C_EXEMPT | no other | under60',
  computeTracks({ grossAnnual: 200000, isResidential: true }));
add('computeTracks', 'residential | gross>C_EXEMPT | other 300k | under60',
  computeTracks({ grossAnnual: 100000, otherAnnualIncome: 300000, isResidential: true }));
add('computeTracks', 'residential | gross>C_EXEMPT | other 600k | under60',
  computeTracks({ grossAnnual: 100000, otherAnnualIncome: 600000, isResidential: true }));
add('computeTracks', 'residential | gross>C_EXEMPT | no other | OVER60',
  computeTracks({ grossAnnual: 100000, over60: true, isResidential: true }));
add('computeTracks', 'residential | gross>2*C_EXEMPT | no other | OVER60',
  computeTracks({ grossAnnual: 200000, over60: true, isResidential: true }));
add('computeTracks', 'residential | gross>C_EXEMPT | expenses 40k | under60',
  computeTracks({ grossAnnual: 100000, annualExpenses: 40000, isResidential: true }));

// ===== computeTracks — COMMERCIAL (Tracks A & B must be null) =====
add('computeTracks', 'commercial | gross>C_EXEMPT | no other | under60',
  computeTracks({ grossAnnual: 100000, isResidential: false }));
add('computeTracks', 'commercial | gross>C_EXEMPT | other 600k | under60',
  computeTracks({ grossAnnual: 100000, otherAnnualIncome: 600000, isResidential: false }));
add('computeTracks', 'commercial | gross>C_EXEMPT | no other | OVER60',
  computeTracks({ grossAnnual: 100000, over60: true, isResidential: false }));
add('computeTracks', 'commercial | gross<C_EXEMPT | no other | under60',
  computeTracks({ grossAnnual: 50000, isResidential: false }));

// ===== CG helpers =====
add('adjustedBasis', 'price 1.0M, depr 50k, improv 200k', adjustedBasis(1000000, 50000, 200000));
add('adjustedBasis', 'price 1.0M, no depr/improv',         adjustedBasis(1000000, 0, 0));
add('nominalGain',   'sale 2.0M − 30k − 20k − basis 1.15M', nominalGain(2000000, 30000, 20000, 1150000));
add('nominalGain',   'underwater (floored at 0)',           nominalGain(1000000, 0, 0, 1200000));
add('linearSplit',   '2010→2020, cutoff 2014',  sp(linearSplit(800000, D(2010,1,1), D(2020,1,1), [D(2014,1,1)])));
add('linearSplit',   'cutoff before purchase (ignored)', sp(linearSplit(800000, D(2016,1,1), D(2020,1,1), [D(2014,1,1)])));
add('linearSplit',   'sale before purchase → []', sp(linearSplit(800000, D(2020,1,1), D(2010,1,1), [D(2014,1,1)])));
add('linearSplit',   'same day → []',             sp(linearSplit(800000, D(2014,1,1), D(2014,1,1), [D(2014,1,1)])));

// ===== companyRealEstateCG — flat 23% corporate CG; distribution per rental rules =====
//   sale 2.0M / basis 1.0M (no depr/improv/expenses) → nominal gain 1.0M
add('companyRealEstateCG', 'israeli | sale 2.0M / basis 1.0M | 100% own',
  companyRealEstateCG({ purchasePrice: 1000000, salePrice: 2000000, israeli: true, ownershipPct: 100 }));
add('companyRealEstateCG', 'israeli | sale 2.0M / basis 1.0M | 50% own',
  companyRealEstateCG({ purchasePrice: 1000000, salePrice: 2000000, israeli: true, ownershipPct: 50 }));
add('companyRealEstateCG', 'foreign | sale 2.0M / basis 1.0M',
  companyRealEstateCG({ purchasePrice: 1000000, salePrice: 2000000, israeli: false }));

// ===== companyDividendIsraeli — Israeli company receiving a dividend on shares =====
//   domestic (§126(b) 0% corporate) vs foreign (§126(c) 23% with direct FTC), then
//   §125B 30% on distribution to a substantial individual shareholder
add('companyDividendIsraeli', 'domestic | dividend 100k | own 100%',
  companyDividendIsraeli({ dividend: 100000, source: 'israeli', ownershipPct: 100 }));
add('companyDividendIsraeli', 'domestic | dividend 100k | own 50%',
  companyDividendIsraeli({ dividend: 100000, source: 'israeli', ownershipPct: 50 }));
add('companyDividendIsraeli', 'foreign | 100k | withholding 15% | own 100%',
  companyDividendIsraeli({ dividend: 100000, source: 'foreign', foreignWithheldPct: 15, ownershipPct: 100 }));
add('companyDividendIsraeli', 'foreign | 100k | withholding 30% | own 100%',
  companyDividendIsraeli({ dividend: 100000, source: 'foreign', foreignWithheldPct: 30, ownershipPct: 100 }));

// ===== interestIndividual — §125C individual interest (amount 100k) =====
//   one case per branch; modeled:false on the Israeli-resident foreign-source ASSUMPTION
add('interestIndividual', 'foreign | israeli-source | other | no treaty',
  interestIndividual({ amount: 100000, residency: 'foreign', source: 'israeli', instrument: 'other' }));
add('interestIndividual', 'foreign | israeli-source | other | treaty 15%',
  interestIndividual({ amount: 100000, residency: 'foreign', source: 'israeli', instrument: 'other', treatyRatePct: 15 }));
add('interestIndividual', 'foreign | israeli-source | traded_bond',
  interestIndividual({ amount: 100000, residency: 'foreign', source: 'israeli', instrument: 'traded_bond' }));
add('interestIndividual', 'foreign | israeli-source | fx_deposit',
  interestIndividual({ amount: 100000, residency: 'foreign', source: 'israeli', instrument: 'fx_deposit' }));
add('interestIndividual', 'foreign | foreign-source',
  interestIndividual({ amount: 100000, residency: 'foreign', source: 'foreign' }));
add('interestIndividual', 'israeli | israeli-source | unlinked | no rechar',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'israeli', linked: false }));
add('interestIndividual', 'israeli | israeli-source | linked | no rechar',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'israeli', linked: true }));
add('interestIndividual', 'israeli | israeli-source | recharacterize | under60 | no other',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'israeli', recharacterize: true }));
add('interestIndividual', 'israeli | israeli-source | recharacterize | over60 | no other',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'israeli', recharacterize: true, over60: true }));
add('interestIndividual', 'oleh | foreign-source',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'foreign', oleh: true }));
add('interestIndividual', 'israeli | foreign-source | non-oleh (ASSUMPTION, modeled:false)',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'foreign', oleh: false, foreignWithheldPct: 10 }));
add('interestIndividual', 'israeli | foreign-source | non-oleh | fw 15%',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'foreign', oleh: false, foreignWithheldPct: 15 }));
add('interestIndividual', 'israeli | foreign-source | non-oleh | fw 30%',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'foreign', oleh: false, foreignWithheldPct: 30 }));
add('interestIndividual', 'israeli | foreign-source | non-oleh | recharacterize | under60 | no other | fw 0',
  interestIndividual({ amount: 100000, residency: 'israeli', source: 'foreign', oleh: false, recharacterize: true }));
// PE carve-out (drift-lock only; modeled:false, no computed liability)
add('interestIndividual', 'foreign | israeli-source | other | PE-connected',
  interestIndividual({ amount: 100000, residency: 'foreign', source: 'israeli', instrument: 'other', connectedToIsraeliPE: true }));
add('interestIndividual', 'foreign | foreign-source | PE-connected',
  interestIndividual({ amount: 100000, residency: 'foreign', source: 'foreign', connectedToIsraeliPE: true }));

// ===== cryptoIndividual — §88 individual crypto CG (proceeds 150k, basis 50k → gain 100k) =====
//   one case per branch; nominal gain only; FTC capped at the Israeli liability
add('cryptoIndividual', 'foreign | gain 100k',
  cryptoIndividual({ amount: 150000, costBasis: 50000, residency: 'foreign' }));
add('cryptoIndividual', 'israeli | gain 100k | fw 0',
  cryptoIndividual({ amount: 150000, costBasis: 50000, residency: 'israeli' }));
add('cryptoIndividual', 'israeli | gain 100k | fw 15k',
  cryptoIndividual({ amount: 150000, costBasis: 50000, residency: 'israeli', foreignWithheld: 15000 }));
add('cryptoIndividual', 'israeli | gain 100k | fw 30k (excess, no refund)',
  cryptoIndividual({ amount: 150000, costBasis: 50000, residency: 'israeli', foreignWithheld: 30000 }));
add('cryptoIndividual', 'oleh | foreign-source (exempt)',
  cryptoIndividual({ amount: 150000, costBasis: 50000, residency: 'oleh', source: 'foreign' }));
add('cryptoIndividual', 'oleh | israeli-source (taxed day one)',
  cryptoIndividual({ amount: 150000, costBasis: 50000, residency: 'oleh', source: 'israeli' }));
add('cryptoIndividual', 'foreign | underwater (gain floored at 0)',
  cryptoIndividual({ amount: 50000, costBasis: 80000, residency: 'foreign' }));

// ===== date helpers (support linearSplit; included for coverage) =====
add('parseDMY', "'15/06/2020' valid",   dmy('15/06/2020'));
add('parseDMY', "'31/02/2020' invalid", dmy('31/02/2020'));
add('parseDMY', "'' empty",             dmy(''));
add('daysBetween', '01/01/2020 → 31/01/2020', daysBetween(D(2020,1,1), D(2020,1,31)));

// ===== fmt (bonus — NaN behavior flagged in PROBES) =====
add('fmt', '1234567', fmt(1234567));
add('fmt', '0',       fmt(0));
add('fmt', '-5000',   fmt(-5000));
add('fmt', 'NaN',     fmt(NaN));

// ── Internal-consistency PROBES (printed, not asserted) ──────────────────────
function probes() {
  const lines = [];
  const a50 = calcTaxActive(50000),  p50 = calcTaxPassive(50000);
  const a2  = calcTaxActive(200000), p2  = calcTaxPassive(200000);
  lines.push(`active vs passive @50,000 : active=${a50}  passive=${p50}  (passive ${(p50/a50).toFixed(1)}x higher)`);
  lines.push(`active vs passive @200,000: active=${a2.toFixed(0)}  passive=${p2.toFixed(0)}`);
  const hi = computeTracks({ grossAnnual: 200000, isResidential: true });
  lines.push(`residential @200k (>2*C_EXEMPT, no other, under60): Track A exemptTax=${hi.exemptTax.toFixed(2)}  Track C progTax=${hi.progTax.toFixed(2)}  → A===C? ${hi.exemptTax === hi.progTax}`);
  const justBelow = computeTracks({ grossAnnual: 2*C_EXEMPT - 1, isResidential: true });
  const atCap     = computeTracks({ grossAnnual: 2*C_EXEMPT,     isResidential: true });
  lines.push(`Track A continuity @2*C_EXEMPT boundary: just-below exemptTax=${justBelow.exemptTax.toFixed(2)}  at-boundary exemptTax=${atCap.exemptTax.toFixed(2)}`);
  return lines;
}

// ── Runner ───────────────────────────────────────────────────────────────────
const baselinePath = path.join(__dirname, 'tax-engine.baseline.json');
// `--recapture` rewrites the baseline from the current engine (same as deleting
// the json), locking newly-added cases after their EXPECT checks have passed.
const recapture    = process.argv.includes('--recapture');
const haveBaseline = fs.existsSync(baselinePath) && !recapture;
const baseline = haveBaseline ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : {};
const snapshot = {};

let drift = 0, correctChecks = 0, correctFail = 0, engineVsExpect = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const show = v => JSON.stringify(v);

console.log('═'.repeat(78));
console.log(haveBaseline ? 'REGRESSION RUN (comparing to tax-engine.baseline.json)'
                         : 'BASELINE CAPTURE (first run — creating tax-engine.baseline.json)');
console.log('═'.repeat(78));

let lastGroup = '';
for (const c of cases) {
  const got = norm(c.value);
  snapshot[c.id] = got;

  // regression status vs locked baseline
  let status;
  if (!haveBaseline)                       status = 'CAPTURED';
  else if (!(c.id in baseline))            status = 'NEW';
  else if (eq(got, baseline[c.id]))        status = 'lock OK';
  else { status = 'DRIFT!!'; drift++; }

  // correctness vs your EXPECT slot
  let exNote = '';
  if (c.id in EXPECT && EXPECT[c.id] != null) {
    correctChecks++;
    const want = norm(EXPECT[c.id]);
    if (eq(got, want)) exNote = '  EXPECT ✓';
    else { exNote = `  EXPECT ✗ want=${show(want)}`; correctFail++; }
    if (haveBaseline && c.id in baseline && !eq(baseline[c.id], want)) engineVsExpect++;
  }

  if (c.group !== lastGroup) { console.log(`\n── ${c.group} ─────────────────────────────`); lastGroup = c.group; }
  const nm = c.id.slice(c.group.length + 4);
  console.log(`  [${status}] ${nm}\n        = ${show(got)}${exNote}`);
}

console.log('\n' + '─'.repeat(78));
console.log('INTERNAL-CONSISTENCY PROBES (observational — see notes in chat):');
for (const l of probes()) console.log('  • ' + l);

if (!haveBaseline) {
  fs.writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log('\n' + '─'.repeat(78));
  console.log(`Baseline written: ${path.basename(baselinePath)} (${cases.length} cases locked).`);
}

console.log('\n' + '═'.repeat(78));
console.log(`SUMMARY: ${cases.length} cases | regression drift: ${drift} | ` +
            `EXPECT checks: ${correctChecks} (fail ${correctFail}) | engine≠EXPECT: ${engineVsExpect}`);
console.log('═'.repeat(78));
process.exit(drift > 0 || correctFail > 0 ? 1 : 0);
