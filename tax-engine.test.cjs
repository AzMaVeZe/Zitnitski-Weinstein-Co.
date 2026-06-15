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
             adjustedBasis, nominalGain, realGain,
             parseDMY, formatDMY, daysBetween, linearSplit };`)();
const {
  BRACKETS, calcTaxPassive, calcTaxActive, fmt, computeTracks,
  adjustedBasis, nominalGain, realGain, parseDMY, formatDMY, daysBetween, linearSplit,
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

// ── EXPECT: known-correct values (SLOTS FOR YOU) ───────────────────────────
//   Leave a case out (or null) to skip the correctness check for it.
//   When set, the runner compares the engine output to your value AND warns if
//   the locked baseline disagrees with it. Keys are the case ids printed below.
//
//   Example:
//   'computeTracks :: residential | gross<C_EXEMPT | no other | under60':
//       { flatTax: 5000, exemptTax: 0, fullyExempt: true, progTax: 15500 },
const EXPECT = {
  // ←─ add known-correct assertions here ─→
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
add('realGain',      'CPI override 500k present',            realGain(500000, 800000));
add('realGain',      'no override → nominal flagged',        realGain(0, 800000));
add('realGain',      'negative override ignored',            realGain(-5, 800000));
add('linearSplit',   '2010→2020, cutoff 2014',  sp(linearSplit(800000, D(2010,1,1), D(2020,1,1), [D(2014,1,1)])));
add('linearSplit',   'cutoff before purchase (ignored)', sp(linearSplit(800000, D(2016,1,1), D(2020,1,1), [D(2014,1,1)])));
add('linearSplit',   'sale before purchase → []', sp(linearSplit(800000, D(2020,1,1), D(2010,1,1), [D(2014,1,1)])));
add('linearSplit',   'same day → []',             sp(linearSplit(800000, D(2014,1,1), D(2014,1,1), [D(2014,1,1)])));

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
const haveBaseline = fs.existsSync(baselinePath);
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
