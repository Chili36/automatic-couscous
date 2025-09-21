# FoodEx2 Business Rules Documentation

## Overview

The FoodEx2 validation system implements 31 business rules (BR01-BR31) that ensure food codes conform to EFSA standards. These rules check term types, facet compatibility, hierarchy relationships, and structural validity.

## Severity Levels

Each rule has two severity indicators:
- **Semaphore Level**: Visual indicator (ERROR > HIGH > LOW > NONE)
- **Text Level**: Message severity (ERROR > HIGH > LOW > NONE)

For validation purposes we group severities into four categories:

- **Blocking Errors (`ERROR`)** – Stop validation entirely. Codes with these issues are always invalid.
- **Hard Warnings (`HIGH`)** – Treated as critical issues. Validation fails unless explicitly configured to allow high warnings.
- **Soft Warnings (`LOW`)** – Informational guidance. Validation still passes, but these issues should be reviewed.
- **Informational (`NONE`)** – Contextual success or info messages that never affect validity.

### Severity Classification Overview

| Severity | Validation Impact | Business Rules |
| --- | --- | --- |
| `ERROR` | Blocking – validation fails | BR29, BR30, BR31 |
| `HIGH` | Hard warning – treated as critical | BR01, BR03, BR04, BR05, BR06, BR07, BR08, BR13, BR14, BR16, BR17, BR19, BR20, BR21, BR24, BR25, BR26, BR27, BR28 |
| `LOW` | Soft warning – advisory only | BR10, BR11, BR12, BR15, BR23 |
| `NONE` | Informational – success/neutral | BR22 |

> **Note**: BR02, BR09, and BR18 are placeholders that are currently not implemented and therefore have no severity classification.

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

**Rule**: F03 (physical state) facets cannot be applied to raw commodities as they create derivatives.

**Example**:
- ❌ `A0EZJ#F03.A0BZS` (Raw apple + frozen state)
- ✅ Use frozen apple derivative instead

**Purpose**: Physical state changes create new products (derivatives).

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
- `A0EZJ#F03.A0BZS` - BR13: Physical state on raw commodity
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
