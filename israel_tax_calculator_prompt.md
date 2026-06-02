# Claude Code Prompt: Israel International Tax Treaty Calculator

## Project Goal
Build a CLI-based international tax calculator that models tax liability for individuals
with income subject to Israel's double taxation treaties (DTAs). The tool should help
determine withholding rates, effective tax burdens, and treaty benefits across all 58
of Israel's DTA partner countries, with special handling for countries where tax codes
vary by subnational jurisdiction (state, province, canton, municipality, etc.).

---

## Background Context

### Israel's Tax System (as of 2025–2026)
- **Individual income tax:** Progressive rates — 10%, 14%, 20%, 31%, 35%, 47% (+ 3% surtax on income above ~720,000 ILS)
- **Corporate tax:** 23% standard; 12% for Preferred Technological Enterprise; 7.5%–16% for Preferred Enterprise depending on **location in Israel** (Development Area A vs. other)
- **Residency test:** "Center of life" standard — based on family, economic, and social connections
- **Foreign tax credit:** Basket system (dividends, business income, etc.); excess credits carry forward 5 years
- **DTA network:** 58 treaties in force; Israel is a signatory to the OECD MLI (Multilateral Instrument), which has modified many treaties since January 2019

### Standard Treaty Withholding Rate Ranges (from Israel's DTAs)
| Income Type      | Typical Treaty Rate | Notes |
|------------------|---------------------|-------|
| Dividends        | 5%–15%             | Lower rate for substantial holdings (usually 25%+ ownership) |
| Interest         | 5%–15%             | Often 10% default |
| Royalties        | 5%–15%             | Varies widely |
| Capital Gains    | Varies / exempt    | Real estate gains often taxable in source country |
| Business Profits | 0% (no PE)         | Permanent Establishment triggers full taxation |

---

## Full List of Israel's 58 DTA Partner Countries

```
Albania, Armenia, Australia, Austria, Azerbaijan, Belarus, Belgium, Brazil,
Bulgaria, Canada, China, Croatia, Czech Republic, Denmark, Estonia, Ethiopia,
Finland, France, Georgia, Germany, Great Britain & Northern Ireland, Greece,
Hungary, India, Ireland, Italy, Jamaica, Japan, Latvia, Lithuania, Luxembourg,
Macedonia (North Macedonia), Malta, Mexico, Moldova, Netherlands, Norway, Panama,
Philippines, Poland, Portugal, Romania, Russia, Serbia, Singapore, Slovakia,
Slovenia, South Africa, South Korea, Spain, Sweden, Switzerland, Taiwan, Thailand,
Turkey, Ukraine, UAE, USA, Uzbekistan, Vietnam
```

**Note:** Cyprus and Hong Kong appear in some sources as additional partners.
Use the Israel Ministry of Finance official list as the canonical source. Total: ~58–60.

---

## Countries with Location-Based (Subnational) Tax Codes

These are Israel DTA partners where **individual income tax rates vary by
state/province/canton/municipality**. The calculator must prompt for or accept
a subnational jurisdiction when the user selects these countries.

### Tier 1 — Significant subnational variation (must implement)

| Country | Subnational Unit | Tax Type | Rate Range | Notes |
|---------|-----------------|----------|------------|-------|
| **USA** | State | State income tax | 0%–13.3% | 7 states have 0% (AK, FL, NV, SD, TX, WA, WY); CA highest at 13.3%. Some cities (NYC, Philadelphia) add local tax |
| **Canada** | Province/Territory | Provincial income tax | ~6%–21.8% | Quebec has separate system (25.75% top rate); all provinces have distinct brackets |
| **Switzerland** | Canton + Municipality | Cantonal & communal income tax | Varies dramatically | Zug and Nidwalden are lowest; Geneva and Zurich are higher. Federal + cantonal + communal stack |
| **Germany** | State (Land) | Church tax (Kirchensteuer) | 8% or 9% of income tax | Bavaria and Baden-Württemberg = 8%; all others = 9%. Applies to registered church members |
| **Spain** | Autonomous Community | Regional income tax | ~9%–25.5% (regional portion) | Madrid has lowest regional rates; Catalonia has highest. National + regional split 50/50 |
| **Belgium** | Municipality (Commune) | Communal additional tax | 0%–9% surcharge on income tax | Brussels communes vary; rural communes typically lower |
| **Denmark** | Municipality | Municipal income tax | ~23%–27% | Plus optional church tax (~0.6–1.3%). National rate is separate |
| **Sweden** | Municipality | Municipal income tax | ~28%–35% | National tax only kicks in above ~580,000 SEK. Most tax is municipal |
| **Finland** | Municipality | Municipal income tax | ~16%–23.5% | Church tax additional ~1–2% for members |
| **Norway** | Municipality | Municipal income tax | Fixed at 22% combined (2024) | Less variation than other Nordics; surtax on high incomes is national |
| **Italy** | Region + Municipality | IRPEF regional surtax | 1.23%–3.33% (regional) + up to 0.9% municipal | Sicily and Lazio tend to be higher; Calabria higher still |
| **Japan** | Prefecture + Municipality | Inhabitant tax (住民税) | ~10% total (6% municipal + 4% prefectural) | Roughly flat across jurisdictions but minor variation; added on top of national income tax |
| **India** | State | Professional Tax | 0–2,500 INR/year (capped) | Very low absolute amounts; Karnataka, Maharashtra, West Bengal impose it; many states don't |
| **Brazil** | State | ICMS (state sales/VAT) | 17%–20% (on goods/services) | Individual income tax is federal only (IRPF); ICMS applies to business/commerce |
| **China** | Local government | Local income tax surtax | 3% of national tax | Minor; individual income tax (IIT) is primarily national |
| **Philippines** | Local Government Unit | Local Business Tax (LBT) | Varies | Applies to business income; individual employment income is national only |

### Tier 2 — Limited or administrative variation (flag, don't require subnational input)

| Country | Note |
|---------|------|
| **Australia** | No state income tax since 1942 — federal only. Flag this as "no subnational income tax" |
| **Netherlands** | Box system (Box 1/2/3) varies by income type, not geography. No subnational income tax |
| **France** | Centralized national system; no regional income tax. Communal taxes exist for property only |
| **Portugal** | National surtax (sobretaxa) is national; municipal surcharge (derrama) applies to corporate, not individual |
| **South Korea** | Local income tax (~10% of national tax) — minor variation |
| **Mexico** | State payroll taxes exist but individual income tax is federal only |

---

## Architecture Requirements

### Core Data Models

```python
# Pseudocode / schema guidance

class Country:
    name: str
    iso_code: str  # ISO 3166-1 alpha-2
    has_subnational_tax: bool
    subnational_unit_name: str  # "state", "province", "canton", etc.
    subnational_jurisdictions: list[SubnationalJurisdiction]
    treaty_with_israel: TreatyTerms

class SubnationalJurisdiction:
    name: str
    income_tax_rate: float  # or a bracket schedule
    notes: str

class TreatyTerms:
    dividend_rate_standard: float     # % withholding
    dividend_rate_substantial: float  # % for 25%+ ownership
    interest_rate: float
    royalties_rate: float
    capital_gains_real_estate: str    # "source country", "residence country", "exempt"
    capital_gains_shares: str
    business_profits_pe_threshold: int  # days
    mli_modified: bool
    effective_date: str
```

### Calculator Features to Build

1. **Country selector** — searchable list of all 58 DTA partners
2. **Income type input** — employment, dividends, interest, royalties, capital gains, business profits
3. **Subnational selector** — conditionally shown for Tier 1 countries (USA → state, Canada → province, etc.)
4. **Dual calculation** — compute tax in source country + Israeli credit/exemption + net liability
5. **Treaty override** — show DTA rate vs. domestic rate, pick the more favorable
6. **Output summary** — source country gross tax, treaty-reduced rate, Israeli credit, net effective rate

### CLI Interface (suggested)

```
$ python tax_calc.py

Israel International Tax Treaty Calculator
==========================================
Select income source country: [searchable list of 58 countries]
> United States

Income type: [employment / dividends / interest / royalties / capital_gains / business]
> dividends

Gross dividend income (USD): 50000

Select US state (affects combined effective rate):
> California

--- RESULTS ---
US Federal withholding (treaty rate):     15.0%    $7,500
California state tax (dividends):          9.3%    $4,650
Israeli foreign tax credit:              -$7,500   (limited to Israeli tax on same income)
Israeli tax on dividend income:           25.0%   $12,500
Net Israeli tax after credit:             $5,000
Combined effective rate:                  24.3%

Treaty Note: US-Israel DTA (1975, in force 1995) — MLI not yet in effect between US and Israel
```

### File Structure

```
israel_tax_calculator/
├── main.py                  # CLI entry point
├── data/
│   ├── countries.json       # All 58 DTA partners + treaty terms
│   ├── us_states.json       # State income tax brackets
│   ├── canada_provinces.json
│   ├── swiss_cantons.json
│   ├── spain_regions.json
│   ├── nordic_municipalities.json  # Denmark, Sweden, Finland rate ranges
│   └── israel_tax.json      # Israel domestic brackets + rates
├── models/
│   ├── country.py
│   ├── treaty.py
│   └── calculator.py
├── utils/
│   ├── currency.py          # Optional: exchange rate lookup
│   └── display.py           # Rich/tabulate formatting
├── tests/
│   └── test_calculator.py
└── README.md
```

### Tech Stack Recommendation
- Python 3.11+
- `rich` for terminal formatting
- `questionary` or `click` for CLI prompts
- `pydantic` for data validation
- `pytest` for tests
- Optional: `httpx` for live exchange rates (e.g., via exchangerate.host)

---

## Priority Implementation Order

1. **Phase 1:** Data layer — populate `countries.json` with all 58 treaties (withholding
   rates for dividends/interest/royalties); populate Israel domestic brackets
2. **Phase 2:** Core calculator — treaty benefit logic, foreign tax credit basket system,
   dual-country net liability
3. **Phase 3:** Subnational layer — USA states, Canadian provinces, Swiss cantons as
   the three highest-priority jurisdictions (given volume of Israel-related transactions)
4. **Phase 4:** CLI interface with `rich` display and interactive prompts
5. **Phase 5:** Edge cases — MLI modifications, PE permanent establishment rules,
   Israeli "Preferred Enterprise" location-based corporate rates, new immigrant
   (oleh chadash) 10-year tax exemption on foreign income

---

## Important Israel-Specific Rules to Model

- **New immigrant / returning resident exemption:** An oleh chadash or returning resident
  is exempt from Israeli tax on foreign-source income for 10 years. Calculator should
  prompt whether the individual qualifies.
- **Israeli Preferred Enterprise (location-based corporate rate):** Corporate entities
  in Development Area A pay 7.5%; other areas pay 16%; Preferred Technological
  Enterprise pays 12%.
- **Surtax on high earners:** 3% additional tax on income above ~720,000 ILS (~$200K USD)
- **MLI status:** As of 2024, the MLI has NOT yet modified the US-Israel treaty
  (US has not ratified). It HAS modified treaties with most EU countries. Flag this
  per-country in the data layer.
- **Interest income sourcing rule:** Under Israeli domestic law, interest on Israeli
  government bonds is typically exempt for non-residents.

---

## Data Sources to Reference
- Israel Tax Authority (ITA): https://www.gov.il/en/departments/israel_tax_authority
- Israel Ministry of Finance DTA list: https://mof.gov.il/en
- OECD MLI matching database: https://www.oecd.org/tax/treaties/mli-matching-database.htm
- PWC Israel tax summaries: https://taxsummaries.pwc.com/israel
- WorldWide-Tax Israel DTA list: https://www.worldwide-tax.com/israel/israel-dta.asp

---

## Disclaimer to Include in Output
> This tool is for educational and research purposes only and does not constitute
> tax advice. Treaty provisions are subject to change via MLI modifications and
> domestic law amendments. Consult a qualified international tax professional
> for specific situations.
