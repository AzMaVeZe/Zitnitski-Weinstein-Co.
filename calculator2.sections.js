// ── calculator2.sections.js ────────────────────────────────────────
// DOM/UI layer for calculator2.html: live formatting, the section
// router, and the per-combination init functions. Classic script,
// loaded AFTER tax-engine.js (uses its globals: computeTracks, fmt,
// parseDMY, formatDMY, daysBetween, linearSplit, etc.). No build step.

  // Currency fields are capped at 13 integer digits (max ₪9,999,999,999,999):
  // past 2^53 the parseInt/toLocaleString round-trip is inexact and corrupts
  // the user's own keystrokes. 13 keeps every derived figure — including the
  // ×12 syncPair mirror — exactly representable.
  const MAX_CURRENCY_INT_DIGITS = 13;

  // Live thousands-separator formatting for a currency text input; pairs with
  // the comma-stripping parses used throughout. Keeps the caret roughly in
  // place while typing. Attached to every input[inputmode="decimal"].
  // An edit that would push the integer part past MAX_CURRENCY_INT_DIGITS is
  // ignored (previous value restored), like maxlength. _lastGood is refreshed
  // on focus so programmatic writes (resets, syncPair) can't leave it stale.
  function liveComma(el) {
    el._lastGood = el.value;
    el.addEventListener('focus', function () { this._lastGood = this.value; });
    el.addEventListener('input', function () {
      const fromEnd = this.value.length - this.selectionStart;
      const raw     = this.value.replace(/[^\d.]/g, '');
      if (raw === '') { this.value = ''; this._lastGood = ''; return; }
      const [intPart, decPart] = raw.split('.');
      if ((intPart || '').length > MAX_CURRENCY_INT_DIGITS) {
        const pos = Math.min(this._lastGood.length, Math.max(0, this.selectionStart - 1));
        this.value = this._lastGood;
        this.setSelectionRange(pos, pos);
        return;
      }
      let out = intPart ? parseInt(intPart, 10).toLocaleString('en-IL') : '0';
      if (decPart !== undefined) out += '.' + decPart;
      this.value = out;
      this._lastGood = out;
      const pos = Math.max(0, out.length - fromEnd);
      this.setSelectionRange(pos, pos);
    });
  }

  // DD/MM/YYYY input mask for a date text input. Strips the value to digits
  // (max 8) and re-renders with slashes inserted lazily — only once a digit
  // exists beyond the day/month group ("15" stays "15"; "156" renders "15/6") —
  // so deleting a character never re-inserts what was just removed. Pastes like
  // "15062020" or "15/06/2020" normalize to 15/06/2020. Display-layer only:
  // parsing and validation stay in parseDMY. Calls onInput after normalizing,
  // so it replaces the field's plain input listener.
  function attachDateMask(el, onInput) {
    el.addEventListener('input', function () {
      const digits = this.value.replace(/\D/g, '').slice(0, 8);
      let out = digits.slice(0, 2);
      if (digits.length > 2) out += '/' + digits.slice(2, 4);
      if (digits.length > 4) out += '/' + digits.slice(4);
      if (out !== this.value) {
        const caret = this.selectionStart;
        const atEnd = caret == null || caret >= this.value.length;
        const pos   = atEnd ? out.length
                            : Math.min(out.length,
                                Math.round(caret * out.length / Math.max(1, this.value.length)));
        this.value = out;
        try { this.setSelectionRange(pos, pos); } catch (e) {}
      }
      onInput();
    });
  }

  // Classify a DD/MM/YYYY field so calculations can tell "not entered"
  // (allowed) apart from "typed but invalid" (blocks with a message).
  // UI-layer year sanity floor: parseDMY (frozen — exercised by the locked test
  // suite) accepts any 4-digit year from 0100, so "15/06/0999" would otherwise
  // compute; years before 1900 are treated as typos and classified invalid,
  // reusing every existing bad-date pathway.
  function dateFieldState(id) {
    const v = (document.getElementById(id).value || '').trim();
    if (!v) return { state: 'empty', date: null };
    const d = parseDMY(v);
    if (d && d.getFullYear() < 1900) return { state: 'invalid', date: null };
    return d ? { state: 'ok', date: d } : { state: 'invalid', date: null };
  }

  // ── Shared input/DOM helpers (used by every section) ──────────────
  // Parse a numeric field: strip commas; 0 for blank/non-numeric (never NaN/±Infinity).
  function pn(id) {
    const v = parseFloat((document.getElementById(id).value || '').replace(/,/g, ''));
    return Number.isFinite(v) ? v : 0;
  }

  // Like pn(), but applies `dflt` only when the field is blank/non-numeric.
  // A genuinely entered 0 is respected — unlike `pn(id) || dflt`, where pn()'s
  // 0-for-blank makes a real 0 (e.g. 0% ownership) collapse to the default.
  function pnOr(id, dflt) {
    const raw = (document.getElementById(id).value || '').replace(/,/g, '').trim();
    if (raw === '') return dflt;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : dflt;
  }

  // Effective-rate display "NN.N%". Shows 0.0% when the base is 0 (e.g. 0%
  // attributed gross) instead of computing tax/0 → "NaN%".
  function effPct(tax, base) { return (base > 0 ? (tax / base) * 100 : 0).toFixed(1) + '%'; }

  // Two-way monthly↔annual mirror for a paired set of currency inputs.
  // The mirror write carries the same overflow cap as liveComma: a mirrored
  // product beyond exact integer representation would render corrupted digits,
  // so it writes blank instead (unreachable while sources honor the 13-digit
  // cap — max mirror is 13 digits ×12 ≈ 1.2e14, well inside 2^53). The cap is
  // deliberately NOT a 13-digit test on the mirrored output: the annual mirror
  // of a maximal 13-digit monthly value legitimately renders 15 digits — still
  // exact — and the company rental calcs read the annual field, so suppressing
  // it would change computed figures for in-cap inputs.
  function syncPair(monthlyId, annualId) {
    function mirror(fromEl, toId, factor) {
      const toEl = document.getElementById(toId);
      const v = parseFloat((fromEl.value || '').replace(/,/g, ''));
      toEl.value = (Number.isFinite(v) && Math.abs(v * factor) <= Number.MAX_SAFE_INTEGER)
        ? (+(v * factor).toFixed(2)).toLocaleString('en-IL', { maximumFractionDigits: 2 })
        : '';
      toEl._lastGood = toEl.value;
    }
    document.getElementById(monthlyId).addEventListener('input', function () { mirror(this, annualId, 12); });
    document.getElementById(annualId).addEventListener('input', function () { mirror(this, monthlyId, 1 / 12); });
  }

  // Reset helpers: blank result fields to '—', empty badge slots, drop recommend/ineligible flags.
  function blank(ids)           { ids.forEach(id => { document.getElementById(id).textContent = '—'; }); }
  function clearBadges(ids)     { ids.forEach(id => { document.getElementById(id).innerHTML = ''; }); }
  function clearTrackFlags(ids) { ids.forEach(id => { document.getElementById(id).classList.remove('track-recommended', 'track-ineligible'); }); }

  // ── Section router ────────────────────────────────────────────────
  function showSection() {
    // Routing data may be absent (direct visit), malformed (corrupted JSON),
    // or unreadable (storage disabled) — never let that blank the page.
    let saved     = {};
    let storageOk = true;
    try {
      const raw = sessionStorage.getItem('taxForm');
      if (raw === null) {
        storageOk = false;
      } else {
        saved = JSON.parse(raw);
        if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) {
          saved     = {};
          storageOk = false;
        }
      }
    } catch (e) {
      saved     = {};
      storageOk = false;
    }
    const entity   = (saved.entity   || '').trim();
    const asset    = (saved.asset    || '').trim();
    const origin   = (saved.origin   || '').trim();
    const purpose  = (saved.purpose  || '').trim();
    const property = (saved.property || '').trim();
    const shareActivity = (saved.shareActivity || '').trim();

    let key = 'fallback';

    if (entity === 'individual') {
      if (asset === 'shares') {
        // Dividend (or unspecified) keeps the existing dividend route; capital_gain
        // routes to the new individual share-CG section.
        key = shareActivity === 'capital_gain' ? 'Ind_Shares_CG' : 'Ind_Shares';
      } else if (asset === 'real_estate') {
        if (purpose === 'income') {
          key = 'Ind_RE_Inc';
        } else if (purpose === 'capital_gain') {
          if (property === 'residential')     key = 'Ind_RE_CG_Res';
          else if (property === 'commercial') key = 'Ind_RE_CG_Com';
        }
      } else if (asset === 'interest') {
        key = 'Ind_Interest';
      } else if (asset === 'crypto') {
        key = 'Ind_Crypto';
      } else if (asset === 'stock_options') {
        key = 'StockOptions';
      }
    } else if (entity === 'company') {
      if (origin === 'israeli') {
        if (asset === 'shares') {
          key = 'Co_IL_Shares';
        } else if (asset === 'real_estate') {
          if (purpose === 'income') {
            key = 'Co_IL_RE_Inc';
          } else if (purpose === 'capital_gain') {
            if (property === 'residential')     key = 'Co_IL_RE_CG_Res';
            else if (property === 'commercial') key = 'Co_IL_RE_CG_Com';
          }
        }
      } else if (origin === 'foreign') {
        if (asset === 'shares') {
          key = 'Co_FOR_Shares';
        } else if (asset === 'real_estate') {
          if (purpose === 'income') {
            key = 'Co_FOR_RE_Inc';
          } else if (purpose === 'capital_gain') {
            if (property === 'residential')     key = 'Co_FOR_RE_CG_Res';
            else if (property === 'commercial') key = 'Co_FOR_RE_CG_Com';
          }
        }
      }
    }

    // Live comma formatting on every currency field, attached before the
    // section init wires its recalc listeners so formatting runs first.
    document.querySelectorAll('input[inputmode="decimal"]').forEach(liveComma);

    const section = document.getElementById(key) || document.getElementById('fallback');
    section.style.display = '';

    // Missing/unreadable Step 1 data → explain, rather than the generic stub text
    if (key === 'fallback' && !storageOk) {
      document.getElementById('fallback_msg').textContent =
        'We could not read your selections from Step 1 — the session may have expired. Please start again.';
    }

    if      (key === 'Ind_RE_Inc')     initIndividualResidential();
    else if (key === 'Ind_RE_CG_Res') initIndCGRes();
    else if (key === 'Ind_RE_CG_Com') initIndCGCom();
    else if (key === 'Ind_Shares')    initIndShares();
    else if (key === 'Ind_Shares_CG') initIndSharesCG();
    else if (key === 'Ind_Interest')  initIndInterest();
    else if (key === 'Ind_Crypto')    initIndCrypto();
    else if (key === 'StockOptions')  initStockOptions();
    else if (key === 'Co_IL_RE_Inc')  initCoILREInc();
    else if (key === 'Co_IL_RE_CG_Res') initCoILRECG('coilcg_res_');
    else if (key === 'Co_IL_RE_CG_Com') initCoILRECG('coilcg_com_');
    else if (key === 'Co_IL_Shares')   initCoILShares();
    else if (key === 'Co_FOR_RE_Inc') initCoFORREInc();
    else if (key === 'Co_FOR_RE_CG_Res') initCoFORRECG('coforcg_res_');
    else if (key === 'Co_FOR_RE_CG_Com') initCoFORRECG('coforcg_com_');
    else if (key === 'Co_FOR_Shares')  initCoFORShares();
  }

  // ── Individual + Real Estate + Income (Rental) — event wiring ────
  function initIndividualResidential() {

    document.getElementById('hasOtherIncome').addEventListener('change', function () {
      const row    = document.getElementById('otherIncomeRow');
      const mInput = document.getElementById('otherIncome');
      const aInput = document.getElementById('otherIncome_annual');
      if (this.checked) {
        row.classList.remove('input-row-disabled');
        mInput.disabled = false;
        aInput.disabled = false;
        mInput.focus();
      } else {
        row.classList.add('input-row-disabled');
        mInput.disabled = true;
        aInput.disabled = true;
        mInput.value = '';
        aInput.value = '';
      }
    });

    // Monthly ↔ Annual sync for each row
    syncPair('rentalIncome',  'rentalIncome_annual');
    syncPair('expensesInput', 'expensesInput_annual');
    syncPair('otherIncome',   'otherIncome_annual');

    function runTrackCalc() {
      const rental   = pn('rentalIncome');
      const hasOther = document.getElementById('hasOtherIncome').checked;
      const other    = hasOther ? pn('otherIncome') : 0;
      const expenses = pn('expensesInput');
      const over60 = document.getElementById('over60Check').checked;

      const R = rental * 12;

      if (!R || R <= 0) {
        blank(['flatAnnual','flatMonthly','flatEffective',
               'exemptAnnual','exemptMonthly','exemptEffective',
               'progAnnual','progMonthly','progEffective']);
        clearBadges(['flatBadge','exemptBadge','progBadge']);
        clearTrackFlags(['flatCard','exemptCard','progCard']);
        document.getElementById('trackVerdict').textContent = '';
        return;
      }

      const { flatTax, exemptTax, fullyExempt, progTax } = computeTracks({
        grossAnnual:       R,
        otherAnnualIncome: other * 12,
        annualExpenses:    expenses * 12,
        over60,
        isResidential:     true,
      });

      // Populate cards
      document.getElementById('flatAnnual').textContent    = fmt(flatTax);
      document.getElementById('flatMonthly').textContent   = fmt(flatTax / 12);
      document.getElementById('flatEffective').textContent = ((flatTax / R) * 100).toFixed(1) + '%';

      document.getElementById('exemptAnnual').textContent    = fullyExempt ? fmt(0) : fmt(exemptTax);
      document.getElementById('exemptMonthly').textContent   = fullyExempt ? fmt(0) : fmt(exemptTax / 12);
      document.getElementById('exemptEffective').textContent = fullyExempt ? '0.0%' : ((exemptTax / R) * 100).toFixed(1) + '%';

      document.getElementById('progAnnual').textContent    = fmt(progTax);
      document.getElementById('progMonthly').textContent   = fmt(progTax / 12);
      document.getElementById('progEffective').textContent = ((progTax / R) * 100).toFixed(1) + '%';

      // Recommendation logic
      const THRESHOLD = 500;
      const tracks = [
        { id: 'exemptCard', badge: 'exemptBadge', tax: exemptTax, label: 'Track A' },
        { id: 'flatCard',   badge: 'flatBadge',   tax: flatTax,   label: 'Track B' },
        { id: 'progCard',   badge: 'progBadge',   tax: progTax,   label: 'Track C' },
      ];

      tracks.forEach(t => {
        document.getElementById(t.id).classList.remove('track-recommended');
        document.getElementById(t.badge).innerHTML = '';
      });

      if (fullyExempt) {
        document.getElementById('exemptCard').classList.add('track-recommended');
        document.getElementById('exemptBadge').innerHTML = '<span class="badge badge-recommended">Fully Exempt ✓</span>';
        document.getElementById('trackVerdict').textContent = 'You are fully exempt on Track A — ₪0 tax owed.';
        return;
      }

      const sorted   = [...tracks].sort((a, b) => a.tax - b.tax);
      const cheapest = sorted[0];
      const runnerUp = sorted[1];
      const margin   = runnerUp.tax - cheapest.tax;

      if (margin <= THRESHOLD) {
        tracks.forEach(t => {
          if (t.tax - cheapest.tax <= THRESHOLD) {
            document.getElementById(t.badge).innerHTML = '<span class="badge badge-close">Too close to call</span>';
          }
        });
        document.getElementById('trackVerdict').textContent =
          'Results are within ' + fmt(THRESHOLD) + '/year — review all tracks carefully.';
      } else if (cheapest.label === 'Track C') {
        document.getElementById('progCard').classList.add('track-recommended');
        document.getElementById('progBadge').innerHTML = '<span class="badge badge-recommended">Verify after Bituach Leumi ✓</span>';
        document.getElementById('trackVerdict').textContent =
          'Track C appears cheapest, but factor in potential Bituach Leumi before deciding.';
      } else {
        document.getElementById(cheapest.id).classList.add('track-recommended');
        document.getElementById(cheapest.badge).innerHTML = '<span class="badge badge-recommended">Recommended ✓</span>';
        document.getElementById('trackVerdict').textContent =
          cheapest.label + ' is cheapest at ' + fmt(cheapest.tax) + '/year — saving you ' + fmt(margin) + ' vs. the next best option.';
      }
    }

    ['rentalIncome', 'rentalIncome_annual',
     'otherIncome',  'otherIncome_annual',
     'expensesInput','expensesInput_annual'].forEach(id =>
      document.getElementById(id).addEventListener('input', runTrackCalc)
    );
    ['hasOtherIncome', 'over60Check'].forEach(id =>
      document.getElementById(id).addEventListener('change', runTrackCalc)
    );
  }

  // ── Individual + Real Estate + Capital Gain (Residential) ───────
  function initIndCGRes() {
    const FULL_EXEMPTION_CAP = 5008000;
    const LINEAR_CUTOFF      = new Date(2014, 0, 1);   // 1 Jan 2014 — local midnight, matches parseDMY
    const POST_RATE          = 0.25;
    const THRESHOLD          = 500;

    const saved  = JSON.parse(sessionStorage.getItem('taxForm') || '{}');
    const origin = (saved.origin || '').trim();

    document.getElementById('cg_res_saleDate').value = formatDMY(new Date());

    if (origin === 'foreign') {
      document.getElementById('cg_res_foreignNotice').style.display = '';
    }


    // ── Owned ≥ 18 months flag ────────────────────────────────────
    function updateOwnedFlag() {
      const pDate  = dateFieldState('cg_res_purchaseDate');
      const sDate  = dateFieldState('cg_res_saleDate');
      const flagEl = document.getElementById('cg_res_ownedFlag');
      if (pDate.state === 'invalid' || sDate.state === 'invalid') {
        flagEl.className   = 'cg-flag cg-flag-na';
        flagEl.textContent = 'Use DD/MM/YYYY format';
        return;
      }
      const purchase = pDate.date;
      const sale     = sDate.date;
      if (!purchase || !sale) {
        flagEl.className   = 'cg-flag cg-flag-na';
        flagEl.textContent = 'Enter dates above';
        return;
      }
      if (sale <= purchase) {
        flagEl.className   = 'cg-flag cg-flag-na';
        flagEl.textContent = 'Check the dates — sale must be after purchase';
        return;
      }
      const months   = (sale.getFullYear() - purchase.getFullYear()) * 12 +
                       (sale.getMonth() - purchase.getMonth());
      if (months >= 18) {
        flagEl.className   = 'cg-flag cg-flag-yes';
        flagEl.textContent = '✓ Yes (' + months + ' months)';
      } else {
        flagEl.className   = 'cg-flag cg-flag-no';
        flagEl.textContent = '✗ No (' + months + ' months)';
      }
    }

    // ── Reset all output elements to blank ───────────────────────
    function resetCGResCards() {
      blank(['cg_res_A_tax','cg_res_A_effective','cg_res_A_total',
             'cg_res_B_tax','cg_res_B_effective','cg_res_B_total',
             'cg_res_gainDisplay']);
      document.getElementById('cg_res_A_note').textContent           = '';
      document.getElementById('cg_res_verdict').textContent          = '';
      document.getElementById('cg_res_noDateWarn').style.display     = 'none';
      document.getElementById('cg_res_badDateWarn').style.display    = 'none';
      document.getElementById('cg_res_dateOrderWarn').style.display  = 'none';
      document.getElementById('cg_res_noSaleWarn').style.display     = 'none';
      clearBadges(['cg_res_A_badge','cg_res_B_badge']);
      clearTrackFlags(['cg_res_A_card','cg_res_B_card']);
    }

    // ── Main calculation ─────────────────────────────────────────
    function runCGResCalc() {
      const salePrice    = pn('cg_res_salePrice');
      const purchPrice   = pn('cg_res_purchasePrice');
      const acqExp       = pn('cg_res_acqExpenses');
      const saleExp      = pn('cg_res_saleExpenses');
      const improvements = pn('cg_res_improvements');
      const depreciation = pn('cg_res_depreciation');
      const pDate        = dateFieldState('cg_res_purchaseDate');
      const sDate        = dateFieldState('cg_res_saleDate');
      const purchaseDate = pDate.date;
      const saleDate_    = sDate.date;
      const onlyApt      = document.getElementById('cg_res_onlyApt').checked;
      const foreignCert  = document.getElementById('cg_res_foreignCert').checked;

      if (!salePrice) { resetCGResCards(); return; }

      // Typed-but-invalid dates block calculation instead of silently misparsing
      if (pDate.state === 'invalid' || sDate.state === 'invalid') {
        resetCGResCards();
        document.getElementById('cg_res_badDateWarn').style.display = '';
        return;
      }

      // Reversed or same-day dates block computation. A computed treatment for a
      // same-day disposal (e.g. full gain at the post-cutoff rate) would be a
      // tax-math decision requiring tax-AI sign-off — this deliberately blocks instead.
      if (purchaseDate && saleDate_ && saleDate_ <= purchaseDate) {
        resetCGResCards();
        document.getElementById('cg_res_dateOrderWarn').style.display = '';
        return;
      }

      // The sale date prefills to today, so it is only empty if the user
      // actively cleared it — prompt for it instead of computing silently.
      const noPurchase = !purchaseDate;
      const noSale     = !saleDate_;
      if (noSale) {
        resetCGResCards();
        document.getElementById('cg_res_noSaleWarn').style.display = '';
        return;
      }

      const basis = adjustedBasis(purchPrice, depreciation, improvements);
      const gain  = nominalGain(salePrice, saleExp, acqExp, basis);

      if (gain <= 0) {
        resetCGResCards();
        document.getElementById('cg_res_noDateWarn').style.display     = noPurchase ? '' : 'none';
        document.getElementById('cg_res_gainDisplay').textContent      = fmt(0) + ' (no taxable gain)';
        ['cg_res_A_tax','cg_res_A_total',
         'cg_res_B_tax','cg_res_B_total'].forEach(id => {
          document.getElementById(id).textContent = fmt(0);
        });
        document.getElementById('cg_res_A_effective').textContent = '0.0%';
        document.getElementById('cg_res_B_effective').textContent = '0.0%';
        document.getElementById('cg_res_verdict').textContent     = 'No taxable gain — no capital gains tax owed on either track.';
        return;
      }

      // ── Eligibility for §49b2 single-home exemption ──────────────
      const ownedMonths = (purchaseDate && saleDate_)
        ? (saleDate_.getFullYear() - purchaseDate.getFullYear()) * 12 +
          (saleDate_.getMonth() - purchaseDate.getMonth())
        : 0;
      const owned18   = ownedMonths >= 18;
      const foreignOK = origin !== 'foreign' || foreignCert;
      const eligible  = onlyApt && owned18 && foreignOK;

      const ineligibleReasons = [];
      if (!onlyApt)      ineligibleReasons.push('only-apartment box not checked');
      if (noPurchase)    ineligibleReasons.push('purchase date not entered — holding period unknown');
      else if (!owned18) ineligibleReasons.push('held < 18 months');
      if (!foreignOK)    ineligibleReasons.push('home-country certificate not confirmed');
      const ineligible = !eligible;

      // ── Track A: Single-Home Exemption ──────────────────────────
      let taxA         = null;
      let fullExempt   = false;
      let partialNote  = '';
      let taxableGainA = 0;

      if (eligible) {
        if (salePrice <= FULL_EXEMPTION_CAP) {
          taxA         = 0;
          fullExempt   = true;
          taxableGainA = 0;
        } else {
          const excessFraction = (salePrice - FULL_EXEMPTION_CAP) / salePrice;
          taxableGainA = gain * excessFraction;
          const periods = (purchaseDate && saleDate_)
            ? linearSplit(taxableGainA, purchaseDate, saleDate_, [LINEAR_CUTOFF])
            : [{ gain: taxableGainA }];
          const postGain = periods.length > 1 ? periods[periods.length - 1].gain : taxableGainA;
          taxA        = postGain * POST_RATE;
          partialNote = 'Proportional estimate — only the gain attributable to the sale price above ₪5,008,000 is taxed at 25%.';
        }
      }

      const totalA = ineligible ? null : (taxA || 0);

      // ── Track B: §48A linear split, exemption preserved ────────
      let postGainB;
      if (purchaseDate && saleDate_) {
        const periods = linearSplit(gain, purchaseDate, saleDate_, [LINEAR_CUTOFF]);
        postGainB = periods.length > 1 ? periods[periods.length - 1].gain : gain;
      } else {
        postGainB = gain;   // worst case: full gain at post-2014 rate
      }
      const taxB = postGainB * POST_RATE;

      const totalB = taxB;

      // ── Populate output ─────────────────────────────────────────
      resetCGResCards();
      document.getElementById('cg_res_noDateWarn').style.display = noPurchase ? '' : 'none';

      document.getElementById('cg_res_gainDisplay').textContent =
        fmt(gain) + ' (nominal — inflation indexing not applied)';

      // Track A display
      if (ineligible) {
        document.getElementById('cg_res_A_card').classList.add('track-ineligible');
        ['cg_res_A_tax','cg_res_A_effective','cg_res_A_total'].forEach(id => {
          document.getElementById(id).textContent = 'N/A';
        });
        document.getElementById('cg_res_A_badge').innerHTML =
          '<span class="badge badge-warning">Ineligible</span>';
        document.getElementById('cg_res_A_note').textContent =
          'Missing: ' + ineligibleReasons.join('; ') + '.';
      } else {
        document.getElementById('cg_res_A_tax').textContent =
          fullExempt ? fmt(0) : fmt(taxA);
        document.getElementById('cg_res_A_effective').textContent =
          fullExempt ? '0.0%' : ((taxA / gain) * 100).toFixed(1) + '%';
        document.getElementById('cg_res_A_total').textContent =
          fmt(totalA);
        if (partialNote) document.getElementById('cg_res_A_note').textContent = partialNote;
      }

      // Track B display
      document.getElementById('cg_res_B_tax').textContent       = fmt(taxB);
      document.getElementById('cg_res_B_effective').textContent = ((taxB / gain) * 100).toFixed(1) + '%';
      document.getElementById('cg_res_B_total').textContent     = fmt(totalB);

      // ── Recommendation (compare totals) ─────────────────────────
      if (ineligible) {
        document.getElementById('cg_res_B_card').classList.add('track-recommended');
        document.getElementById('cg_res_B_badge').innerHTML =
          '<span class="badge badge-recommended">Only available track ✓</span>';
        document.getElementById('cg_res_verdict').textContent =
          'Track A is unavailable (' + ineligibleReasons.join('; ') + '). '
          + 'Track B tax: ' + fmt(totalB) + '.';
        return;
      }

      if (fullExempt) {
        document.getElementById('cg_res_A_card').classList.add('track-recommended');
        document.getElementById('cg_res_A_badge').innerHTML =
          '<span class="badge badge-recommended">Fully Exempt ✓</span>';
        document.getElementById('cg_res_verdict').textContent =
          'Track A gives full exemption — ₪0 total tax.'
          + ' Consider Track B if you plan to sell a higher-value property within the next 4 years, '
          + 'as using the exemption now forfeits it for that future sale.';
        return;
      }

      const margin = Math.abs(totalB - totalA);
      if (margin <= THRESHOLD) {
        ['cg_res_A_badge','cg_res_B_badge'].forEach(id => {
          document.getElementById(id).innerHTML =
            '<span class="badge badge-close">Too close to call</span>';
        });
        document.getElementById('cg_res_verdict').textContent =
          'Results are within ' + fmt(THRESHOLD) + ' — either track is reasonable. '
          + 'Track B also preserves your single-home exemption for a future, higher-value sale.';
      } else if (totalA < totalB) {
        document.getElementById('cg_res_A_card').classList.add('track-recommended');
        document.getElementById('cg_res_A_badge').innerHTML =
          '<span class="badge badge-recommended">Lower total ✓</span>';
        document.getElementById('cg_res_B_badge').innerHTML =
          '<span class="badge badge-close">Saves exemption</span>';
        document.getElementById('cg_res_verdict').textContent =
          'Track A saves ' + fmt(totalB - totalA)
          + ' — total ' + fmt(totalA) + ' vs ' + fmt(totalB) + ' on Track B. '
          + 'Track B preserves your once-per-4-years single-home exemption — consider which matters more.';
      } else {
        document.getElementById('cg_res_B_card').classList.add('track-recommended');
        document.getElementById('cg_res_B_badge').innerHTML =
          '<span class="badge badge-recommended">Lower total + saves exemption ✓</span>';
        document.getElementById('cg_res_verdict').textContent =
          'Track B is cheaper by ' + fmt(totalA - totalB)
          + ' — total ' + fmt(totalB) + ' vs ' + fmt(totalA) + ' on Track A — and also preserves your single-home exemption.';
      }
    }

    // ── Event wiring ─────────────────────────────────────────────
    ['cg_res_purchaseDate','cg_res_saleDate'].forEach(id =>
      attachDateMask(document.getElementById(id), function () {
        updateOwnedFlag(); runCGResCalc();
      })
    );
    ['cg_res_salePrice','cg_res_purchasePrice','cg_res_acqExpenses',
     'cg_res_saleExpenses','cg_res_improvements','cg_res_depreciation'].forEach(id =>
      document.getElementById(id).addEventListener('input', runCGResCalc)
    );
    ['cg_res_onlyApt','cg_res_foreignCert'].forEach(id =>
      document.getElementById(id).addEventListener('change', runCGResCalc)
    );

    updateOwnedFlag();
    runCGResCalc();
  }

  // ── Individual + Real Estate + Capital Gain (Commercial) ─────────
  function initIndCGCom() {
    const CUTOFF_2001      = new Date(2001, 10, 7);   // 7 Nov 2001 — local midnight, matches parseDMY
    const CUTOFF_2012      = new Date(2012, 0, 1);    // 1 Jan 2012 — local midnight
    const PRE_RATE         = 0.47;   // marginal rate — worst-case when no purchase date
    const MID_RATE         = 0.20;   // 7 Nov 2001 – 31 Dec 2011
    const POST_RATE        = 0.25;   // 1 Jan 2012 onward

    document.getElementById('cg_com_saleDate').value = formatDMY(new Date());


    const ALL_OUTPUT_IDS = [
      'cg_com_pre2001Gain','cg_com_pre2001Tax',
      'cg_com_midGain',    'cg_com_midTax',
      'cg_com_postGain',   'cg_com_postTax',
      'cg_com_totalTax',   'cg_com_effective',
      'cg_com_grandTotal',
      'cg_com_gainDisplay',
    ];

    function resetComCards() {
      blank(ALL_OUTPUT_IDS);
      document.getElementById('cg_com_verdict').textContent       = '';
      document.getElementById('cg_com_noDateWarn').style.display    = 'none';
      document.getElementById('cg_com_badDateWarn').style.display   = 'none';
      document.getElementById('cg_com_dateOrderWarn').style.display = 'none';
      document.getElementById('cg_com_noSaleWarn').style.display    = 'none';
    }

    function runCGComCalc() {
      const salePrice    = pn('cg_com_salePrice');
      const purchPrice   = pn('cg_com_purchasePrice');
      const acqExp       = pn('cg_com_acqExpenses');
      const saleExp      = pn('cg_com_saleExpenses');
      const improvements = pn('cg_com_improvements');
      const depreciation = pn('cg_com_depreciation');
      const pDate        = dateFieldState('cg_com_purchaseDate');
      const sDate        = dateFieldState('cg_com_saleDate');
      const purchaseDate = pDate.date;
      const saleDate_    = sDate.date;

      if (!salePrice) { resetComCards(); return; }

      // Clear the date warnings up front; each branch below re-shows the one
      // that applies. Otherwise a warning from a transiently-invalid keystroke
      // survives into the valid-computation path and never clears.
      document.getElementById('cg_com_badDateWarn').style.display   = 'none';
      document.getElementById('cg_com_noDateWarn').style.display    = 'none';
      document.getElementById('cg_com_dateOrderWarn').style.display = 'none';
      document.getElementById('cg_com_noSaleWarn').style.display    = 'none';

      // Typed-but-invalid dates block calculation instead of silently misparsing
      if (pDate.state === 'invalid' || sDate.state === 'invalid') {
        resetComCards();
        document.getElementById('cg_com_badDateWarn').style.display = '';
        return;
      }

      // Reversed or same-day dates block computation (linearSplit would return []
      // and every bucket would render ₪0). A computed treatment for a same-day
      // disposal would be a tax-math decision requiring tax-AI sign-off — this
      // deliberately blocks instead.
      if (purchaseDate && saleDate_ && saleDate_ <= purchaseDate) {
        resetComCards();
        document.getElementById('cg_com_dateOrderWarn').style.display = '';
        return;
      }

      // The sale date prefills to today, so it is only empty if the user
      // actively cleared it — prompt for it instead of computing silently.
      const noPurchase = !purchaseDate;
      const noSale     = !saleDate_;
      if (noSale) {
        resetComCards();
        document.getElementById('cg_com_noSaleWarn').style.display = '';
        return;
      }
      document.getElementById('cg_com_noDateWarn').style.display = noPurchase ? '' : 'none';

      const basis = adjustedBasis(purchPrice, depreciation, improvements);
      const gain  = nominalGain(salePrice, saleExp, acqExp, basis);

      if (gain <= 0) {
        resetComCards();
        document.getElementById('cg_com_noDateWarn').style.display = noPurchase ? '' : 'none';
        document.getElementById('cg_com_gainDisplay').textContent  = fmt(0) + ' (no taxable gain)';
        ['cg_com_totalTax','cg_com_grandTotal',
         'cg_com_pre2001Gain','cg_com_midGain','cg_com_postGain'].forEach(id => {
          document.getElementById(id).textContent = fmt(0);
        });
        ['cg_com_pre2001Tax','cg_com_midTax','cg_com_postTax'].forEach(id => {
          document.getElementById(id).textContent = '—';
        });
        document.getElementById('cg_com_effective').textContent = '0.0%';
        document.getElementById('cg_com_verdict').textContent   = 'No taxable gain — no capital gains tax owed.';
        return;
      }

      document.getElementById('cg_com_gainDisplay').textContent =
        fmt(gain) + ' (nominal — inflation indexing not applied)';

      // §48A linear split — or worst-case (full gain at PRE_RATE) if no purchase date
      let pre2001 = 0, mid = 0, post = 0;

      if (purchaseDate && saleDate_) {
        const periods = linearSplit(gain, purchaseDate, saleDate_, [CUTOFF_2001, CUTOFF_2012]);
        for (const p of periods) {
          if (p.from < CUTOFF_2001)      pre2001 += p.gain;
          else if (p.from < CUTOFF_2012) mid     += p.gain;
          else                           post    += p.gain;
        }
      } else {
        pre2001 = gain;   // worst case: unknown date → 47% on everything
      }

      // Belt-and-braces with the chronology/no-sale guards above: linearSplit only
      // returns [] for a non-positive date range, which is blocked before this
      // point — but never render a ₪0 split or a garbled "Split: ." verdict if
      // that invariant is ever broken.
      if (pre2001 + mid + post <= 0) {
        resetComCards();
        return;
      }

      const taxPre  = pre2001 * PRE_RATE;
      const taxMid  = mid     * MID_RATE;
      const taxPost = post    * POST_RATE;
      const total   = taxPre + taxMid + taxPost;

      const grandTotal = total;

      document.getElementById('cg_com_pre2001Gain').textContent = fmt(pre2001);
      document.getElementById('cg_com_pre2001Tax').textContent  = pre2001 > 0 ? fmt(taxPre)  : '—';
      document.getElementById('cg_com_midGain').textContent     = fmt(mid);
      document.getElementById('cg_com_midTax').textContent      = mid     > 0 ? fmt(taxMid)  : '—';
      document.getElementById('cg_com_postGain').textContent    = fmt(post);
      document.getElementById('cg_com_postTax').textContent     = post    > 0 ? fmt(taxPost) : '—';
      document.getElementById('cg_com_totalTax').textContent    = fmt(total);
      document.getElementById('cg_com_effective').textContent   = ((total / gain) * 100).toFixed(1) + '%';
      document.getElementById('cg_com_grandTotal').textContent  = fmt(grandTotal);

      // Plain-English summary
      const parts = [];
      if (pre2001 > 0) parts.push(noPurchase ? 'full gain at 47% (worst case — no purchase date)' : 'pre-2001 at 47%');
      if (mid     > 0) parts.push('2001–2011 at 20%');
      if (post    > 0) parts.push('post-2012 at 25%');
      document.getElementById('cg_com_verdict').textContent =
        'Split: ' + parts.join(', ') + '. '
        + 'Base tax ' + fmt(total) + ' (' + ((total / gain) * 100).toFixed(1) + '% of gain).';
    }

    ['cg_com_salePrice','cg_com_purchasePrice','cg_com_acqExpenses',
     'cg_com_saleExpenses','cg_com_improvements','cg_com_depreciation'].forEach(id =>
      document.getElementById(id).addEventListener('input', runCGComCalc)
    );
    ['cg_com_purchaseDate','cg_com_saleDate'].forEach(id =>
      attachDateMask(document.getElementById(id), runCGComCalc)
    );

    runCGComCalc();
  }

  // ── Individual · Shares (Dividends) ──────────────────────────────
  function initIndShares() {

    const OUTPUT_IDS = [
      'shares_dividendDisplay', 'shares_taxDisplay', 'shares_effective',
      'shares_grossTax', 'shares_ftcDisplay', 'shares_netTaxDisplay', 'shares_totalTaxDisplay',
    ];

    function resetSharesCards() {
      blank(OUTPUT_IDS);
      document.getElementById('shares_ftcBreakdown').style.display = 'none';
      document.getElementById('shares_note').style.display = 'none';
      const verdict = document.getElementById('shares_verdict');
      verdict.style.display = '';
      verdict.textContent = 'Enter a dividend amount above to see estimates.';
    }

    // 2026 figures. Surtax (mas yesef) is not computed here — disclosed in the
    // disclaimer only, matching the other sections.
    function runSharesCalc() {
      const dividend              = pn('shares_dividend');
      const residency             = document.getElementById('shares_residency').value;
      const substantial           = document.getElementById('shares_substantial').checked;
      const source                = document.getElementById('shares_source').value;
      const oleh                  = document.getElementById('shares_oleh').checked;

      // Progressive disclosure: the foreign-withholding input only matters on the
      // FTC branch (Israeli resident, foreign-company dividend, not Oleh-exempt).
      // Hide and clear it everywhere else so an irrelevant field never shows.
      const fwRelevant = residency === 'israeli' && source === 'foreign' && !oleh;
      document.getElementById('shares_fwField').style.display = fwRelevant ? '' : 'none';
      if (!fwRelevant) document.getElementById('shares_foreignWithheld').value = '';

      const foreignTaxWithheldPct = Math.min(100, Math.max(0, pn('shares_foreignWithheld')));   // clamp to 0–100%

      if (dividend <= 0) { resetSharesCards(); return; }

      const rate            = substantial ? 0.30 : 0.25;   // 30% substantial shareholder, else 25%
      const foreignWithheld = (foreignTaxWithheldPct / 100) * dividend;

      let israeliTax  = 0;   // Israeli tax owed (net of any foreign credit)
      let grossTax    = 0;   // Israeli tax before the foreign credit
      let totalBurden = 0;   // foreign + Israeli combined
      let ftcActive   = false;
      let context     = '';  // branch-specific explanation shown in #shares_note

      if (residency === 'foreign') {
        if (source === 'israeli') {
          israeliTax  = rate * dividend;
          totalBurden = israeliTax;
          context = "As a foreign resident, Israel withholds at the statutory rate. Your country's tax treaty may substantially reduce this.";
        } else {
          israeliTax  = 0;
          totalBurden = 0;
          context = 'Foreign-source dividends paid to a foreign resident are not taxed by Israel.';
        }
      } else {   // Israeli resident
        if (source === 'israeli') {
          israeliTax  = rate * dividend;
          totalBurden = israeliTax;
          context = oleh
            ? 'The 10-year exemption does not apply to Israeli-source dividends — the standard rate applies from day one.'
            : '';
        } else if (oleh) {
          israeliTax  = 0;
          totalBurden = 0;
          context = 'Within the 10-year new-immigrant exemption, foreign-source dividends are fully exempt from Israeli tax. Tax withheld abroad is not refundable.';
        } else {
          ftcActive   = true;
          grossTax    = rate * dividend;
          israeliTax  = Math.max(0, grossTax - foreignWithheld);
          totalBurden = foreignWithheld + israeliTax;   // = max(grossTax, foreignWithheld)
          context = 'Israel credits the foreign tax already withheld, so you effectively pay the higher of the two rates.';
        }
      }

      const effective = totalBurden / dividend;

      document.getElementById('shares_dividendDisplay').textContent = fmt(dividend);
      document.getElementById('shares_taxDisplay').textContent      = fmt(israeliTax);
      document.getElementById('shares_effective').textContent       = (effective * 100).toFixed(1) + '%';

      const breakdown = document.getElementById('shares_ftcBreakdown');
      if (ftcActive) {
        breakdown.style.display = 'flex';
        document.getElementById('shares_grossTax').textContent        = fmt(grossTax);
        document.getElementById('shares_ftcDisplay').textContent      = fmt(foreignWithheld);
        document.getElementById('shares_netTaxDisplay').textContent   = fmt(israeliTax);
        document.getElementById('shares_totalTaxDisplay').textContent = fmt(totalBurden);
      } else {
        breakdown.style.display = 'none';
        ['shares_grossTax', 'shares_ftcDisplay', 'shares_netTaxDisplay', 'shares_totalTaxDisplay']
          .forEach(id => { document.getElementById(id).textContent = '—'; });
      }

      // Active-branch explanation note; hide the empty-state placeholder verdict.
      document.getElementById('shares_verdict').style.display = 'none';
      const noteEl = document.getElementById('shares_note');
      if (context) {
        noteEl.textContent = context;
        noteEl.style.display = '';
      } else {
        noteEl.textContent = '';
        noteEl.style.display = 'none';
      }
    }

    ['shares_dividend', 'shares_foreignWithheld'].forEach(id =>
      document.getElementById(id).addEventListener('input', runSharesCalc)
    );
    ['shares_residency', 'shares_source'].forEach(id =>
      document.getElementById(id).addEventListener('change', runSharesCalc)
    );
    ['shares_substantial', 'shares_oleh'].forEach(id =>
      document.getElementById(id).addEventListener('change', runSharesCalc)
    );

    runSharesCalc();
  }

  // ── Individual · Interest ────────────────────────────────────────
  // Pure DOM/UI layer over interestIndividual(); all rates come from the engine.
  function initIndInterest() {
    const $ = (id) => document.getElementById(id);

    // Branch → plain-English note (no statute numbers); '' means no note shown.
    const NOTE = {
      foreign_resident_israeli_source: "As a foreign resident, Israel withholds at the statutory rate. A treaty may reduce this, but the reduction isn't automatic — you must apply to the tax authority for a reduced-rate certificate; the full rate is withheld until one issues.",
      exempt_traded_bond_15D: "Interest on Israeli traded and government bonds is generally exempt for foreign residents — provided the holding isn't through a business you operate in Israel.",
      exempt_fx_deposit: "Interest on a foreign-currency deposit in an Israeli bank is generally exempt for foreign residents who meet the bank-declaration and no-Israeli-partner conditions.",
      foreign_resident_foreign_source: "Foreign-source interest paid to a foreign resident isn't taxed by Israel.",
      pe_business_profits: "Because this interest is connected to a business you operate in Israel, it's taxed as Israeli business profits rather than at the withholding rate — that calculation isn't covered here.",
      israeli_resident_unlinked_15: "",
      israeli_resident_linked_25: "",
      recharacterized_marginal: "The capped rate doesn't apply here, so the interest is taxed at your marginal rate. If you have other Israeli income this may be higher — consult an advisor.",
      oleh_foreign_source_exempt: "Within the 10-year new-immigrant exemption, foreign-source interest is fully exempt from Israeli tax. Tax withheld abroad isn't refundable.",
      israeli_resident_foreign_source: "Israel taxes this foreign-source interest and credits the foreign tax already withheld, so you effectively pay the higher of the two rates.",
      israeli_resident_foreign_source_recharacterized: "Israel taxes this foreign-source interest and credits the foreign tax already withheld, so you effectively pay the higher of the two rates.",
    };

    const OUTPUT_IDS = [
      'intr_baseDisplay', 'intr_rate', 'intr_taxDisplay', 'intr_effectiveDisplay',
      'intr_treatyDisplay', 'intr_treatyEffective',
      'intr_grossTax', 'intr_foreignTax', 'intr_netTax', 'intr_totalBurden',
    ];

    function resetCard() {
      blank(OUTPUT_IDS);
      $('intr_treatyRow').style.display = 'none';
      $('intr_ftcRow').style.display    = 'none';
      $('intr_note').style.display      = 'none';
      const v = $('intr_verdict');
      v.style.display = '';
      v.textContent   = 'Enter an interest amount above to see estimates.';
    }

    function showNote(branch) {
      const note = $('intr_note');
      const text = NOTE[branch] || '';
      note.textContent   = text;
      note.style.display = text ? '' : 'none';
    }

    // Hide a field/checkbox group and clear its inputs so stale values can't feed
    // the calc (important e.g. for the PE flag when switching to an Israeli resident).
    function setGroup(id, visible) {
      const el = $(id);
      el.style.display = visible ? '' : 'none';
      if (!visible) {
        el.querySelectorAll('input').forEach(i => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
        el.querySelectorAll('select').forEach(s => { s.selectedIndex = 0; });
      }
    }

    // Show only the inputs relevant to the current residency/source (+ instrument/oleh).
    function syncVisibility() {
      const foreign    = $('intr_residency').value === 'foreign';
      const ilSource   = $('intr_source').value === 'israeli';
      const instrument = $('intr_instrument').value;

      setGroup('intr_instrumentField',      foreign && ilSource);
      setGroup('intr_treatyField',          foreign && ilSource && instrument === 'other');
      setGroup('intr_peField',              foreign);
      setGroup('intr_ilSourceExtras',      !foreign && ilSource);
      setGroup('intr_forSourceExtras',     !foreign && !ilSource);
      // Read oleh AFTER forSourceExtras may have cleared it, so it's never stale.
      setGroup('intr_foreignWithheldField', !foreign && !ilSource && !$('intr_oleh').checked);
    }

    function runCalc() {
      const amount = pn('intr_amount');
      if (amount <= 0) { resetCard(); return; }

      const foreignSource = $('intr_source').value === 'foreign';
      const treatyRaw     = $('intr_treatyPct').value.trim();

      const r = interestIndividual({
        amount,
        residency: $('intr_residency').value,
        source: $('intr_source').value,
        instrument: $('intr_instrument').value || 'other',
        linked: $('intr_linked').checked,
        recharacterize: (foreignSource ? $('intr_recharFOR') : $('intr_recharIL')).checked,
        oleh: $('intr_oleh').checked,
        over60: $('intr_over60').checked,
        otherAnnualIncome: pn('intr_otherIncome'),   // field is annual NIS — no monthly→annual conversion
        treatyRatePct: treatyRaw !== '' ? pn('intr_treatyPct') : null,
        foreignWithheldPct: pn('intr_foreignWithheld'),
        connectedToIsraeliPE: $('intr_pe').checked,
      });

      // Conditional rows hidden unless this branch needs them.
      $('intr_treatyRow').style.display = 'none';
      $('intr_ftcRow').style.display    = 'none';
      $('intr_verdict').style.display   = 'none';
      $('intr_baseDisplay').textContent = fmt(r.amount);

      // PE-connected: re-sourced to Israeli business profits — not estimated here.
      if (!r.modeled && r.branch === 'pe_business_profits') {
        $('intr_rate').textContent            = '—';
        $('intr_taxDisplay').textContent      = '—';
        $('intr_effectiveDisplay').textContent = '—';
        showNote(r.branch);
        return;
      }

      // Headline tax: when a treaty applies, the full statutory rate is the headline
      // (withheld by default) and the reduced figure goes in the treaty row; in every
      // other case the headline is the Israeli tax the engine returns.
      const headlineTax = (r.treatyTax != null) ? r.statutoryTax : r.israeliTax;
      $('intr_rate').textContent             = r.exempt ? 'Exempt' : effPct(headlineTax, r.amount);
      $('intr_taxDisplay').textContent       = fmt(headlineTax);
      $('intr_effectiveDisplay').textContent = effPct(headlineTax, r.amount);

      if (r.treatyTax != null) {
        $('intr_treatyRow').style.display       = '';
        $('intr_treatyDisplay').textContent     = fmt(r.treatyTax);
        $('intr_treatyEffective').textContent   = effPct(r.treatyTax, r.amount);
      }

      if (r.ftcActive) {
        $('intr_ftcRow').style.display      = '';
        $('intr_grossTax').textContent      = fmt(r.statutoryTax);
        $('intr_foreignTax').textContent    = fmt(r.foreignWithheld);
        $('intr_netTax').textContent        = fmt(r.israeliTax);
        $('intr_totalBurden').textContent   = fmt(r.foreignWithheld + r.israeliTax);
      }

      showNote(r.branch);
    }

    // Visibility-affecting controls re-sync then recalc; the rest just recalc.
    ['intr_residency', 'intr_source', 'intr_instrument', 'intr_oleh'].forEach(id =>
      $(id).addEventListener('change', function () { syncVisibility(); runCalc(); }));
    ['intr_amount', 'intr_treatyPct', 'intr_foreignWithheld', 'intr_otherIncome'].forEach(id =>
      $(id).addEventListener('input', runCalc));
    ['intr_linked', 'intr_recharIL', 'intr_recharFOR', 'intr_pe', 'intr_over60'].forEach(id =>
      $(id).addEventListener('change', runCalc));

    syncVisibility();
    runCalc();
  }

  // ── Individual · Crypto / Digital Assets ─────────────────────────
  // Pure DOM/UI layer over cryptoIndividual(); all rates come from the engine.
  // Crypto is capital property: nominal gain (proceeds − basis) taxed at the
  // capital-gains rate, with the oleh foreign-source exemption and an FTC for an
  // Israeli resident's foreign tax.
  function initIndCrypto() {
    const $ = (id) => document.getElementById(id);

    // Branch → plain-English note (no statute numbers); '' means no note shown.
    const NOTE = {
      foreign_resident_crypto: "As a foreign resident, Israel taxes the gain on a digital-asset disposal at the standard capital-gains rate. Your country's tax treaty may affect this — consult an advisor.",
      israeli_resident_crypto: "Israel taxes the gain and credits the foreign tax already paid, so you effectively pay the higher of the two rates.",
      oleh_foreign_source_exempt: "Within the 10-year new-immigrant exemption, gains on foreign-source digital assets are exempt from Israeli tax. Tax paid abroad isn't refundable.",
      oleh_israeli_source_crypto: "The 10-year exemption doesn't cover Israeli-source gains — the standard rate applies from day one.",
    };

    const OUTPUT_IDS = [
      'cryp_baseDisplay', 'cryp_proceedsDisplay', 'cryp_costDisplay', 'cryp_gainDisplay',
      'cryp_rate', 'cryp_taxDisplay', 'cryp_effectiveDisplay',
      'cryp_grossTax', 'cryp_foreignTax', 'cryp_netTax', 'cryp_totalBurden',
    ];

    function resetCard() {
      blank(OUTPUT_IDS);
      $('cryp_ftcRow').style.display = 'none';
      $('cryp_note').style.display   = 'none';
      const v = $('cryp_verdict');
      v.style.display = '';
      v.textContent   = 'Enter your proceeds and cost basis above to see estimates.';
    }

    function showNote(branch) {
      const note = $('cryp_note');
      const text = NOTE[branch] || '';
      note.textContent   = text;
      note.style.display = text ? '' : 'none';
    }

    // Hide a field group and clear its inputs so a stale value can't feed the calc
    // (e.g. the foreign-tax field when switching away from an Israeli resident).
    function setGroup(id, visible) {
      const el = $(id);
      el.style.display = visible ? '' : 'none';
      if (!visible) {
        el.querySelectorAll('input').forEach(i => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
        el.querySelectorAll('select').forEach(s => { s.selectedIndex = 0; });
      }
    }

    // Oleh-source select shows only for an oleh; the foreign-tax-credit field only
    // for an Israeli resident.
    function syncVisibility() {
      const residency = $('cryp_residency').value;
      setGroup('cryp_olehSourceField',      residency === 'oleh');
      setGroup('cryp_foreignWithheldField', residency === 'israeli');
    }

    function runCalc() {
      const proceeds  = pn('cryp_proceeds');
      const costBasis = pn('cryp_costBasis');
      if (proceeds <= 0) { resetCard(); return; }

      const residency = $('cryp_residency').value;
      const r = cryptoIndividual({
        amount: proceeds,
        costBasis,
        residency,
        source: residency === 'oleh' ? $('cryp_olehSource').value : 'foreign',
        foreignWithheld: pn('cryp_foreignWithheld'),
      });

      $('cryp_ftcRow').style.display  = 'none';
      $('cryp_verdict').style.display = 'none';

      $('cryp_baseDisplay').textContent     = fmt(r.amount);
      $('cryp_proceedsDisplay').textContent = fmt(r.amount);
      $('cryp_costDisplay').textContent     = fmt(r.costBasis);
      $('cryp_gainDisplay').textContent     = fmt(r.gain);

      // No taxable gain (underwater or break-even) → no tax owed, explain why.
      if (r.gain <= 0) {
        $('cryp_rate').textContent             = '—';
        $('cryp_taxDisplay').textContent       = fmt(0);
        $('cryp_effectiveDisplay').textContent = '0.0%';
        const note = $('cryp_note');
        note.textContent   = 'No taxable gain — no capital-gains tax owed on this disposal.';
        note.style.display = '';
        return;
      }

      // Tax Rate = the Israeli statutory CG rate; Tax Owed = net Israeli tax after
      // any foreign credit; Effective Rate = total burden (foreign + Israeli) / gain.
      $('cryp_rate').textContent             = r.exempt ? 'Exempt' : effPct(r.statutoryTax, r.gain);
      $('cryp_taxDisplay').textContent       = fmt(r.israeliTax);
      $('cryp_effectiveDisplay').textContent = (r.effective * 100).toFixed(1) + '%';

      if (r.ftcActive) {
        $('cryp_ftcRow').style.display    = '';
        $('cryp_grossTax').textContent    = fmt(r.statutoryTax);
        $('cryp_foreignTax').textContent  = fmt(r.foreignWithheld);
        $('cryp_netTax').textContent      = fmt(r.israeliTax);
        $('cryp_totalBurden').textContent = fmt(r.foreignWithheld + r.israeliTax);
      }

      showNote(r.branch);
    }

    // Visibility-affecting controls re-sync then recalc; the rest just recalc.
    $('cryp_residency').addEventListener('change', function () { syncVisibility(); runCalc(); });
    $('cryp_olehSource').addEventListener('change', runCalc);
    ['cryp_proceeds', 'cryp_costBasis', 'cryp_foreignWithheld'].forEach(id =>
      $(id).addEventListener('input', runCalc));

    syncVisibility();
    runCalc();
  }

  // ── Individual · Share Capital Gain ──────────────────────────────
  // Pure DOM/UI layer over sharesIndividualCG(); all rates come from the engine.
  // Shares are capital property: nominal gain (proceeds − INDEXED cost basis) taxed
  // at the capital-gains rate (25%, or 30% for a 10%+ holder). The user supplies an
  // already-CPI-indexed cost basis — no inflation indexing happens in the engine.
  // Foreign residents are exempt on ordinary Israeli shares (taxable on real-estate-
  // association shares); an oleh's foreign-source gain is exempt; an Israeli resident
  // is taxed on any source with an FTC for foreign tax on a foreign-source gain.
  function initIndSharesCG() {
    const $ = (id) => document.getElementById(id);

    // Branch → plain-English note (no statute numbers); the Israeli-resident branch
    // gets an extra FTC sentence appended in showNote when a credit is in play.
    const NOTE = {
      foreign_resident_foreign_source: "A foreign resident selling foreign-company shares is outside Israeli tax.",
      foreign_resident_israeli_shares_exempt: "A foreign resident is generally exempt from Israeli tax on Israeli shares, and most treaties give the taxing right to your country of residence. Confirm your treaty position with an advisor.",
      foreign_resident_israeli_real_estate_assoc: "Because the company's value comes mainly from Israeli real estate, the foreign-resident exemption does not apply and the gain is taxable in Israel.",
      oleh_foreign_source_exempt: "Foreign-company shares fall under the new-immigrant exemption for the qualifying window.",
      oleh_israeli_source: "The new-immigrant exemption does not cover Israeli-company shares — the gain is taxable from day one of residency.",
      israeli_resident_shares: "The real gain is taxed at the capital-gains rate.",
    };

    const OUTPUT_IDS = [
      'shcg_baseDisplay', 'shcg_proceedsDisplay', 'shcg_costDisplay', 'shcg_gainDisplay',
      'shcg_rate', 'shcg_taxDisplay', 'shcg_effectiveDisplay',
      'shcg_statutoryOut', 'shcg_foreignOut', 'shcg_netOut', 'shcg_totalBurdenOut',
    ];

    function resetCard() {
      blank(OUTPUT_IDS);
      $('shcg_ftcRow').style.display = 'none';
      $('shcg_note').style.display = 'none';
      const v = $('shcg_verdict');
      v.style.display = '';
      v.textContent   = 'Enter your sale proceeds above to see estimates.';
    }

    function showNote(r) {
      let text = NOTE[r.branch] || '';
      if (r.branch === 'israeli_resident_shares' && r.ftcActive) {
        text += ' A credit is applied for the foreign tax you paid, capped at the Israeli tax on the same gain.';
      }
      const note = $('shcg_note');
      note.textContent   = text;
      note.style.display = text ? '' : 'none';
    }

    // Hide a field group and clear its inputs so a stale value can't feed the calc
    // (e.g. the foreign-tax field when switching away from an Israeli-resident /
    // foreign-source combination, or the real-estate-association flag).
    function setGroup(id, visible) {
      const el = $(id);
      el.style.display = visible ? '' : 'none';
      if (!visible) {
        el.querySelectorAll('input').forEach(i => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
        el.querySelectorAll('select').forEach(s => { s.selectedIndex = 0; });
      }
    }

    // Real-estate-association flag shows only for a foreign resident selling Israeli
    // shares; the foreign-tax-credit field only for an Israeli resident with a
    // foreign-source gain.
    function syncVisibility() {
      const residency = $('shcg_residency').value;
      const source    = $('shcg_source').value;
      setGroup('shcg_realEstateAssocField', residency === 'foreign' && source === 'israeli');
      setGroup('shcg_foreignWithheldField', residency === 'israeli' && source === 'foreign');
    }

    function runCalc() {
      const proceeds = pn('shcg_proceeds');
      if (proceeds <= 0) { resetCard(); return; }

      const r = sharesIndividualCG({
        proceeds,
        costBasis: pn('shcg_costBasis'),
        residency: $('shcg_residency').value,
        source: $('shcg_source').value,
        substantialHolder: $('shcg_substantial').checked,
        foreignWithheld: pn('shcg_foreignWithheld'),
        realEstateAssoc: $('shcg_realEstateAssoc').checked,
      });

      $('shcg_verdict').style.display = 'none';
      $('shcg_ftcRow').style.display  = 'none';
      $('shcg_baseDisplay').textContent     = fmt(r.proceeds);
      $('shcg_proceedsDisplay').textContent = fmt(r.proceeds);
      $('shcg_costDisplay').textContent     = fmt(r.costBasis);
      $('shcg_gainDisplay').textContent     = fmt(r.gain);

      // No taxable gain (proceeds ≤ indexed basis) → no tax owed, explain why.
      if (r.gain <= 0) {
        $('shcg_rate').textContent           = '—';
        $('shcg_taxDisplay').textContent     = fmt(0);
        $('shcg_effectiveDisplay').textContent = '0.0%';
        const note = $('shcg_note');
        note.textContent   = 'No taxable gain — the proceeds do not exceed your indexed cost basis, so no capital-gains tax is owed.';
        note.style.display = '';
        return;
      }

      // Tax Rate (prominent): the statutory rate on taxable branches, "Exempt"
      // otherwise. Tax Owed is the net Israeli tax; Effective Rate is the engine's
      // net-tax-over-proceeds figure.
      $('shcg_rate').textContent             = r.exempt ? 'Exempt' : (r.rate * 100).toFixed(0) + '%';
      $('shcg_taxDisplay').textContent       = fmt(r.israeliTax);
      $('shcg_effectiveDisplay').textContent = (r.effective * 100).toFixed(1) + '%';

      // FTC breakdown (Israeli resident with foreign tax paid): surface the gross
      // Israeli tax, the credited foreign tax, the net owed, and the total burden.
      // The headline rate and effective rate are unchanged (net-Israeli per engine).
      if (r.ftcActive) {
        $('shcg_ftcRow').style.display         = '';
        $('shcg_statutoryOut').textContent     = fmt(r.statutoryTax);
        $('shcg_foreignOut').textContent       = fmt(r.foreignWithheld);
        $('shcg_netOut').textContent           = fmt(r.israeliTax);
        $('shcg_totalBurdenOut').textContent   = fmt(r.foreignWithheld + r.israeliTax);
      }

      showNote(r);
    }

    // Visibility-affecting controls re-sync then recalc; the rest just recalc.
    ['shcg_residency', 'shcg_source'].forEach(id =>
      $(id).addEventListener('change', function () { syncVisibility(); runCalc(); }));
    ['shcg_proceeds', 'shcg_costBasis', 'shcg_foreignWithheld'].forEach(id =>
      $(id).addEventListener('input', runCalc));
    ['shcg_substantial', 'shcg_realEstateAssoc'].forEach(id =>
      $(id).addEventListener('change', runCalc));

    syncVisibility();
    runCalc();
  }

  // ── Individual · Employee Stock Options / RSUs (Sec. 102) ────────
  // Pure DOM/UI layer over section102(); all rates come from the engine. The
  // capital-gains track splits the gain when the company was listed at grant;
  // every other track (and an early-sale violation, or a 10%+ holder) taxes the
  // whole gain as employment income on the marginal ladder. Trustee holding is
  // computed from the grant/sale dates (24mo cg / 12mo income); over60 is a no-op
  // for this section (employment income uses the full ladder at any age).
  function initStockOptions() {
    const $ = (id) => document.getElementById(id);

    // Branch → plain-English note (no individual-clause citations). The BL/health
    // line is folded into every employment-income branch's text; cg_private is the
    // only employment-free branch and intentionally omits it.
    const NOTE = {
      cg_private: "Held past the required period in a private company — the whole gain is taxed at the capital-gains rate.",
      cg_listed_split: "Because the company was listed at grant, the portion up to the pre-grant average is taxed as employment income and only the appreciation above it gets the capital-gains rate.",
      cg_violation_early_sale: "Sold before the required holding period — the whole gain is reclassified as employment income at marginal rates. National Insurance and health tax also apply.",
      income_track: "On the income track the whole gain is taxed as employment income at marginal rates. National Insurance and health tax also apply.",
      income_violation_early_sale: "Sold before the required holding period — the whole gain is employment income at marginal rates. National Insurance and health tax also apply.",
      nontrustee: "On a non-trustee arrangement the whole gain is employment income at marginal rates. National Insurance and health tax also apply.",
      '3i': "Outside the 102 tracks, the whole gain is employment income at marginal rates. National Insurance and health tax also apply.",
      '3i_controlling_holder': "A 10%-or-greater holder can't use the 102 tracks, so the whole gain is taxed as employment income at marginal rates. National Insurance and health tax also apply.",
    };

    const OUTPUT_IDS = [
      'so_baseDisplay', 'so_gainDisplay', 'so_rate',
      'so_capitalPortion', 'so_employmentPortion',
      'so_capitalTax', 'so_employmentTax', 'so_totalTax', 'so_effectiveDisplay',
    ];

    // Default the sale date to today, like the CG sections.
    $('so_saleDate').value = formatDMY(new Date());

    function resetCard() {
      blank(OUTPUT_IDS);
      $('so_capPortionRow').style.display = 'none';
      $('so_empPortionRow').style.display = 'none';
      $('so_empTaxRow').style.display     = 'none';
      $('so_note').style.display          = 'none';
      const v = $('so_verdict');
      v.style.display = '';
      v.textContent   = 'Enter your sale proceeds above to see estimates.';
    }

    function showNote(branch) {
      const note = $('so_note');
      const text = NOTE[branch] || '';
      note.textContent   = text;
      note.style.display = text ? '' : 'none';
    }

    // Hide a field/checkbox group and clear its inputs so stale values can't feed
    // the calc (e.g. the avg-30 base when switching off the capital-gains track).
    function setGroup(id, visible) {
      const el = $(id);
      el.style.display = visible ? '' : 'none';
      if (!visible) {
        el.querySelectorAll('input').forEach(i => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
      }
    }

    // Required trustee holding (months) by track; null = not applicable (non-trustee
    // / 3(i)). Returns the month count and any date problem so both the flag display
    // and the calc agree on a single source of truth.
    function holdingInfo() {
      const track    = $('so_track').value;
      const required = track === 'cg' ? 24 : track === 'income' ? 12 : null;
      const g = dateFieldState('so_grantDate');
      const s = dateFieldState('so_saleDate');
      let months = null, dateProblem = null;
      if (g.state === 'invalid' || s.state === 'invalid') dateProblem = 'invalid';
      else if (!g.date || !s.date)                        dateProblem = 'empty';
      // Sale strictly before grant is impossible; a same-day grant/sale stays
      // valid (months 0 → early sale), since selling immediately is a real scenario.
      else if (s.date < g.date)                           dateProblem = 'order';
      else months = (s.date.getFullYear() - g.date.getFullYear()) * 12 +
                    (s.date.getMonth() - g.date.getMonth());
      return { track, required, months, dateProblem };
    }

    function updateHoldingFlag() {
      const flagEl = $('so_holdingFlag');
      const info   = holdingInfo();
      if (info.required == null) {                 // non-trustee / 3(i)
        flagEl.className = 'cg-flag cg-flag-na';
        flagEl.textContent = 'Not applicable';
      } else if (info.dateProblem === 'invalid') {
        flagEl.className = 'cg-flag cg-flag-na';
        flagEl.textContent = 'Use DD/MM/YYYY format';
      } else if (info.dateProblem === 'empty') {
        flagEl.className = 'cg-flag cg-flag-na';
        flagEl.textContent = 'Enter dates above';
      } else if (info.dateProblem === 'order') {
        flagEl.className = 'cg-flag cg-flag-na';
        flagEl.textContent = 'Sale date is before the grant date';
      } else if (info.months >= info.required) {
        flagEl.className = 'cg-flag cg-flag-yes';
        flagEl.textContent = '✓ Holding period met (' + info.months + ' months)';
      } else {
        flagEl.className = 'cg-flag cg-flag-no';
        flagEl.textContent = '✗ Not met (' + info.months + ' months — early sale)';
      }
    }

    // listed-at-grant shows only on the cg track; the 30-day average only once
    // listed is checked. The holding flag re-reads the (possibly new) track.
    function syncVisibility() {
      const isCg = $('so_track').value === 'cg';
      setGroup('so_listedField', isCg);
      setGroup('so_avg30Field',  isCg && $('so_listedAtGrant').checked);
      updateHoldingFlag();
    }

    function runCalc() {
      const saleProceeds = pn('so_saleProceeds');
      if (saleProceeds <= 0) { resetCard(); return; }

      const exercisePrice = pn('so_exercisePrice');
      const gain          = Math.max(0, saleProceeds - exercisePrice);

      // No taxable gain (proceeds ≤ exercise) → no tax, regardless of track/dates.
      if (gain <= 0) {
        resetCard();
        $('so_verdict').style.display          = 'none';
        $('so_baseDisplay').textContent        = fmt(0);
        $('so_gainDisplay').textContent        = fmt(0);
        $('so_rate').textContent               = '—';
        $('so_capitalTax').textContent         = fmt(0);
        $('so_totalTax').textContent           = fmt(0);
        $('so_effectiveDisplay').textContent   = '0.0%';
        const note = $('so_note');
        note.textContent   = 'No taxable gain — the proceeds do not exceed the exercise price, so no tax is owed.';
        note.style.display = '';
        return;
      }

      const info = holdingInfo();
      // On the trustee tracks the branch depends on the holding period, so valid
      // grant/sale dates are required; non-trustee / 3(i) ignore dates entirely.
      let holdingMet = true;
      if (info.required != null) {
        if (info.dateProblem) {
          resetCard();
          $('so_verdict').textContent = info.dateProblem === 'invalid'
            ? 'Check the date format — dates must be DD/MM/YYYY (e.g. 15/06/2020).'
            : info.dateProblem === 'order'
              ? 'The sale date is before the grant date — check the dates above.'
              : 'Enter the grant and sale dates above to determine the holding period.';
          return;
        }
        holdingMet = info.months >= info.required;
      }

      const r = section102({
        saleProceeds,
        exercisePrice,
        track: $('so_track').value,
        listedAtGrant: $('so_listedAtGrant').checked,
        avg30Base: pn('so_avg30Base'),
        holdingMet,
        is10PctHolder: $('so_is10PctHolder').checked,
        otherAnnualIncome: pn('so_otherIncome'),
        over60: $('so_over60').checked,
      });

      // Conditional rows hidden unless this branch populates them.
      $('so_capPortionRow').style.display = 'none';
      $('so_empPortionRow').style.display = 'none';
      $('so_empTaxRow').style.display     = 'none';
      $('so_verdict').style.display       = 'none';

      $('so_baseDisplay').textContent      = fmt(r.gain);
      $('so_gainDisplay').textContent      = fmt(r.gain);
      $('so_rate').textContent             = (r.effective * 100).toFixed(1) + '%';

      if (r.capitalPortion > 0) {
        $('so_capPortionRow').style.display   = '';
        $('so_capitalPortion').textContent    = fmt(r.capitalPortion);
      }
      if (r.employmentPortion > 0) {
        $('so_empPortionRow').style.display    = '';
        $('so_employmentPortion').textContent  = fmt(r.employmentPortion);
      }
      $('so_capitalTax').textContent = fmt(r.capitalTax);
      if (r.employmentTax > 0) {
        $('so_empTaxRow').style.display     = '';
        $('so_employmentTax').textContent   = fmt(r.employmentTax);
      }
      $('so_totalTax').textContent         = fmt(r.totalTax);
      $('so_effectiveDisplay').textContent = (r.effective * 100).toFixed(1) + '%';

      // Listed-at-grant split needs the 30-day pre-grant average to find the
      // employment-income floor. A blank average reads as 0, so the engine puts
      // the WHOLE gain in the (lower) capital bucket — which would otherwise show
      // the split note's "taxed as employment income" wording next to ₪0 of it.
      // Replace the note with an actionable prompt until the average is entered.
      const avg30Blank = ($('so_avg30Base').value || '').trim() === '';
      if (r.branch === 'cg_listed_split' && avg30Blank) {
        const note = $('so_note');
        note.textContent = 'You marked the company as listed at grant but haven’t entered the 30-day pre-grant average — until you do, the entire gain is shown at the capital-gains rate. Enter the average above to split out the employment-income portion.';
        note.style.display = '';
      } else {
        showNote(r.branch);
      }
    }

    // Track + listed flag change visibility (and re-sync) then recalc; dates update
    // the holding flag then recalc; the rest just recalc.
    $('so_track').addEventListener('change', function () { syncVisibility(); runCalc(); });
    $('so_listedAtGrant').addEventListener('change', function () { syncVisibility(); runCalc(); });
    ['so_grantDate', 'so_saleDate'].forEach(id =>
      attachDateMask($(id), function () { updateHoldingFlag(); runCalc(); }));
    ['so_saleProceeds', 'so_exercisePrice', 'so_avg30Base', 'so_otherIncome'].forEach(id =>
      $(id).addEventListener('input', runCalc));
    ['so_is10PctHolder', 'so_over60'].forEach(id =>
      $(id).addEventListener('change', runCalc));

    syncVisibility();
    runCalc();
  }

  // ── Israeli Company · Real Estate · Rental Income ────────────────
  function initCoILREInc() {
    const CORP_RATE        = 0.23;
    const DIVIDEND_RATE    = 0.30;

    const saved = JSON.parse(sessionStorage.getItem('taxForm') || '{}');
    // Seed the in-section Property Type dropdown from Page 1 if it was set there;
    // otherwise it stays at its default (Residential).
    if ((saved.property || '').trim() === 'commercial') {
      document.getElementById('coil_propertyType').value = 'commercial';
    }


    syncPair('coil_rentalIncome', 'coil_rentalIncome_annual');

    const REG_OUTPUT_IDS = [
      'coil_reg_corpTax',  'coil_reg_afterTax',  'coil_reg_retainEffective',
      'coil_reg_corpTax2', 'coil_reg_divTax',
      'coil_reg_combined', 'coil_reg_combinedEffective',
    ];

    function resetRegCards() {
      blank(REG_OUTPUT_IDS);
      document.getElementById('coil_reg_netDisplay').textContent = '—';
      document.getElementById('coil_reg_verdict').textContent    = '';
      clearBadges(['coil_reg_retainBadge','coil_reg_distBadge']);
      clearTrackFlags(['coil_reg_retainCard','coil_reg_distCard']);
    }

    function runCoILRegCalc() {
      if (document.getElementById('coil_output_regular').style.display === 'none') return;

      const grossRent    = pn('coil_rentalIncome_annual');
      const expenses     = pn('coil_expenses');
      const ownershipPct = Math.min(100, Math.max(0, pnOr('coil_ownershipPct', 0)));

      if (!grossRent) { resetRegCards(); return; }

      const net      = Math.max(0, grossRent - expenses);
      const ownership = ownershipPct / 100;

      // Corporate-level (company pays on full net)
      const corpTax  = net * CORP_RATE;
      const afterTax = net * (1 - CORP_RATE);

      // Shareholder-level (proportional to ownership)
      const dividend = afterTax * ownership;
      const divTax   = dividend * DIVIDEND_RATE;

      // Combined = company tax (full) + shareholder's dividend tax
      const combined          = corpTax + divTax;
      const combinedEffective = net > 0 ? combined / net : 0;

      document.getElementById('coil_reg_netDisplay').textContent = fmt(net);

      // Card 1 — Profits Retained
      document.getElementById('coil_reg_corpTax').textContent         = fmt(corpTax);
      document.getElementById('coil_reg_afterTax').textContent        = fmt(afterTax);
      document.getElementById('coil_reg_retainEffective').textContent = (CORP_RATE * 100).toFixed(1) + '%';

      // Card 2 — Fully Distributed
      document.getElementById('coil_reg_corpTax2').textContent          = fmt(corpTax);
      document.getElementById('coil_reg_divTax').textContent            = fmt(divTax);
      document.getElementById('coil_reg_combined').textContent          = fmt(combined);
      document.getElementById('coil_reg_combinedEffective').textContent = (combinedEffective * 100).toFixed(1) + '%';

      // Verdict
      const extraCost = divTax;
      document.getElementById('coil_reg_verdict').textContent =
        'Corporate tax: ' + fmt(corpTax) + ' (23% of net). '
        + 'Full distribution adds ' + fmt(divTax) + ' dividend tax'
        + ' — total ' + fmt(combined) + ' (' + (combinedEffective * 100).toFixed(1) + '% combined).';

      // Card 1 is always lower current tax; Card 2 shows the cost of access
      ['coil_reg_retainCard','coil_reg_distCard'].forEach(id => {
        document.getElementById(id).classList.remove('track-recommended');
      });
      document.getElementById('coil_reg_retainCard').classList.add('track-recommended');
      document.getElementById('coil_reg_retainBadge').innerHTML =
        '<span class="badge badge-recommended">Lower current tax ✓</span>';
      document.getElementById('coil_reg_distBadge').innerHTML =
        '<span class="badge badge-warning">+' + fmt(extraCost) + ' to access funds</span>';
    }

    // ── Transparent path (Family §64A / House §64) — reuses computeTracks ──
    const TR_OUTPUT_IDS = [
      'coil_tr_exemptAnnual','coil_tr_exemptMonthly','coil_tr_exemptEffective',
      'coil_tr_flatAnnual','coil_tr_flatMonthly','coil_tr_flatEffective',
      'coil_tr_progAnnual','coil_tr_progMonthly','coil_tr_progEffective',
    ];

    function resetTransparentCards() {
      blank(TR_OUTPUT_IDS);
      document.getElementById('coil_tr_attrDisplay').textContent = '—';
      document.getElementById('coil_tr_verdict').textContent     = '';
      clearBadges(['coil_tr_exemptBadge','coil_tr_flatBadge','coil_tr_progBadge']);
      clearTrackFlags(['coil_tr_exemptCard','coil_tr_flatCard','coil_tr_progCard']);
    }

    function grayTransparentTrack(cardId, badgeId, valIds) {
      document.getElementById(cardId).classList.add('track-ineligible');
      valIds.forEach(id => { document.getElementById(id).textContent = 'N/A'; });
      document.getElementById(badgeId).innerHTML = '<span class="badge badge-warning">Residential only</span>';
    }

    function runCoILTransparentCalc() {
      if (document.getElementById('coil_output_transparent').style.display === 'none') return;

      const THRESHOLD = 500;

      const grossRent    = pn('coil_rentalIncome_annual');
      const expenses     = pn('coil_expenses');
      const otherIncome  = pn('coil_otherIncome');
      const over60       = document.getElementById('coil_over60').checked;
      const ownershipPct = Math.min(100, Math.max(0, pnOr('coil_ownershipPct', 100)));
      const isResidential = document.getElementById('coil_propertyType').value !== 'commercial';

      if (!grossRent) { resetTransparentCards(); return; }

      // Attribution: scale gross rent and expenses by ownership share
      const ownership    = ownershipPct / 100;
      const attrGross    = grossRent * ownership;
      const attrExpenses = expenses  * ownership;

      const { flatTax, exemptTax, fullyExempt, progTax } = computeTracks({
        grossAnnual:       attrGross,
        otherAnnualIncome: otherIncome,
        annualExpenses:    attrExpenses,
        over60,
        isResidential,
      });

      const progTotal = progTax;

      resetTransparentCards();

      document.getElementById('coil_tr_attrDisplay').textContent =
        fmt(attrGross) + ' (' + ownershipPct + '% of ' + fmt(grossRent) + ')';

      // ── Tracks A & B — residential only ──
      if (isResidential) {
        document.getElementById('coil_tr_exemptAnnual').textContent    = fullyExempt ? fmt(0) : fmt(exemptTax);
        document.getElementById('coil_tr_exemptMonthly').textContent   = fullyExempt ? fmt(0) : fmt(exemptTax / 12);
        document.getElementById('coil_tr_exemptEffective').textContent = fullyExempt ? '0.0%' : effPct(exemptTax, attrGross);

        document.getElementById('coil_tr_flatAnnual').textContent    = fmt(flatTax);
        document.getElementById('coil_tr_flatMonthly').textContent   = fmt(flatTax / 12);
        document.getElementById('coil_tr_flatEffective').textContent = effPct(flatTax, attrGross);
      } else {
        grayTransparentTrack('coil_tr_exemptCard', 'coil_tr_exemptBadge',
          ['coil_tr_exemptAnnual','coil_tr_exemptMonthly','coil_tr_exemptEffective']);
        grayTransparentTrack('coil_tr_flatCard', 'coil_tr_flatBadge',
          ['coil_tr_flatAnnual','coil_tr_flatMonthly','coil_tr_flatEffective']);
      }

      // ── Track C — always available ──
      document.getElementById('coil_tr_progAnnual').textContent    = fmt(progTotal);
      document.getElementById('coil_tr_progMonthly').textContent   = fmt(progTotal / 12);
      document.getElementById('coil_tr_progEffective').textContent = effPct(progTotal, attrGross);

      // ── Recommendation ──
      if (!isResidential) {
        document.getElementById('coil_tr_progCard').classList.add('track-recommended');
        document.getElementById('coil_tr_progBadge').innerHTML =
          '<span class="badge badge-recommended">Only available track ✓</span>';
        document.getElementById('coil_tr_verdict').textContent =
          'Residential-only tracks A & B are unavailable; commercial income must use the progressive track (C) — '
          + fmt(progTotal) + '/year'
          + '. Factor in potential Bituach Leumi before deciding.';
        return;
      }

      if (fullyExempt) {
        document.getElementById('coil_tr_exemptCard').classList.add('track-recommended');
        document.getElementById('coil_tr_exemptBadge').innerHTML =
          '<span class="badge badge-recommended">Fully Exempt ✓</span>';
        document.getElementById('coil_tr_verdict').textContent =
          'Attributed income is fully exempt on Track A — ₪0 tax owed.';
        return;
      }

      const tracks = [
        { id: 'coil_tr_exemptCard', badge: 'coil_tr_exemptBadge', tax: exemptTax, label: 'Track A' },
        { id: 'coil_tr_flatCard',   badge: 'coil_tr_flatBadge',   tax: flatTax,   label: 'Track B' },
        { id: 'coil_tr_progCard',   badge: 'coil_tr_progBadge',   tax: progTotal, label: 'Track C' },
      ];

      const sorted   = [...tracks].sort((a, b) => a.tax - b.tax);
      const cheapest = sorted[0];
      const runnerUp = sorted[1];
      const margin   = runnerUp.tax - cheapest.tax;

      if (margin <= THRESHOLD) {
        tracks.forEach(t => {
          if (t.tax - cheapest.tax <= THRESHOLD) {
            document.getElementById(t.badge).innerHTML = '<span class="badge badge-close">Too close to call</span>';
          }
        });
        document.getElementById('coil_tr_verdict').textContent =
          'Results are within ' + fmt(THRESHOLD) + '/year — review all tracks carefully.';
      } else if (cheapest.label === 'Track C') {
        document.getElementById('coil_tr_progCard').classList.add('track-recommended');
        document.getElementById('coil_tr_progBadge').innerHTML = '<span class="badge badge-recommended">Verify after Bituach Leumi ✓</span>';
        document.getElementById('coil_tr_verdict').textContent =
          'Track C appears cheapest, but factor in potential Bituach Leumi before deciding.';
      } else {
        document.getElementById(cheapest.id).classList.add('track-recommended');
        document.getElementById(cheapest.badge).innerHTML = '<span class="badge badge-recommended">Recommended ✓</span>';
        document.getElementById('coil_tr_verdict').textContent =
          cheapest.label + ' is cheapest at ' + fmt(cheapest.tax) + '/year — saving you ' + fmt(margin) + ' vs. the next best option.';
      }
    }

    function runCoILCalc() {
      runCoILRegCalc();
      runCoILTransparentCalc();
    }

    function updateOutputPanel() {
      const type          = document.getElementById('coil_companyType').value;
      const isTransparent = type === 'family' || type === 'house';
      document.getElementById('coil_output_regular').style.display    = isTransparent ? 'none' : '';
      document.getElementById('coil_output_transparent').style.display = isTransparent ? ''     : 'none';
      runCoILCalc();
    }

    document.getElementById('coil_companyType').addEventListener('change', updateOutputPanel);

    ['coil_rentalIncome','coil_rentalIncome_annual','coil_expenses','coil_otherIncome','coil_ownershipPct'].forEach(id =>
      document.getElementById(id).addEventListener('input', runCoILCalc)
    );
    document.getElementById('coil_over60').addEventListener('change', runCoILCalc);
    document.getElementById('coil_propertyType').addEventListener('change', runCoILCalc);

    updateOutputPanel();
  }

  // ── Israeli Company · Real Estate · Capital Gain (Residential = Commercial) ──
  // One init drives both Co_IL_RE_CG_Res and Co_IL_RE_CG_Com — for a company the
  // gain is taxed at the flat corporate rate (23%, ITO §126(a)) on the REAL gain
  // with no §48A holding-period split and no residential exemption, so the two
  // sections share this logic and differ only by element-id prefix.
  // `p` is that prefix ('coilcg_res_' or 'coilcg_com_').
  function initCoILRECG(p) {
    const OUTPUT_IDS = [
      p + 'gainDisplay',
      p + 'corpTax',  p + 'afterTax',  p + 'retainEffective',
      p + 'corpTax2', p + 'divTax',    p + 'combined', p + 'combinedEffective',
    ];

    function resetCards() {
      blank(OUTPUT_IDS);
      document.getElementById(p + 'verdict').textContent = '';
      clearBadges([p + 'retainBadge', p + 'distBadge']);
      clearTrackFlags([p + 'retainCard', p + 'distCard']);
    }

    function runCalc() {
      const purchasePrice   = pn(p + 'purchasePrice');
      const salePrice       = pn(p + 'salePrice');
      const acqExpenses     = pn(p + 'acqExpenses');
      const saleExpenses    = pn(p + 'saleExpenses');
      const improvements    = pn(p + 'improvements');
      const depreciation    = pn(p + 'depreciation');
      const ownershipPct    = Math.min(100, Math.max(0, pnOr(p + 'ownershipPct', 0)));

      if (!salePrice) { resetCards(); return; }

      const r = companyRealEstateCG({
        purchasePrice, depreciation, improvements,
        salePrice, saleExpenses, acqExpenses,
        israeli: true, ownershipPct,
      });

      // No taxable gain (sale ≤ adjusted basis + expenses) → mirror the CG sections
      if (r.gain <= 0) {
        resetCards();
        document.getElementById(p + 'gainDisplay').textContent = fmt(0) + ' (no taxable gain)';
        document.getElementById(p + 'verdict').textContent     = 'No taxable gain — no capital gains tax owed.';
        return;
      }

      document.getElementById(p + 'gainDisplay').textContent =
        fmt(r.gain) + ' (nominal — inflation indexing not applied)';

      // Card 1 — Profits Retained (corporate tax only)
      document.getElementById(p + 'corpTax').textContent         = fmt(r.corpTax);
      document.getElementById(p + 'afterTax').textContent        = fmt(r.afterTax);
      document.getElementById(p + 'retainEffective').textContent = effPct(r.corpTax, r.gain);

      // Card 2 — Fully Distributed (adds the 30% dividend on the after-tax gain)
      document.getElementById(p + 'corpTax2').textContent          = fmt(r.corpTax);
      document.getElementById(p + 'divTax').textContent            = fmt(r.divTax);
      document.getElementById(p + 'combined').textContent          = fmt(r.combined);
      document.getElementById(p + 'combinedEffective').textContent = effPct(r.combined, r.gain);

      // Card 1 is always the lower current tax; Card 2 shows the cost of access
      clearTrackFlags([p + 'retainCard', p + 'distCard']);
      document.getElementById(p + 'retainCard').classList.add('track-recommended');
      document.getElementById(p + 'retainBadge').innerHTML =
        '<span class="badge badge-recommended">Lower current tax ✓</span>';
      document.getElementById(p + 'distBadge').innerHTML =
        '<span class="badge badge-warning">+' + fmt(r.divTax) + ' to access funds</span>';

      document.getElementById(p + 'verdict').textContent =
        'Corporate tax: ' + fmt(r.corpTax) + ' (23% of the gain). '
        + 'Full distribution adds ' + fmt(r.divTax) + ' dividend tax'
        + ' — total ' + fmt(r.combined) + ' (' + effPct(r.combined, r.gain) + ' combined).';
    }

    [p + 'purchasePrice', p + 'salePrice', p + 'acqExpenses', p + 'saleExpenses',
     p + 'improvements', p + 'depreciation', p + 'ownershipPct'].forEach(id =>
      document.getElementById(id).addEventListener('input', runCalc)
    );

    runCalc();
  }

  // ── Foreign Company · Real Estate · Rental Income ─────────────────
  function initCoFORREInc() {
    const CORP_RATE = 0.23;

    const saved  = JSON.parse(sessionStorage.getItem('taxForm') || '{}');
    // Seed the in-section Property Type dropdown from Page 1 if it was set there;
    // otherwise it stays at its default (Residential). The transparent-entity path
    // (coming soon) will read residential/commercial from this dropdown.
    if ((saved.property || '').trim() === 'commercial') {
      document.getElementById('cofor_propertyType').value = 'commercial';
    }


    syncPair('cofor_rentalIncome', 'cofor_rentalIncome_annual');

    // ── Regular (non-transparent) foreign-company path ──
    const COFOR_OUTPUT_IDS = [
      'cofor_baseDisplay', 'cofor_taxDisplay', 'cofor_effectiveDisplay',
      'cofor_divDisplay', 'cofor_combinedDisplay',
    ];

    function resetCoFORCards() {
      blank(COFOR_OUTPUT_IDS);
      document.getElementById('cofor_verdict').textContent = '';
    }

    // Deductible Expenses only matter when filing a return; grey the field out on
    // the withholding basis, where it has no effect on the tax.
    function syncExpensesEnabled() {
      const onWithholding = document.getElementById('cofor_taxBasis').value === 'withholding';
      const exp = document.getElementById('cofor_expenses');
      exp.disabled      = onWithholding;
      exp.style.opacity = onWithholding ? '0.5' : '';
    }

    function runCoFORRegCalc() {
      if (document.getElementById('cofor_output_regular').style.display === 'none') return;

      const gross    = pn('cofor_rentalIncome_annual');
      const expenses = pn('cofor_expenses');
      const basis    = document.getElementById('cofor_taxBasis').value;

      if (!gross) {
        resetCoFORCards();
        document.getElementById('cofor_verdict').textContent = 'Enter rental income above to see estimates.';
        return;
      }

      // Withholding basis: 23% of gross, expenses ignored (advance / de facto final tax).
      // Return basis: 23% of net, floored at zero — the point of filing.
      const base      = basis === 'withholding' ? gross : Math.max(0, gross - expenses);
      const tax       = CORP_RATE * base;
      const effective = gross > 0 ? tax / gross : 0;   // 23% on withholding, lower on a return

      document.getElementById('cofor_baseDisplay').textContent      = fmt(base);
      document.getElementById('cofor_taxDisplay').textContent       = fmt(tax);
      document.getElementById('cofor_effectiveDisplay').textContent = (effective * 100).toFixed(1) + '%';
      // Foreign shareholders pay no Israeli dividend tax, so distribution is 0% and the
      // combined effective Israeli rate equals the corporate tax shown.
      document.getElementById('cofor_divDisplay').textContent       = fmt(0);
      document.getElementById('cofor_combinedDisplay').textContent  = (effective * 100).toFixed(1) + '%';

      if (basis === 'withholding') {
        document.getElementById('cofor_verdict').textContent =
          'Statutory withholding of ' + fmt(tax) + ' (23% of gross ' + fmt(gross) + ') is deducted at source — an advance that becomes a de facto final tax if no Israeli return is filed. '
          + 'Foreign shareholders owe no Israeli dividend tax on distribution, so the combined effective Israeli rate stays ' + (effective * 100).toFixed(1) + '%.';
      } else {
        document.getElementById('cofor_verdict').textContent =
          'Filing an Israeli return taxes 23% of net (' + fmt(base) + ') — ' + fmt(tax) + ', an effective ' + (effective * 100).toFixed(1) + '% of gross, below the 23% gross withholding. '
          + 'Foreign shareholders owe no Israeli dividend tax on distribution, so the combined effective Israeli rate equals the corporate tax shown.';
      }
    }

    // ── Transparent path (House Company) — reuses computeTracks ──
    const COFOR_TR_OUTPUT_IDS = [
      'cofor_tr_exemptAnnual','cofor_tr_exemptMonthly','cofor_tr_exemptEffective',
      'cofor_tr_flatAnnual','cofor_tr_flatMonthly','cofor_tr_flatEffective',
      'cofor_tr_progAnnual','cofor_tr_progMonthly','cofor_tr_progEffective',
    ];

    function resetTransparentCards() {
      blank(COFOR_TR_OUTPUT_IDS);
      document.getElementById('cofor_tr_attrDisplay').textContent = '—';
      document.getElementById('cofor_tr_verdict').textContent     = '';
      clearBadges(['cofor_tr_exemptBadge','cofor_tr_flatBadge','cofor_tr_progBadge']);
      clearTrackFlags(['cofor_tr_exemptCard','cofor_tr_flatCard','cofor_tr_progCard']);
    }

    function grayTransparentTrack(cardId, badgeId, valIds) {
      document.getElementById(cardId).classList.add('track-ineligible');
      valIds.forEach(id => { document.getElementById(id).textContent = 'N/A'; });
      document.getElementById(badgeId).innerHTML = '<span class="badge badge-warning">Residential only</span>';
    }

    function runCoFORTransparentCalc() {
      if (document.getElementById('cofor_output_transparent').style.display === 'none') return;

      const THRESHOLD = 500;

      const grossRent     = pn('cofor_rentalIncome_annual');
      const expenses      = pn('cofor_expenses');
      const otherIncome   = pn('cofor_otherIncome');
      const over60        = document.getElementById('cofor_over60').checked;
      const ownershipPct  = Math.min(100, Math.max(0, pnOr('cofor_ownershipPct', 100)));
      const isResidential = document.getElementById('cofor_propertyType').value !== 'commercial';

      if (!grossRent) { resetTransparentCards(); return; }

      // Attribution: scale gross rent and expenses by ownership share, kept
      // separate so each track applies its own expense rule (flat ignores
      // expenses; progressive deducts them).
      const ownership    = ownershipPct / 100;
      const attrGross    = grossRent * ownership;
      const attrExpenses = expenses  * ownership;

      const { flatTax, exemptTax, fullyExempt, progTax } = computeTracks({
        grossAnnual:       attrGross,
        otherAnnualIncome: otherIncome,
        annualExpenses:    attrExpenses,
        over60,
        isResidential,
      });

      const progTotal = progTax;

      resetTransparentCards();

      document.getElementById('cofor_tr_attrDisplay').textContent =
        fmt(attrGross) + ' (' + ownershipPct + '% of ' + fmt(grossRent) + ')';

      // ── Tracks A & B — residential only ──
      if (isResidential) {
        document.getElementById('cofor_tr_exemptAnnual').textContent    = fullyExempt ? fmt(0) : fmt(exemptTax);
        document.getElementById('cofor_tr_exemptMonthly').textContent   = fullyExempt ? fmt(0) : fmt(exemptTax / 12);
        document.getElementById('cofor_tr_exemptEffective').textContent = fullyExempt ? '0.0%' : effPct(exemptTax, attrGross);

        document.getElementById('cofor_tr_flatAnnual').textContent    = fmt(flatTax);
        document.getElementById('cofor_tr_flatMonthly').textContent   = fmt(flatTax / 12);
        document.getElementById('cofor_tr_flatEffective').textContent = effPct(flatTax, attrGross);
      } else {
        grayTransparentTrack('cofor_tr_exemptCard', 'cofor_tr_exemptBadge',
          ['cofor_tr_exemptAnnual','cofor_tr_exemptMonthly','cofor_tr_exemptEffective']);
        grayTransparentTrack('cofor_tr_flatCard', 'cofor_tr_flatBadge',
          ['cofor_tr_flatAnnual','cofor_tr_flatMonthly','cofor_tr_flatEffective']);
      }

      // ── Track C — always available ──
      document.getElementById('cofor_tr_progAnnual').textContent    = fmt(progTotal);
      document.getElementById('cofor_tr_progMonthly').textContent   = fmt(progTotal / 12);
      document.getElementById('cofor_tr_progEffective').textContent = effPct(progTotal, attrGross);

      // ── Recommendation ──
      if (!isResidential) {
        document.getElementById('cofor_tr_progCard').classList.add('track-recommended');
        document.getElementById('cofor_tr_progBadge').innerHTML =
          '<span class="badge badge-recommended">Only available track ✓</span>';
        document.getElementById('cofor_tr_verdict').textContent =
          'Residential-only tracks A & B are unavailable; commercial income must use the progressive track (C) — '
          + fmt(progTotal) + '/year'
          + '. Factor in potential Bituach Leumi before deciding.';
        return;
      }

      if (fullyExempt) {
        document.getElementById('cofor_tr_exemptCard').classList.add('track-recommended');
        document.getElementById('cofor_tr_exemptBadge').innerHTML =
          '<span class="badge badge-recommended">Fully Exempt ✓</span>';
        document.getElementById('cofor_tr_verdict').textContent =
          'Attributed income is fully exempt on Track A — ₪0 tax owed.';
        return;
      }

      const tracks = [
        { id: 'cofor_tr_exemptCard', badge: 'cofor_tr_exemptBadge', tax: exemptTax, label: 'Track A' },
        { id: 'cofor_tr_flatCard',   badge: 'cofor_tr_flatBadge',   tax: flatTax,   label: 'Track B' },
        { id: 'cofor_tr_progCard',   badge: 'cofor_tr_progBadge',   tax: progTotal, label: 'Track C' },
      ];

      const sorted   = [...tracks].sort((a, b) => a.tax - b.tax);
      const cheapest = sorted[0];
      const runnerUp = sorted[1];
      const margin   = runnerUp.tax - cheapest.tax;

      if (margin <= THRESHOLD) {
        tracks.forEach(t => {
          if (t.tax - cheapest.tax <= THRESHOLD) {
            document.getElementById(t.badge).innerHTML = '<span class="badge badge-close">Too close to call</span>';
          }
        });
        document.getElementById('cofor_tr_verdict').textContent =
          'Results are within ' + fmt(THRESHOLD) + '/year — review all tracks carefully.';
      } else if (cheapest.label === 'Track C') {
        document.getElementById('cofor_tr_progCard').classList.add('track-recommended');
        document.getElementById('cofor_tr_progBadge').innerHTML = '<span class="badge badge-recommended">Verify after Bituach Leumi ✓</span>';
        document.getElementById('cofor_tr_verdict').textContent =
          'Track C appears cheapest, but factor in potential Bituach Leumi before deciding.';
      } else {
        document.getElementById(cheapest.id).classList.add('track-recommended');
        document.getElementById(cheapest.badge).innerHTML = '<span class="badge badge-recommended">Recommended ✓</span>';
        document.getElementById('cofor_tr_verdict').textContent =
          cheapest.label + ' is cheapest at ' + fmt(cheapest.tax) + '/year — saving you ' + fmt(margin) + ' vs. the next best option.';
      }
    }

    function runCoFORCalc() {
      runCoFORRegCalc();
      runCoFORTransparentCalc();
    }

    function updateCoFORPanel() {
      const isTransparent = document.getElementById('cofor_transparent').checked;
      document.getElementById('cofor_output_regular').style.display     = isTransparent ? 'none' : '';
      document.getElementById('cofor_output_transparent').style.display = isTransparent ? ''     : 'none';
      runCoFORCalc();
    }

    syncExpensesEnabled();

    ['cofor_rentalIncome', 'cofor_rentalIncome_annual', 'cofor_expenses', 'cofor_otherIncome', 'cofor_ownershipPct'].forEach(id =>
      document.getElementById(id).addEventListener('input', runCoFORCalc)
    );
    document.getElementById('cofor_taxBasis').addEventListener('change', function () {
      syncExpensesEnabled();
      runCoFORCalc();
    });
    document.getElementById('cofor_over60').addEventListener('change', runCoFORCalc);
    document.getElementById('cofor_propertyType').addEventListener('change', runCoFORCalc);
    document.getElementById('cofor_transparent').addEventListener('change', updateCoFORPanel);

    updateCoFORPanel();
  }

  // ── Foreign Company · Real Estate · Capital Gain (Residential = Commercial) ──
  // One init drives both Co_FOR_RE_CG_Res and Co_FOR_RE_CG_Com — a foreign company
  // pays the flat corporate rate (23%, ITO §126(a)) on the REAL gain with no §48A
  // holding-period split and no residential exemption. There is no second tier:
  // foreign shareholders owe no Israeli dividend tax on distribution, so a single
  // corporate-tax card is shown. `p` is the element-id prefix
  // ('coforcg_res_' or 'coforcg_com_').
  function initCoFORRECG(p) {
    const OUTPUT_IDS = [p + 'gainDisplay', p + 'taxDisplay', p + 'effectiveDisplay'];

    function resetCards() {
      blank(OUTPUT_IDS);
      document.getElementById(p + 'verdict').textContent = '';
    }

    function runCalc() {
      const purchasePrice   = pn(p + 'purchasePrice');
      const salePrice       = pn(p + 'salePrice');
      const acqExpenses     = pn(p + 'acqExpenses');
      const saleExpenses    = pn(p + 'saleExpenses');
      const improvements    = pn(p + 'improvements');
      const depreciation    = pn(p + 'depreciation');

      if (!salePrice) { resetCards(); return; }

      // israeli:false → 23% corporate on the nominal gain, no dividend tier, no ownership
      const r = companyRealEstateCG({
        purchasePrice, depreciation, improvements,
        salePrice, saleExpenses, acqExpenses,
        israeli: false,
      });

      // No taxable gain (sale ≤ adjusted basis + expenses) → mirror the CG sections
      if (r.gain <= 0) {
        resetCards();
        document.getElementById(p + 'gainDisplay').textContent = fmt(0) + ' (no taxable gain)';
        document.getElementById(p + 'verdict').textContent     = 'No taxable gain — no capital gains tax owed.';
        return;
      }

      document.getElementById(p + 'gainDisplay').textContent =
        fmt(r.gain) + ' (nominal — inflation indexing not applied)';

      // Single card — Israeli corporate tax on the nominal gain
      document.getElementById(p + 'taxDisplay').textContent       = fmt(r.tax);
      document.getElementById(p + 'effectiveDisplay').textContent = effPct(r.tax, r.gain);

      document.getElementById(p + 'verdict').textContent =
        'Corporate tax: ' + fmt(r.tax) + ' (23% of the gain). '
        + 'Distribution to foreign shareholders is outside Israeli tax, so the combined effective Israeli rate stays '
        + effPct(r.tax, r.gain) + '.';
    }

    [p + 'purchasePrice', p + 'salePrice', p + 'acqExpenses', p + 'saleExpenses',
     p + 'improvements', p + 'depreciation'].forEach(id =>
      document.getElementById(id).addEventListener('input', runCalc)
    );

    runCalc();
  }

  // ── Israeli Company · Shares (dividend received OR capital gain on sale) ──
  // One section, two income types toggled by #coilsh_incomeType, both feeding the
  // same Retained/Distributed cards:
  //   • Dividend  → companyDividendIsraeli (0% on an Israeli-source dividend,
  //     23% net of a direct FTC on a foreign one), then 30% on distribution.
  //   • Capital gain → flat 23% corporate on the real gain via corporateIsraeli
  //     (no participation exemption, no substantial-shareholder distinction),
  //     then 30% on distribution.
  function initCoILShares() {
    const OUTPUT_IDS = [
      'coilsh_baseDisplay',
      'coilsh_retainRate', 'coilsh_companyTax', 'coilsh_afterTax', 'coilsh_retainEffective',
      'coilsh_companyTax2', 'coilsh_divTax', 'coilsh_combined', 'coilsh_combinedEffective',
    ];

    function resetCards() {
      blank(OUTPUT_IDS);
      document.getElementById('coilsh_verdict').textContent  = '';
      document.getElementById('coilsh_ftcNote').style.display = 'none';
      clearBadges(['coilsh_retainBadge', 'coilsh_distBadge']);
      clearTrackFlags(['coilsh_retainCard', 'coilsh_distCard']);
    }

    // Show the input group for the selected income type, and the foreign-
    // withholding field only for a foreign-source dividend.
    function syncVisibility() {
      const isDiv = document.getElementById('coilsh_incomeType').value === 'dividend';
      document.getElementById('coilsh_dividendInputs').style.display = isDiv ? '' : 'none';
      document.getElementById('coilsh_cgInputs').style.display       = isDiv ? 'none' : '';
      const foreign = document.getElementById('coilsh_source').value === 'foreign';
      document.getElementById('coilsh_foreignWhtRow').style.display  = (isDiv && foreign) ? '' : 'none';
    }

    // Render the shared two-card layout from a normalized result. `nominalNote`
    // appends the "nominal gain" note (capital-gain path); pass false for the
    // dividend path, which has no such note.
    function render(base, companyTax, afterTax, divTax, combined, baseLabel, nominalNote, showFtcNote) {
      document.getElementById('coilsh_baseLabel').textContent   = baseLabel;
      document.getElementById('coilsh_baseDisplay').textContent =
        fmt(base) + (nominalNote ? ' (nominal — inflation indexing not applied)' : '');

      // Card 1 — Retained in company
      document.getElementById('coilsh_retainRate').textContent      = effPct(companyTax, base);
      document.getElementById('coilsh_companyTax').textContent      = fmt(companyTax);
      document.getElementById('coilsh_afterTax').textContent        = fmt(afterTax);
      document.getElementById('coilsh_retainEffective').textContent = effPct(companyTax, base);

      // Card 2 — Distributed to shareholder
      document.getElementById('coilsh_companyTax2').textContent       = fmt(companyTax);
      document.getElementById('coilsh_divTax').textContent            = fmt(divTax);
      document.getElementById('coilsh_combined').textContent          = fmt(combined);
      document.getElementById('coilsh_combinedEffective').textContent = effPct(combined, base);

      clearTrackFlags(['coilsh_retainCard', 'coilsh_distCard']);
      document.getElementById('coilsh_retainCard').classList.add('track-recommended');
      document.getElementById('coilsh_retainBadge').innerHTML =
        '<span class="badge badge-recommended">Lower current tax ✓</span>';
      document.getElementById('coilsh_distBadge').innerHTML =
        '<span class="badge badge-warning">+' + fmt(divTax) + ' to access funds</span>';

      document.getElementById('coilsh_ftcNote').style.display = showFtcNote ? '' : 'none';

      document.getElementById('coilsh_verdict').textContent =
        'Company-level tax: ' + fmt(companyTax) + '. Full distribution to the individual shareholder adds '
        + fmt(divTax) + ' dividend tax — total ' + fmt(combined) + ' (' + effPct(combined, base) + ' combined).';
    }

    function runCalc() {
      const ownershipPct = Math.min(100, Math.max(0, pnOr('coilsh_ownershipPct', 0)));

      if (document.getElementById('coilsh_incomeType').value === 'dividend') {
        const dividend = pn('coilsh_dividend');
        const source   = document.getElementById('coilsh_source').value;

        if (dividend <= 0) { resetCards(); return; }   // guard before any rate division

        const r = companyDividendIsraeli({
          dividend, source, foreignWithheldPct: pn('coilsh_foreignWithheld'), ownershipPct,
        });
        render(dividend, r.companyBurden, r.afterTax, r.divTax, r.combined,
               'Dividend received', false, source === 'foreign');
      } else {
        const proceeds = pn('coilsh_cg_proceeds');
        if (!proceeds) { resetCards(); return; }

        const basis = adjustedBasis(pn('coilsh_cg_cost'), 0, 0);   // shares: no depreciation/improvements
        const gain  = nominalGain(proceeds, pn('coilsh_cg_saleExpenses'), pn('coilsh_cg_acqExpenses'), basis);

        if (gain <= 0) {
          resetCards();
          document.getElementById('coilsh_baseLabel').textContent   = 'Gain';
          document.getElementById('coilsh_baseDisplay').textContent = fmt(0) + ' (no taxable gain)';
          document.getElementById('coilsh_verdict').textContent     = 'No taxable gain — no tax owed.';
          return;
        }

        const r = corporateIsraeli({ grossAnnual: gain, ownershipPct });
        render(gain, r.corpTax, r.afterTax, r.divTax, r.combined, 'Gain', true, false);
      }
    }

    document.getElementById('coilsh_incomeType').addEventListener('change', function () { syncVisibility(); runCalc(); });
    document.getElementById('coilsh_source').addEventListener('change', function () { syncVisibility(); runCalc(); });
    ['coilsh_dividend', 'coilsh_foreignWithheld', 'coilsh_ownershipPct',
     'coilsh_cg_proceeds', 'coilsh_cg_cost', 'coilsh_cg_acqExpenses',
     'coilsh_cg_saleExpenses'].forEach(id =>
      document.getElementById(id).addEventListener('input', runCalc)
    );

    syncVisibility();
    runCalc();
  }

  // ── Foreign Company · Israeli Shares (dividend OR capital gain) ──
  // One section, two income types toggled by #coforsh_incomeType, single
  // Israeli-tax card (foreign shareholders owe no Israeli tax on distribution):
  //   • Dividend  → statutory withholding on an Israeli-source dividend to a
  //     foreign resident: 25%, or 30% for a substantial (≥10%) holder. Inlined
  //     here (matching the individual Shares section) — not an engine helper.
  //     An optional treaty rate, if entered, shows the reduced figure.
  //   • Capital gain → a foreign resident's gain on Israeli shares is generally
  //     exempt (0%) when the qualifying conditions hold; otherwise 23% on the
  //     real gain via corporateForeign.
  function initCoFORShares() {
    const OUTPUT_IDS = [
      'coforsh_baseDisplay', 'coforsh_rate', 'coforsh_taxDisplay',
      'coforsh_effectiveDisplay', 'coforsh_treatyDisplay', 'coforsh_treatyEffective',
    ];

    function resetCard() {
      blank(OUTPUT_IDS);
      document.getElementById('coforsh_verdict').textContent     = '';
      document.getElementById('coforsh_treatyRow').style.display = 'none';
    }

    // Show the input group for the selected income type; the treaty disclosure
    // note is only relevant to the dividend path.
    function syncVisibility() {
      const isDiv = document.getElementById('coforsh_incomeType').value === 'dividend';
      document.getElementById('coforsh_dividendInputs').style.display = isDiv ? '' : 'none';
      document.getElementById('coforsh_cgInputs').style.display       = isDiv ? 'none' : '';
      document.getElementById('coforsh_treatyNote').style.display     = isDiv ? '' : 'none';
    }

    function runDividend() {
      const dividend = pn('coforsh_dividend');
      if (dividend <= 0) { resetCard(); return; }   // guard before any rate division

      const substantial = document.getElementById('coforsh_substantial').checked;
      const rate        = substantial ? 0.30 : 0.25;   // statutory: 25%, or 30% if substantial
      const statutory   = rate * dividend;

      document.getElementById('coforsh_baseLabel').textContent   = 'Dividend received';
      document.getElementById('coforsh_baseDisplay').textContent = fmt(dividend);
      document.getElementById('coforsh_rate').textContent        = (rate * 100).toFixed(0) + '%';
      document.getElementById('coforsh_taxLabel').textContent       = 'Statutory withholding';
      document.getElementById('coforsh_taxDisplay').textContent      = fmt(statutory);
      document.getElementById('coforsh_effectiveDisplay').textContent = effPct(statutory, dividend);

      // Optional treaty override — a treaty is a ceiling, not a floor (CLAUDE.md):
      // display min(statutory, treaty), so a rate at or above statutory shows the
      // statutory amount, never more.
      const treatyPct  = Math.min(100, Math.max(0, pn('coforsh_treatyPct')));
      const treatyRate = Math.min(treatyPct / 100, rate);
      const treaty     = treatyRate * dividend;
      const treatyRow  = document.getElementById('coforsh_treatyRow');
      if (treatyPct > 0) {
        treatyRow.style.display = '';
        document.getElementById('coforsh_treatyDisplay').textContent   = fmt(treaty);
        document.getElementById('coforsh_treatyEffective').textContent = effPct(treaty, dividend);
      } else {
        treatyRow.style.display = 'none';
        document.getElementById('coforsh_treatyDisplay').textContent   = '—';
        document.getElementById('coforsh_treatyEffective').textContent = '—';
      }

      document.getElementById('coforsh_verdict').textContent =
        'Statutory withholding: ' + fmt(statutory) + ' (' + (rate * 100).toFixed(0) + '% of the dividend). '
        + 'Distribution to foreign shareholders is outside Israeli tax, so this is the total Israeli tax'
        + (treatyPct > 0
            ? (treatyRate < rate
                ? '; a treaty rate of ' + treatyPct + '% would reduce it to ' + fmt(treaty) + '.'
                : '; the entered treaty rate (' + treatyPct + '%) is not below the statutory rate, so the statutory figure applies.')
            : '.');
    }

    function runCapitalGain() {
      document.getElementById('coforsh_treatyRow').style.display = 'none';   // treaty applies to dividends only

      const proceeds = pn('coforsh_cg_proceeds');
      if (!proceeds) { resetCard(); return; }

      const basis = adjustedBasis(pn('coforsh_cg_cost'), 0, 0);   // shares: no depreciation/improvements
      const gain  = nominalGain(proceeds, pn('coforsh_cg_saleExpenses'), pn('coforsh_cg_acqExpenses'), basis);

      if (gain <= 0) {
        resetCard();
        document.getElementById('coforsh_baseLabel').textContent   = 'Gain';
        document.getElementById('coforsh_baseDisplay').textContent = fmt(0) + ' (no taxable gain)';
        document.getElementById('coforsh_verdict').textContent     = 'No taxable gain — no Israeli tax owed.';
        return;
      }

      const exempt = document.getElementById('coforsh_cgExempt').checked;
      const tax    = exempt ? 0 : corporateForeign({ grossAnnual: gain, annualExpenses: 0 }).tax;

      document.getElementById('coforsh_baseLabel').textContent   = 'Gain';
      document.getElementById('coforsh_baseDisplay').textContent = fmt(gain) + ' (nominal — inflation indexing not applied)';
      document.getElementById('coforsh_rate').textContent        = exempt ? '0%' : '23%';
      document.getElementById('coforsh_taxLabel').textContent       = 'Israeli tax';
      document.getElementById('coforsh_taxDisplay').textContent      = fmt(tax);
      document.getElementById('coforsh_effectiveDisplay').textContent = effPct(tax, gain);

      document.getElementById('coforsh_verdict').textContent = exempt
        ? 'Exemption applied — a qualifying foreign resident’s gain on Israeli shares is not taxed in Israel (0%).'
        : 'Israeli tax: ' + fmt(tax) + ' (23% of the gain). Distribution to foreign shareholders is outside Israeli tax.';
    }

    function runCalc() {
      if (document.getElementById('coforsh_incomeType').value === 'dividend') runDividend();
      else runCapitalGain();
    }

    document.getElementById('coforsh_incomeType').addEventListener('change', function () { syncVisibility(); runCalc(); });
    document.getElementById('coforsh_substantial').addEventListener('change', runCalc);
    document.getElementById('coforsh_cgExempt').addEventListener('change', runCalc);
    ['coforsh_dividend', 'coforsh_treatyPct',
     'coforsh_cg_proceeds', 'coforsh_cg_cost', 'coforsh_cg_acqExpenses',
     'coforsh_cg_saleExpenses'].forEach(id =>
      document.getElementById(id).addEventListener('input', runCalc)
    );

    syncVisibility();
    runCalc();
  }

  document.addEventListener('DOMContentLoaded', showSection);
