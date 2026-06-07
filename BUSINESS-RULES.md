# FoodEx2 Business Rules Documentation

## Overview

The FoodEx2 validation system implements 31 business rules (BR01-BR31) that ensure food codes conform to EFSA standards. These rules check term types, facet compatibility, hierarchy relationships, and structural validity.

## Severity Levels

Each rule has two severity indicators:
- **Semaphore Level**: Visual indicator (ERROR > HIGH > LOW > NONE)
- **Text Level**: Message severity (ERROR > HIGH > LOW > NONE)

For validation purposes we group severities into four categories:

- **Blocking Errors (`ERROR`)** – Stop validation entirely. Codes with these issues are always invalid.
- **Hard Warnings (`HIGH`)** – Critical issues that invalidate the code. These are business rule violations that make the code unacceptable.
- **Soft Warnings (`LOW`)** – Informational guidance. Validation still passes, but these issues should be reviewed.
- **Informational (`NONE`)** – Contextual success or info messages that never affect validity.

### Severity Classification Overview

| Severity | Validation Impact | Business Rules |
| --- | --- | --- |
| `ERROR` | Blocking – validation fails | BR17, BR19, BR20, BR21, BR25, BR29, BR30, BR31 |
| `HIGH` | Blocking – validation fails | BR01, BR03, BR04, BR05, BR06, BR07, BR08, BR13, BR14, BR16, BR24, BR26, BR27, BR28 |
| `LOW` | Soft warning – validation passes | BR10, BR11, BR12, BR15, BR23 |
| `NONE` | Informational – validation passes | BR22 |

> **Note**: BR02, BR09, and BR18 are placeholders that are currently not implemented and therefore have no severity classification.

## BR → ICT Method Mapping

The validator implements each rule against the EFSA ICT's compiled Java implementation in `data/app.jar` (class `business_rules.TermRules`). The table below maps each BR number to the ICT method that owns the check, plus a one-line summary of what that method does.

| BR | ICT method | Behaviour |
| --- | --- | --- |
| BR01 | `sourceCommodityRawCheck` | Raw commodity F27 source-commodity specificity check |
| BR02 | — | Empty placeholder |
| BR03 | `sourceInCompositeCheck` | Composite base terms cannot use F01 source facets |
| BR04 | `sourceCommodityInCompositeCheck` | Composite base terms cannot use F27 source-commodity facets |
| BR05 | `sourceCommodityDerivativeCheck` | Derivative F27 source-commodity facets must refine an implicit source commodity |
| BR06 | `sourceCommodityDerivativeCheck` | F01 source is allowed on derivatives only when one F27 source commodity is present |
| BR07 | `sourceCommodityDerivativeCheck` | F01 source is blocked when derivative has multiple F27 source commodities |
| BR08 | `isNotReportable` | Base terms not reportable in the reporting hierarchy are forbidden |
| BR09 | — | Empty placeholder |
| BR10 | `nonSpecificTermCheck` | Non-specific base terms are discouraged |
| BR11 | `genericProcessedFacetCheck` | Generic Processed terms under F28 process are discouraged |
| BR12 | `minorIngredientCheck` | F04 ingredient facets are limited to minor ingredients for derivative/raw commodity terms |
| BR13 | `physicalStateRawCheck` (gated by `isForbiddenPhysicalState`) | Selected F03 physical states are forbidden on raw primary commodity terms — see BR13 details below for the 7-code list |
| BR14 | content-provider / ICT-DCF-specific | Declared as ICT/DCF-only in warning message data |
| BR15 | DCF-specific | Declared as DCF-only in warning message data |
| BR16 | `checkIfExplicitLessDetailed` | Derivative explicit process ordCode cannot be less detailed than implicit process ordCode |
| BR17 | `isFacet` | Facet terms cannot be selected as base terms |
| BR18 | — | Empty placeholder |
| BR19 | `checkFpForRawCommodity` | Raw commodity terms cannot take configured forbidden process facets from `BR_Data.csv` — see BR19 Extension Layer below for the additive `BR19+` mechanism |
| BR20 | `isDeprecated` | Deprecated terms are forbidden |
| BR21 | `isDismissed` | Dismissed terms are forbidden |
| BR22 | `performWarningChecks` | Success/info message when no high warning is present |
| BR23 | `hierarchyAsBasetermCheck` | Hierarchy terms as base terms are discouraged |
| BR24 | `hierarchyAsBasetermCheck` | Hierarchy base terms outside exposure/reporting hierarchy are high warnings |
| BR25 | single-cardinality facet check | More than one explicit facet in a single-cardinality facet category is forbidden |
| BR26 | `mutuallyExclusiveCheck` | More than one process with the same ordCode is forbidden on derivative base terms — **the call to this method is commented out in the observed ICT source** (see Known Divergences below) |
| BR27 | `decimalOrderCheck` | Decimal ordCode process combinations with the same integer part are blocked |
| BR28 | `reconstitutionCheck` | Reconstitution/dilution process is blocked on concentrate, powder, or dehydrated terms |
| BR29 | `performWarningChecks` parser | Invalid code structure, unknown base term, or unknown facet term |
| BR30 | ICT-only facet category validation | Facet category code does not exist |
| BR31 | ICT-only facet category validation | Facet term does not belong to the supplied facet category hierarchy |

This mapping was extracted from `business_rules/TermRules.class` bytecode and `data/warningMessages.txt`, then cross-checked against an independent extraction. To re-derive it for a future ICT release: `unzip -p data/app.jar business_rules/TermRules.class | strings -n 4 | grep -E '<methodName>'` against each BR number.

## Known Divergences from ICT

This validator aims to be faithful to ICT, but a few rules deserve specific notes:

- **BR13 — list embedded in Java, not in `warningMessages.txt`.** ICT's `isForbiddenPhysicalState` references a 7-code allowlist (Powder, coarse paste/minced, Paste, Puree-type, Fine powder, Coarse powder, Fine paste). The one-line spec in `warningMessages.txt:13` ("if a physical state facet is added to a food rpc term") oversimplifies; our implementation uses the exact 7 codes from the Java source. See BR13 detailed section below.
- **BR19 — data file frozen.** EFSA's `BR_Data.csv` was last updated on 2020-05-20. It covers 30 root groups; many MTX root groups added since then have no forbidden-process rows, so BR19 cannot fire for them even when domain semantics suggest it should (e.g. Turmeric+Drying). The validator faithfully reproduces ICT behaviour and additionally ships an opt-out additive extension layer — see BR19 Extension Layer below.
- **BR26 — practically never fires.** ICT's `mutuallyExclusiveCheck` call appears to be commented out in the observed `TermRules` source. Our implementation has an additional architectural gap: `getProcessOrdinalCode` walks the **report** hierarchy to find a root group, but BR26 only applies to **derivative** base terms — which don't live in the report hierarchy. Result: every process gets ord-code 0, the same-ord-code grouping is empty, and BR26 doesn't fire. This matches ICT behaviour in practice but the underlying cause differs. Fixing this properly requires walking a hierarchy that derivatives actually inhabit (likely `master`) — out of scope for this PR; tracked separately.

## BR19 Extension Layer (`BR19+`)

ICT's BR19 check ("forbidden processes on raw commodities") reads from `data/BR_Data.csv`, a CSV maintained in `openefsa/catalogue-browser`. That file was last updated on **2020-05-20** (commit `7bc147fb`), covers 30 root groups, and has not been refreshed as MTX has grown over subsequent releases (we're currently on MTX 17.1). Many root groups added since are not represented, so BR19 cannot fire on them even when the same semantic clearly applies — for example, drying a raw commodity to produce a derivative.

A concrete instance: drying turmeric (`A01AC#F28.A07KG`). Drying turmeric roots produces dried/powdered turmeric, a derivative. EFSA's BR_Data.csv forbids `A07KG` (Drying) on `A07XJ` (Garden vegetables) for exactly this reason, but the file has no row for `A0CGZ` (Turmeric roots and similar). Stock ICT — and our validator running in strict ICT-parity mode — does not flag this code. Stock behaviour is faithful but practically misses a case that domain semantics clearly cover.

To bridge this without modifying EFSA's data file, this repository ships an additive companion file: **`data/BR_Data.extension.csv`**. It uses the same five columns as the official file plus two transparency columns:

| Column | From EFSA file | Added in extension |
| --- | :---: | :---: |
| `ROOT_GROUP_CODE` | ✓ | ✓ |
| `ROOT_GROUP_LABEL` | ✓ | ✓ |
| `FORBIDDEN_PROCS` | ✓ | ✓ |
| `FORBIDDEN_PROCS_LABELS` | ✓ | ✓ |
| `ORDINAL_CODE` | ✓ | ✓ |
| `RATIONALE` | | ✓ — why this row was added, with a parallel from EFSA's existing rows |
| `ADDED` | | ✓ — date the row was added |

### Behaviour

- The official `data/BR_Data.csv` is loaded first, byte-for-byte as EFSA ships it, and is never modified.
- `data/BR_Data.extension.csv` is loaded after, and its rows are appended to the in-memory rule list.
- Extension rows are tagged `source: 'extension'`; official rows are tagged `source: 'efsa'`.
- When a BR19 firing comes from an extension row, the rule label in the warning is **`BR19+`** (not plain `BR19`) and the warning carries the rationale and date as fields. This makes it transparent in API responses, exports, and UI which firings came from the official ICT data and which from the local extension.
- An EFSA row always wins over an extension row covering the same `(root group, process)` pair — the official data is the source of truth where it exists.

### Strict ICT parity

Set the environment variable `STRICT_ICT_PARITY=1` to disable the extension entirely. The validator then behaves exactly as if only the EFSA file existed — useful when you need to confirm a code's behaviour against stock ICT, or when comparing notes with someone who runs the official tool.

### Adding a row

Each row in `BR_Data.extension.csv` requires a non-empty `RATIONALE` and `ADDED` date. The expectation is that every addition has a clear parallel to an existing EFSA row — "EFSA forbids X on root group Y; the new row Z follows the same pattern because…" — so reviewers can sanity-check the semantic. Speculative additions without a parallel are not the goal; this file is meant to cover gaps that look like data freshness, not policy disagreements.

If you've added rows you believe should be in the upstream EFSA file, please consider also opening a PR or issue against [openefsa/catalogue-browser](https://github.com/openefsa/catalogue-browser) so other ICT users benefit too. Local extension is a workaround; upstream is the long-term home.

## Term Types

Understanding term types is crucial for validation:
- **`r`** - Raw commodity (unprocessed foods like "Apple", "Milk")
- **`d`** - Derivative (processed foods like "Apple juice", "Cheese")
- **`c`** - Composite/Aggregated (food groups like "Dairy products")
- **`s`** - Simple composite (simple mixed foods)
- **`f`** - Facet (descriptors, not allowed as base terms)
- **`g`** - Generic/Group terms
- **`h`** - Hierarchy terms
- **`n`** - Non-specific terms

## Facet Categories

Common facet prefixes:
- **F01** - Source (animal/plant origin)
- **F03** - Physical state
- **F04** - Ingredient
- **F27** - Source commodities
- **F28** - Process

---

## Business Rules (BR01-BR31)

### BR01: Source Commodity Validation for Raw Terms
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Raw commodity terms (type `r`) with F27 facets

**Rule**: For raw commodity terms, any explicit F27 (source-commodities) facet must be:
- A child of an already present implicit F27 facet, OR
- A child of the base term itself

**Example**:
- ❌ `A0EZJ#F27.A000J` (Apple with unrelated grain source)
- ✅ `A0EZJ#F27.A0EZK` (Apple with apple variety)

**Purpose**: Prevents illogical source specifications for raw foods.

---

### BR02: Empty Rule
**Status**: Not implemented (placeholder)

---

### BR03: No Source Facet in Composite Foods
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Composite terms (types `c` or `s`)

**Rule**: F01 (source) facets cannot be used with composite foods. Use F04 (ingredient) instead.

**Example**:
- ❌ `A000J#F01.A0F6E` (Composite with source facet)
- ✅ `A000J#F04.A0F6E` (Composite with ingredient facet)

**Purpose**: Composite foods don't have a single source; they have ingredients.

---

### BR04: No Source-Commodities in Composite Foods
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Composite terms (types `c` or `s`)

**Rule**: F27 (source-commodities) facets cannot be used with composite foods.

**Example**:
- ❌ `A02LS#F27.A0EZJ` (Pizza with source-commodity)
- ✅ `A02LS#F04.A0EZJ` (Pizza with ingredient)

**Purpose**: Similar to BR03, composites have ingredients, not source commodities.

---

### BR05: F27 Restrictions for Derivatives
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Derivative terms (type `d`)

**Rule**: Explicit F27 facets on derivatives must be more specific than implicit F27 facets.

**Example**:
- Base: `A0B6F` (Fruit juice - has implicit F27 for fruits)
- ❌ `A0B6F#F27.A01BS` (Adding vegetables - not more specific)
- ✅ `A0B6F#F27.A0EZJ` (Adding specific fruit - apple)

**Purpose**: Ensures logical specialization of derivative products.

---

### BR06: F01 Source Requires F27
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Derivative terms (type `d`)

**Rule**: F01 (source) facets can only be used on derivatives that have F27 (source-commodities) facets (implicit or explicit).

**Example**:
- ❌ Generic derivative + F01 (no F27 present)
- ✅ Fruit juice + F01 (has implicit F27 for fruits)

**Purpose**: Source animals/plants only make sense when source commodities are defined.

---

### BR07: F01 for Single F27 Only
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Derivative terms (type `d`)

**Rule**: F01 (source) facets can only be used when exactly one F27 is present.

**Example**:
- ❌ Mixed fruit juice (multiple F27) + F01
- ✅ Apple juice (single F27) + F01

**Purpose**: Can't specify a single source for products from multiple commodities.

---

### BR08: Non-Reportable Terms Forbidden
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: All terms not in reporting hierarchy

**Rule**: Terms must belong to the reporting hierarchy to be used (unless dismissed).

**Purpose**: Ensures only approved terms are used for official reporting.

---

### BR09: Empty Rule
**Status**: Not implemented (placeholder)

---

### BR10: Non-Specific Terms Discouraged
**Severity**: NONE/LOW _(Soft warning – advisory guidance)_
**Applies to**: Non-specific terms (type `n`)

**Rule**: Using non-specific terms as base terms is discouraged.

**Example**:
- ⚠️ Using "Food product not specified" as base term

**Purpose**: Encourages precise food classification.

---

### BR11: Generic Process Terms Discouraged
**Severity**: LOW/LOW _(Soft warning – advisory guidance)_
**Applies to**: F28 process facets

**Rule**: Using generic process terms like "Processed" (A07XS) is discouraged.

**Example**:
- ⚠️ `A0B9Z#F28.A07XS` (Meat + "Processed")
- ✅ `A0B9Z#F28.A07JS` (Meat + "Cooking")

**Purpose**: Encourages specific process descriptions.

---

### BR12: Ingredient Facet Restrictions
**Severity**: LOW/LOW _(Soft warning – advisory guidance)_
**Applies to**: Raw commodities (type `r`) and derivatives (type `d`)

**Rule**: F04 (ingredient) facets can only be used as minor ingredients.

**Example**:
- ⚠️ `A03NC#F04.A033J` (Wine-like drinks with ingredient)

**Purpose**: Main components should use appropriate facets, not ingredient facets.

---

### BR13: Physical State Creates Derivatives
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Raw commodity terms (type `r`)
**Source**: Extracted directly from ICT (`business_rules/TermRules.class` method `isForbiddenPhysicalState` in `data/app.jar`). The one-line description in `data/warningMessages.txt:13` ("if a physical state facet is added to a food rpc term") is a simplification — ICT actually gates on a specific 7-code forbidden list, not all F03.

**Rule**: A raw primary commodity term flags BR13 only when its F03 facet is one of seven physical-disintegration descriptors:

| Code | Name |
|---|---|
| A06JD | Powder |
| A06JE | coarse paste / minced |
| A06JF | Paste |
| A06JG | Puree-type |
| A07Y2 | Fine powder |
| A07Y3 | Coarse powder |
| A07Y4 | Fine paste |

All seven describe forms in which the raw structure has been destroyed. Other F03 descriptors (e.g. `A0C2M` Solid, `A0C3M` Liquid) describe form without disintegration and are **permitted** on raw commodities — they do not fire BR13.

**Examples**:
- ❌ `A01AC#F03.A06JD` (Turmeric roots + Powder) → BR13 fires
- ❌ `A01DJ#F03.A06JD` (Apples + Powder) → BR13 fires
- ✅ `A01AC#F03.A0C2M` (Turmeric roots + Solid) → BR13 does NOT fire (Solid is permitted)
- ✅ `A0EZJ#F03.A06JD` (Derivative base + Powder) → BR13 does NOT fire (base is not raw)
- ✅ Use the existing dried/powdered derivative term instead of constructing the forbidden codes

**Purpose**: Disintegration (grinding to powder/paste/puree) creates a new derivative product; other physical-state descriptions don't.

**Implementation**: `server/validators/business-rules-validator.js:checkBR13`. The forbidden-code list is defined as a static `Set` named `BR13_FORBIDDEN_F03_CODES` on the validator class.

---

### BR14: ICT/DCF Only Rule
**Severity**: HIGH/HIGH _(Hard warning – context-specific)_
**Applies to**: Special validation context

**Rule**: Certain validations only apply in ICT and DCF contexts.

---

### BR15: DCF Only Rule
**Severity**: LOW/LOW _(Soft warning – advisory guidance)_
**Applies to**: DCF context only

**Rule**: Certain validations only apply in DCF context.

---

### BR16: Process Detail Level Check
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Derivative terms (type `d`)

**Rule**: Explicit process facets should not be less detailed than implicit ones.

**Example**:
- Dried fruit (implicit: Drying ord=6)
- ❌ Adding "Preserved" (ord=4) - less specific
- ✅ Adding "Freeze-dried" (ord=6.1) - more specific

**Purpose**: Prevents redundant or contradictory process specifications.

---

### BR17: Facets as Base Terms Forbidden
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Facet terms (type `f`)

**Rule**: Facet descriptors cannot be used as base terms.

**Example**:
- ❌ Using "Frozen" as a base term
- ✅ Using "Apple" + frozen facet

**Purpose**: Facets are descriptors, not standalone food items.

---

### BR18: Empty Rule
**Status**: Not implemented (placeholder)

---

### BR19: Forbidden Processes on Raw Commodities
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Raw commodity terms (type `r`)

**Rule**: Processes that create derivatives cannot be applied to raw commodities.

**Example**:
- ❌ `A000L#F28.A07LG` (Cereal grains + Flaking)
- ✅ Use flaked cereal derivative instead

**Purpose**: Certain processes fundamentally change the food's nature.

---

### BR20: Deprecated Terms
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: All deprecated terms

**Rule**: Deprecated terms cannot be used.

**Purpose**: Ensures use of current terminology.

---

### BR21: Dismissed Terms
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: All dismissed terms

**Rule**: Dismissed terms cannot be used.

**Purpose**: Prevents use of rejected terms.

---

### BR22: Success Message
**Severity**: NONE/NONE _(Informational message)_
**Type**: Informational

**Rule**: Confirmation message when base term is successfully added.

---

### BR23: Hierarchy Terms Discouraged
**Severity**: LOW/LOW _(Soft warning – advisory guidance)_
**Applies to**: Hierarchy terms in exposure hierarchy

**Rule**: Using hierarchy terms as base terms is discouraged.

**Example**:
- ⚠️ Using "Fruits" (hierarchy) instead of specific fruit

**Purpose**: Encourages specific food selection.

---

### BR24: Non-Exposure Hierarchy Warning
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Hierarchy terms NOT in exposure hierarchy

**Rule**: Hierarchy terms not in exposure hierarchy shouldn't be used as base terms.

**Purpose**: Only exposure hierarchy terms are suitable for consumption data.

---

### BR25: Single Cardinality Enforcement
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Single-cardinality facet categories

**Rule**: Certain facet categories can only have one value.

**Single-cardinality categories**:
- F01 (Source)
- F02 (Part-nature)
- F03 (Physical state)
- F07 (Fat content)
- F11 (Alcohol content)
- F22 (Preparation production place)
- F24 (Intended use)
- F26 (Generic term)
- F30 (Reporting level)
- F32 (Gender)
- F34 (Host sampled)

**Example**:
- ❌ `A0B9Z#F03.A0BZT#F03.A0BZU` (Two physical states)
- ✅ `A0B9Z#F03.A0BZT` (One physical state)

---

### BR26: Mutually Exclusive Processes
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Derivative terms (type `d`) with F28 processes

**Rule**: Processes with the same ordinal code cannot be used together.

**Example**:
- Flaking (ord=1) and Grinding (ord=1)
- ❌ `A000L#F28.A07LG#F28.A07LA` (Both have ord=1)

**Purpose**: Mutually exclusive processes represent alternatives.

---

### BR27: Decimal Ordcode Process Conflicts
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Derivative terms (type `d`)

**Rule**: Processes with decimal ordcodes (x.1, x.2) in the same integer group conflict.

**Example**:
- Juicing (ord=1.1) and Concentrating (ord=1.2)
- ❌ Using both on same term
- ✅ Use the more specific final process

**Purpose**: Decimal processes create different derivative paths.

---

### BR28: Reconstitution Restrictions
**Severity**: HIGH/HIGH _(Hard warning – treated as critical)_
**Applies to**: Dehydrated products

**Rule**: Reconstitution/dilution processes cannot be applied to concentrate, powder, or dried terms.

**Example**:
- ❌ Milk powder + Reconstituting process
- ✅ Use reconstituted milk product instead

**Purpose**: Reconstitution creates a different product type.

---

### BR29: Code Structure Validation
**Severity**: ERROR/ERROR _(Blocking error – validation fails)_
**Applies to**: All codes

**Rule**: Code must follow the pattern: `BASE#FACET.DESC#FACET.DESC`

**Valid patterns**:
- `A0B9Z` (base only)
- `A0B9Z#F28.A07JS` (base + facet)
- `A0B9Z#F28.A07JS#F01.A0F6E` (multiple facets)

**Invalid**:
- `INVALID` (doesn't match pattern)
- `A0B9Z#F28` (incomplete facet)

---

### BR30: Invalid Facet Category
**Severity**: ERROR/ERROR _(Blocking error – validation fails)_
**Applies to**: All facet codes

**Rule**: Facet category (F01, F02, etc.) must exist.

**Example**:
- ❌ `A0B9Z#F99.A07JS` (F99 doesn't exist)

---

### BR31: Facet Not in Category Hierarchy
**Severity**: ERROR/ERROR _(Blocking error – validation fails)_
**Applies to**: All facet descriptors

**Rule**: Facet descriptor must belong to its category's hierarchy.

**Example**:
- ❌ `A0B9Z#F28.AAAAA` (AAAAA not a valid process)
- ✅ `A0B9Z#F28.A07JS` (A07JS is valid cooking process)

---

## Validation Examples

### Valid Codes
- `A0B9Z` - Simple base term (Bovine meat)
- `A0B9Z#F28.A07JS` - With process (Cooked bovine meat)
- `A0BXM#F01.A0F6E` - With source (Cow's milk)

### Invalid Codes
- `A01AC#F03.A06JD` - BR13: Physical state (Powder) on raw commodity (Turmeric roots)
- `A000J#F01.A0F6E` - BR03: Source on composite
- `A03NC#F04.A033J` - BR12: Ingredient on derivative (warning)
- `DEPRECATED_TERM` - BR20: Deprecated term

## Best Practices

1. **Start with the right base term**: Choose specific terms over generic ones
2. **Understand term types**: Raw vs derivative vs composite
3. **Use appropriate facets**: Source for origin, ingredient for components
4. **Respect cardinality**: Don't duplicate single-cardinality facets
5. **Check process compatibility**: Some processes exclude others
6. **Validate incrementally**: Test codes as you build them.
